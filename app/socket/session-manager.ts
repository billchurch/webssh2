// app/socket/session-manager.ts
// Session state management for WebSocket connections

import type { Credentials } from '../validation/credentials.js'

export interface SessionState {
  authenticated: boolean
  username: string | null
  password: string | null
  privateKey: string | null
  passphrase: string | null
  host: string | null
  port: number | null
  term: string | null
  cols: number | null
  rows: number | null
}

/**
 * Manages session state for WebSocket connections
 */
export class SessionManager {
  private state: SessionState

  constructor() {
    this.state = this.createInitialState()
  }

  /**
   * Create initial session state
   */
  private createInitialState(): SessionState {
    return {
      authenticated: false,
      username: null,
      password: null,
      privateKey: null,
      passphrase: null,
      host: null,
      port: null,
      term: null,
      cols: null,
      rows: null,
    }
  }

  /**
   * Get current session state
   */
  getState(): SessionState {
    return { ...this.state }
  }

  /**
   * Update session with credentials
   */
  updateCredentials(creds: Partial<Credentials>): void {
    if (creds.username != null) {this.state.username = creds.username}
    if (creds.password != null) {this.state.password = creds.password}
    if (creds.privateKey != null) {this.state.privateKey = creds.privateKey}
    if (creds.passphrase != null) {this.state.passphrase = creds.passphrase}
    if (creds.host != null) {this.state.host = creds.host}
    if (creds.port != null) {this.state.port = creds.port}
    if (creds.term != null) {this.state.term = creds.term}
  }

  /**
   * Update terminal dimensions
   */
  updateDimensions(cols: number | null, rows: number | null): void {
    if (cols != null) {this.state.cols = cols}
    if (rows != null) {this.state.rows = rows}
  }

  /**
   * Mark session as authenticated
   */
  markAuthenticated(): void {
    this.state.authenticated = true
  }

  /**
   * Check if session is authenticated
   */
  isAuthenticated(): boolean {
    return this.state.authenticated
  }

  /**
   * Reset session to initial state
   */
  reset(): void {
    this.state = this.createInitialState()
  }

  /**
   * Get terminal settings
   */
  getTerminalSettings(): { term: string | null; cols: number | null; rows: number | null } {
    return {
      term: this.state.term,
      cols: this.state.cols,
      rows: this.state.rows,
    }
  }
}