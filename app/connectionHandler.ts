import type { Request, Response } from 'express'
import { promises as fs } from 'node:fs'
import { createNamespacedDebug } from './logger.js'
import { HTTP, MESSAGES, DEFAULTS, TELNET_DEFAULTS } from './constants/index.js'
import {
  transformAssetPaths,
  transformHtml,
  injectConfigWithThemingString,
} from './utils/html-transformer.js'
import { getCachedThemingJson } from './services/theming/index.js'
import type { AuthSession } from './auth/auth-utils.js'
import type { Config, ThemingConfig } from './types/config.js'
import { getConfig } from './config.js'

const debug = createNamespacedDebug('connectionHandler')

type Sess = AuthSession

/**
 * Module-level reference to the resolved theming config. Set once at startup
 * via `setHandlerThemingConfig` so per-request handling does not need to
 * re-resolve config. When `null` or when `enabled === false`, the legacy
 * non-theming injection path is used (zero behavior change).
 */
let loadedTheming: ThemingConfig | null = null

/**
 * Wire the resolved server theming config into the connection handler.
 * Called once at startup from the app bootstrap.
 */
export function setHandlerThemingConfig(cfg: ThemingConfig | undefined): void {
  loadedTheming = cfg ?? null
}

/**
 * Test-only helper to clear the wired theming config so each test starts
 * from the legacy (no-theming) code path.
 */
export function resetHandlerThemingConfigForTests(): void {
  loadedTheming = null
}

/**
 * Check if session has any type of credentials (Basic Auth or POST)
 */
function hasSessionCredentials(session: Sess): boolean {
  return Boolean(
    session.sshCredentials != null &&
    (session.usedBasicAuth === true || session.authMethod === 'POST'),
  )
}

/**
 * Map a transport selector to a Socket.IO client `transports` list. Lets a
 * deployment force HTTP long-polling when WebSocket upgrades are known to fail
 * (restrictive proxies, some corporate networks).
 *
 * Accepted values (case-insensitive):
 *   - `websocket` -> `['websocket']`  (WebSocket only, no polling fallback)
 *   - `polling`   -> `['polling']`    (HTTP long-polling only, no upgrade)
 *   - `both`      -> `['polling', 'websocket']` (poll first, then upgrade)
 *
 * Returns `undefined` for any non-string or unrecognized value.
 */
function mapTransportValue(value: unknown): string[] | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  switch (value.toLowerCase()) {
    case 'websocket':
      return ['websocket']
    case 'polling':
      return ['polling']
    case 'both':
      return ['polling', 'websocket']
    default:
      return undefined
  }
}

/**
 * Resolve the Socket.IO client `transports` list. The `transport` URL query
 * parameter takes precedence (per-request override); otherwise the server-wide
 * `options.transport` config value (settable via `WEBSSH2_OPTIONS_TRANSPORT`)
 * is used. Returns `undefined` when neither yields a recognized value so the
 * client keeps its own default transport behavior.
 */
function resolveTransports(
  query: unknown,
  configTransport: unknown,
): { transports: string[]; source: 'URL parameter' | 'server config' } | undefined {
  const raw = (query as Record<string, unknown> | undefined)?.['transport']
  const fromQuery = mapTransportValue(Array.isArray(raw) ? raw[0] : raw)
  if (fromQuery !== undefined) {
    return { transports: fromQuery, source: 'URL parameter' }
  }
  const fromConfig = mapTransportValue(configTransport)
  if (fromConfig !== undefined) {
    return { transports: fromConfig, source: 'server config' }
  }
  return undefined
}

function buildSocketConfig(
  req: Request,
  isTelnet: boolean,
  cfg?: Config,
): Record<string, unknown> {
  const socketPath = isTelnet ? TELNET_DEFAULTS.IO_PATH : DEFAULTS.IO_PATH
  const socket: Record<string, unknown> = {
    url: `${req.protocol}://${req.get('host')}`,
    path: socketPath,
  }
  const resolved = resolveTransports(req.query, cfg?.options.transport)
  if (resolved !== undefined) {
    socket['transports'] = resolved.transports
    debug(`Socket transports forced via ${resolved.source}:`, resolved.transports)
  }
  const result: Record<string, unknown> = {
    socket: {
      url: `${req.protocol}://${req.get('host')}`,
      path: socketPath,
    },
    autoConnect: req.path.startsWith('/host/'),
  }
  if (isTelnet) {
    result['protocol'] = 'telnet'
  }
  return result
}

function buildConnectionMode(opts: ConnectionOptions | undefined): Record<string, unknown> {
  if (opts?.connectionMode === undefined) {
    return {}
  }
  const result: Record<string, unknown> = {
    connectionMode: opts.connectionMode,
  }
  if (opts.lockedHost !== undefined) {
    result['lockedHost'] = opts.lockedHost
  }
  if (opts.lockedPort !== undefined) {
    result['lockedPort'] = opts.lockedPort
  }
  debug('Connection mode set:', {
    mode: opts.connectionMode,
    lockedHost: opts.lockedHost,
    lockedPort: opts.lockedPort,
  })
  return result
}

