// app/types/express.ts

import type { Request, Response } from 'express'
import type { SSHCredentials } from './config.js'

export interface HeaderOverride {
  text?: string
  background?: string
  style?: string
}

export interface SessionData {
  usedBasicAuth?: boolean
  sshCredentials?: SSHCredentials
  headerOverride?: HeaderOverride
  authMethod?: string
  envVars?: Record<string, string>
  allowReplay?: boolean
  mrhSession?: string
  readyTimeout?: number
}

export interface WebSSH2Request extends Request {
  session: Request['session'] & SessionData
}

export interface WebSSH2Response extends Response {}

export interface SocketConfig {
  socket: {
    url: string
    path: string
  }
  autoConnect: boolean
  ssh?: {
    host: string
    port: number
    sshterm?: string
  }
  [key: string]: unknown
}