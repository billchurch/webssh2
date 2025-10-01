import type { ClientChannel } from 'ssh2'
import type { ConnectionId } from '../../types/branded.js'
import type { Result } from '../../state/types.js'
import { ok, err } from '../../state/types.js'
import type { ExecResult, SSHConnection } from '../interfaces.js'
import type { ConnectionPool } from './connection-pool.js'
import type { ConnectionLogger, ConnectionLogBase } from './connection-logger.js'
import type { LogLevel } from '../../logging/levels.js'
import type { LogStatus } from '../../logging/log-context.js'

type DebugLogger = (message?: unknown, ...params: unknown[]) => void
interface ExecDependencies {
  readonly pool: ConnectionPool
  readonly connectionLogger: ConnectionLogger
  readonly debug: DebugLogger
}
interface ExecInput {
  readonly connectionId: ConnectionId
  readonly command: string
}
interface ExecCallbackContext {
  readonly connection: SSHConnection
  readonly command: string
  readonly baseInfo: ConnectionLogBase
  readonly start: number
  readonly resolve: (result: Result<ExecResult>) => void
  readonly debug: DebugLogger
  readonly connectionLogger: ConnectionLogger
}
interface ExecStreamContext extends ExecCallbackContext {
  readonly stream: ClientChannel
}
interface ExecCloseContext extends ExecCallbackContext {
  readonly stdout: string
  readonly stderr: string
  readonly code: number
}

export async function executeSshCommand(
  deps: ExecDependencies,
  input: ExecInput
): Promise<Result<ExecResult>> {
  const readyResult = getReadyConnection(deps, input)
  if (!readyResult.ok) {
    return err(readyResult.error)
  }
  const { connection, baseInfo } = readyResult.value
  deps.debug('Executing command:', input.command)
  return runCommand(deps, { connection, command: input.command, baseInfo })
}

function getReadyConnection(
  deps: ExecDependencies,
  input: ExecInput
): Result<{ connection: SSHConnection; baseInfo: ConnectionLogBase }> {
  const connection = deps.pool.get(input.connectionId)
  if (connection === undefined) {
    return err(new Error('Connection not found'))
  }

  if (connection.status !== 'connected') {
    deps.connectionLogger.log(
      deps.connectionLogger.baseFromConnection(connection),
      'warn',
      'ssh_command',
      'SSH exec command rejected',
      {
        connectionId: connection.id,
        status: 'failure',
        subsystem: 'exec',
        reason: 'Connection not ready',
        data: { command: input.command }
      }
    )
    return err(new Error('Connection not ready'))
  }

  return ok({ connection, baseInfo: deps.connectionLogger.baseFromConnection(connection) })
}

function runCommand(
  deps: ExecDependencies,
  context: { connection: SSHConnection; command: string; baseInfo: ConnectionLogBase }
): Promise<Result<ExecResult>> {
  return new Promise((resolve) => {
    const start = Date.now()
    try {
      context.connection.client.exec(
        context.command,
        createExecCallback({
          connection: context.connection,
          command: context.command,
          baseInfo: context.baseInfo,
          start,
          resolve,
          debug: deps.debug,
          connectionLogger: deps.connectionLogger
        })
      )
    } catch (error) {
      const failure = error instanceof Error ? error : new Error('Exec failed')
      logThrownExecError(deps, context, failure)
      resolve(err(failure))
    }
  })
}

function createExecCallback(
  context: ExecCallbackContext
): (error: Error | undefined, stream: ClientChannel) => void {
  return (error, stream) => {
    if (error !== undefined) {
      handleExecStartError(error, context)
      return
    }

    monitorStream({ ...context, stream })
  }
}

function handleExecStartError(error: Error, context: ExecCallbackContext): void {
  context.debug('Failed to execute command:', error)
  context.connectionLogger.log(
    context.baseInfo,
    'warn',
    'ssh_command',
    'SSH exec command failed to start',
    {
      connectionId: context.connection.id,
      status: 'failure',
      subsystem: 'exec',
      reason: error.message,
      data: { command: context.command }
    }
  )
  context.resolve(err(error))
}

function monitorStream(context: ExecStreamContext): void {
  let stdout = ''
  let stderr = ''
  context.stream.on('data', (data: Buffer) => {
    stdout += data.toString()
  })
  context.stream.stderr.on('data', (data: Buffer) => {
    stderr += data.toString()
  })
  context.stream.on('close', (code: number) => {
    handleStreamClose({ ...context, stdout, stderr, code })
  })
}

function handleStreamClose(context: ExecCloseContext): void {
  context.connection.lastActivity = Date.now()
  context.debug('Command executed with code:', context.code)

  const status: LogStatus = context.code === 0 ? 'success' : 'failure'
  const level: LogLevel = status === 'success' ? 'info' : 'warn'
  const reason = status === 'failure' ? `Command exited with code ${context.code}` : undefined
  context.connectionLogger.log(context.baseInfo, level, 'ssh_command', 'SSH exec command completed', {
    connectionId: context.connection.id,
    status,
    subsystem: 'exec',
    durationMs: Date.now() - context.start,
    bytesIn: Buffer.byteLength(context.command),
    bytesOut: Buffer.byteLength(context.stdout) + Buffer.byteLength(context.stderr),
    reason,
    data: {
      command: context.command,
      exit_code: context.code
    }
  })
  context.resolve(ok({
    stdout: context.stdout,
    stderr: context.stderr,
    code: context.code
  }))
}

function logThrownExecError(
  deps: ExecDependencies,
  context: { connection: SSHConnection; baseInfo: ConnectionLogBase; command: string },
  error: Error
): void {
  deps.connectionLogger.log(
    context.baseInfo,
    'error',
    'ssh_command',
    'SSH exec command threw error',
    {
      connectionId: context.connection.id,
      status: 'failure',
      subsystem: 'exec',
      reason: error.message,
      data: { command: context.command }
    }
  )
}