function buildSshCredentials(
  session: Sess | undefined,
  req: Request & { sessionID?: string },
): Record<string, unknown> {
  if (session == null || !hasSessionCredentials(session) || session.sshCredentials == null) {
    return {}
  }
  const creds = session.sshCredentials
  const sshFragment: Record<string, unknown> = {
    host: creds.host,
    port: creds.port,
  }
  if (creds.term != null && creds.term !== '') {
    sshFragment['sshterm'] = creds.term
  }
  const authType = session.usedBasicAuth === true ? 'Basic Auth' : (session.authMethod ?? 'Unknown')
  debug('Session-only auth enabled - credentials remain server-side: %O', {
    authType,
    host: creds.host,
    port: creds.port,
    term: creds.term,
    sessionId: req.sessionID,
    hasCredentials: true,
  })
  return {
    ssh: sshFragment,
    autoConnect: true,
  }
}

/**
 * Build the header fragment for tempConfig.
 *
 * Returns an empty object (no header slice) when nothing is configured —
 * the client falls back to its own default rendering (no bar shown).
 * Otherwise returns { header: {...} } with text and background populated
 * based on field-wise override precedence: session.headerOverride > cfg.header.
 */
function buildHeaderConfig(
  cfg: Config,
  session: Sess | undefined,
): Record<string, unknown> {
  const overrideText = session?.headerOverride?.text
  const overrideBackground = session?.headerOverride?.background

  const text = overrideText ?? cfg.header.text
  const background = overrideBackground ?? cfg.header.background

  if (text == null && background == null) {
    return {}
  }

  const header: Record<string, unknown> = {}
  if (text != null) {
    header['text'] = text
  }
  if (background != null) {
    header['background'] = background
  }
  return { header }
}

async function sendClient(
  config: Record<string, unknown>,
  res: Response,
  basePath?: string,
): Promise<void> {
  try {
    const data = await readClientTemplate()
    debug('Transforming HTML with config')
    // The generated HTML embeds per-request config; never cache it.
    res.setHeader('Cache-Control', 'no-store')
    const themingCfg = loadedTheming
    if (themingCfg !== null && themingCfg.enabled === true) {
      const htmlWithAssetPaths = transformAssetPaths(data, basePath)
      const themingJson = getCachedThemingJson(themingCfg)
      const modifiedHtml = injectConfigWithThemingString(htmlWithAssetPaths, config, themingJson)
      res.send(modifiedHtml)
      return
    }
    const modifiedHtml = transformHtml(data, config, basePath)
    res.send(modifiedHtml)
  } catch {
    res.status(HTTP.INTERNAL_SERVER_ERROR).send(MESSAGES.CLIENT_FILE_ERROR)
  }
}

let cachedClientTemplate: string | null = null

async function readClientTemplate(): Promise<string> {
  if (cachedClientTemplate != null) {
    return cachedClientTemplate
  }

  for (const reader of CLIENT_TEMPLATE_READERS) {
    try {
      const template = await reader()
      cachedClientTemplate = template
      return template
    } catch (error) {
      debug(
        'Client template candidate failed: %s',
        (error as { message?: string }).message ?? 'unknown error',
      )
    }
  }

  throw new Error('Client template not found in expected locations')
}

type TemplateReader = () => Promise<string>

const readFromProjectRoot: TemplateReader = () =>
  fs.readFile('node_modules/webssh2_client/client/public/client.htm', 'utf8')

const readFromParentRoot: TemplateReader = () =>
  fs.readFile('../node_modules/webssh2_client/client/public/client.htm', 'utf8')

const readFromGrandParentRoot: TemplateReader = () =>
  fs.readFile('../../node_modules/webssh2_client/client/public/client.htm', 'utf8')

const CLIENT_TEMPLATE_READERS: readonly TemplateReader[] = [
  readFromProjectRoot,
  readFromParentRoot,
  readFromGrandParentRoot,
]

interface ConnectionOptions {
  host?: string
  /** Connection mode: 'full' allows editing host/port, 'host-locked' restricts to credentials only */
  connectionMode?: 'full' | 'host-locked'
  /** Host that cannot be changed (when connectionMode is 'host-locked') */
  lockedHost?: string
  /** Port that cannot be changed (when connectionMode is 'host-locked') */
  lockedPort?: number
  /** Protocol type: 'ssh' (default) or 'telnet' */
  protocol?: 'ssh' | 'telnet'
}

export function buildTempConfig(
  req: Request & { session?: Sess; sessionID?: string },
  cfg: Config,
  opts?: ConnectionOptions,
): Partial<Config> {
  const isTelnet = opts?.protocol === 'telnet'
  const tempConfig: Record<string, unknown> = buildSocketConfig(req as Request, isTelnet, cfg)
  Object.assign(tempConfig, buildConnectionMode(opts))
  Object.assign(tempConfig, buildSshCredentials(req.session, req))
  Object.assign(tempConfig, buildHeaderConfig(cfg, req.session))
  return tempConfig
}

export default async function handleConnection(
  req: Request & { session?: Sess; sessionID?: string },
  res: Response,
  opts?: ConnectionOptions,
): Promise<void> {
  debug('Handling connection req.path:', (req as Request).path)

  const cfg = await getConfig()
  const tempConfig = buildTempConfig(req, cfg, opts)

  const isTelnet = opts?.protocol === 'telnet'
  const basePath = isTelnet ? '/telnet/assets/' : undefined

  await sendClient(tempConfig, res, basePath)
}
