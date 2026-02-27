/**
 * Telnet IAC (Interpret As Command) option negotiation handler.
 *
 * Processes raw telnet protocol data, strips IAC command sequences,
 * generates appropriate negotiation responses, and returns clean
 * terminal data for display.
 *
 * @see RFC 854 - Telnet Protocol Specification
 * @see RFC 855 - Telnet Option Specifications
 * @see RFC 1091 - Telnet Terminal-Type Option
 * @see RFC 1073 - Telnet Window Size Option (NAWS)
 */

import debug from 'debug'

const iacLogger = debug('webssh2:telnet:iac')

// ── Telnet protocol constants ──────────────────────────────────────────

/** Interpret As Command - marks the start of a telnet command sequence */
export const IAC = 0xFF

/** Refuse to perform option / confirm option is disabled */
export const DONT = 0xFE

/** Request the other side to perform option */
export const DO = 0xFD

/** Refuse to perform option / confirm option is disabled (local) */
export const WONT = 0xFC

/** Agree to perform option / confirm option is enabled (local) */
export const WILL = 0xFB

/** Subnegotiation Begin */
export const SB = 0xFA

/** Subnegotiation End */
export const SE = 0xF0

// ── Option codes ───────────────────────────────────────────────────────

/** Echo option */
export const ECHO = 1

/** Suppress Go Ahead */
export const SGA = 3

/** Terminal Type option */
export const TERMINAL_TYPE = 24

/** Negotiate About Window Size */
export const NAWS = 31

// ── Subnegotiation qualifiers ──────────────────────────────────────────

/** IS qualifier for subnegotiation responses */
export const IS = 0

/** SEND qualifier for subnegotiation requests */
export const SEND = 1

// ── Supported options set ──────────────────────────────────────────────

const SUPPORTED_OPTIONS: ReadonlySet<number> = new Set([
  ECHO,
  SGA,
  TERMINAL_TYPE,
  NAWS,
])

// ── Option negotiation states ────────────────────────────────────────

type OptionState = 'inactive' | 'offered' | 'active'

const OPTION_NAMES: ReadonlyMap<number, string> = new Map([
  [ECHO, 'ECHO'],
  [SGA, 'SGA'],
  [TERMINAL_TYPE, 'TERMINAL-TYPE'],
  [NAWS, 'NAWS'],
])

// ── Parser state enum ──────────────────────────────────────────────────

const enum ParserState {
  Data = 0,
  GotIAC = 1,
  GotCommand = 2,
  InSubnegotiation = 3,
  SubnegotiationGotIAC = 4,
}

// ── Types ──────────────────────────────────────────────────────────────

interface ProcessResult {
  /** Terminal data with IAC sequences removed */
  cleanData: Buffer
  /** IAC responses to send back to server */
  responses: Buffer[]
}

// ── TelnetNegotiator ───────────────────────────────────────────────────

export class TelnetNegotiator {
  private readonly terminalType: string
  private cols: number
  private rows: number

  private state: ParserState = ParserState.Data
  private currentCommand = 0
  private subnegBuffer: number[] = []
  private readonly optionStates = new Map<number, OptionState>()

  constructor(terminalType: string = 'vt100') {
    this.terminalType = terminalType
    this.cols = 80
    this.rows = 24
  }

  /**
   * Update the stored window dimensions (used by NAWS).
   */
  setWindowSize(cols: number, rows: number): void {
    this.cols = cols
    this.rows = rows
  }

  /**
   * Build proactive WILL offers for TERMINAL-TYPE and NAWS.
   * Call once at shell open to announce capabilities before the server asks.
   * Returns empty array if offers were already sent.
   */
  buildProactiveOffers(): Buffer[] {
    const offers: Buffer[] = []

    for (const option of [TERMINAL_TYPE, NAWS]) {
      if (this.getOptionState(option) === 'inactive') {
        const name = OPTION_NAMES.get(option) ?? String(option)
        iacLogger('→ [proactive] WILL %s', name)
        offers.push(Buffer.from([IAC, WILL, option]))
        this.setOptionState(option, 'offered')
      }
    }

    return offers
  }

  /**
   * Process incoming data from the telnet server.
   * Strips IAC sequences, generates responses, returns clean terminal data.
   */
  processInbound(data: Buffer): ProcessResult {
    const cleanBytes: number[] = []
    const responses: Buffer[] = []

    for (const byte of data) {
      this.processOneByte(byte, cleanBytes, responses)
    }

    return {
      cleanData: Buffer.from(cleanBytes),
      responses,
    }
  }

  /**
   * Encode NAWS (window size) subnegotiation.
   * Returns: IAC SB NAWS <width-high> <width-low> <height-high> <height-low> IAC SE
   * Note: If any byte in width/height equals 0xFF, it must be doubled (IAC escape)
   */
  encodeNaws(cols: number, rows: number): Buffer {
    const widthHigh = (cols >> 8) & 0xFF
    const widthLow = cols & 0xFF
    const heightHigh = (rows >> 8) & 0xFF
    const heightLow = rows & 0xFF

    const bytes: number[] = [IAC, SB, NAWS]
    appendEscaped(bytes, widthHigh)
    appendEscaped(bytes, widthLow)
    appendEscaped(bytes, heightHigh)
    appendEscaped(bytes, heightLow)
    bytes.push(IAC, SE)

    return Buffer.from(bytes)
  }

  /**
   * Encode TERMINAL-TYPE IS subnegotiation response.
   * Returns: IAC SB TERMINAL-TYPE IS <term-bytes> IAC SE
   */
  encodeTerminalType(): Buffer {
    const termBytes = Buffer.from(this.terminalType, 'ascii')
    return Buffer.concat([
      Buffer.from([IAC, SB, TERMINAL_TYPE, IS]),
      termBytes,
      Buffer.from([IAC, SE]),
    ])
  }

  // ── Private helpers ────────────────────────────────────────────────

  private getOptionState(option: number): OptionState {
    return this.optionStates.get(option) ?? 'inactive'
  }

  private setOptionState(option: number, state: OptionState): void {
    const previous = this.getOptionState(option)
    const name = OPTION_NAMES.get(option) ?? String(option)
    iacLogger('%s: %s → %s', name, previous, state)
    this.optionStates.set(option, state)
  }

  private processOneByte(
    byte: number,
    cleanBytes: number[],
    responses: Buffer[],
  ): void {
    switch (this.state) {
      case ParserState.Data: {
        this.handleDataByte(byte, cleanBytes)
        break
      }
      case ParserState.GotIAC: {
        this.handleAfterIAC(byte, cleanBytes)
        break
      }
      case ParserState.GotCommand: {
        this.handleOptionByte(byte, responses)
        break
      }
      case ParserState.InSubnegotiation: {
        this.handleSubnegByte(byte)
        break
      }
      case ParserState.SubnegotiationGotIAC: {
        this.handleSubnegIACByte(byte, responses)
        break
      }
    }
  }

  private handleDataByte(byte: number, cleanBytes: number[]): void {
    if (byte === IAC) {
      this.state = ParserState.GotIAC
    } else {
      cleanBytes.push(byte)
    }
  }

  private handleAfterIAC(
    byte: number,
    cleanBytes: number[],
  ): void {
    if (byte === IAC) {
      // IAC IAC → literal 0xFF
      cleanBytes.push(0xFF)
      this.state = ParserState.Data
      return
    }

    if (byte === SB) {
      this.subnegBuffer = []
      this.state = ParserState.InSubnegotiation
      return
    }

    if (byte === DO || byte === DONT || byte === WILL || byte === WONT) {
      this.currentCommand = byte
      this.state = ParserState.GotCommand
      return
    }

    // Unknown command byte after IAC - ignore and return to data state
    this.state = ParserState.Data
  }

  private handleOptionByte(byte: number, responses: Buffer[]): void {
    const command = this.currentCommand
    this.state = ParserState.Data

    if (command === DO) {
      this.handleDo(byte, responses)
    } else if (command === DONT) {
      const name = OPTION_NAMES.get(byte) ?? String(byte)
      iacLogger('← DONT %s', name)
      iacLogger('→ WONT %s', name)
      responses.push(Buffer.from([IAC, WONT, byte]))
    } else if (command === WILL) {
      this.handleWill(byte, responses)
    } else if (command === WONT) {
      const name = OPTION_NAMES.get(byte) ?? String(byte)
      iacLogger('← WONT %s', name)
      iacLogger('→ DONT %s', name)
      responses.push(Buffer.from([IAC, DONT, byte]))
    }
  }

  private handleDo(option: number, responses: Buffer[]): void {
    const name = OPTION_NAMES.get(option) ?? String(option)
    iacLogger('← DO %s', name)

    if (!SUPPORTED_OPTIONS.has(option)) {
      iacLogger('→ WONT %s (unsupported)', name)
      responses.push(Buffer.from([IAC, WONT, option]))
      return
    }

    const currentState = this.getOptionState(option)

    // Only send WILL if we haven't already offered
    if (currentState === 'inactive') {
      iacLogger('→ WILL %s', name)
      responses.push(Buffer.from([IAC, WILL, option]))
    }

    this.setOptionState(option, 'active')

    // NAWS: send window size when option becomes active
    if (option === NAWS) {
      iacLogger('→ SB NAWS %dx%d', this.cols, this.rows)
      responses.push(this.encodeNaws(this.cols, this.rows))
    }
  }

  private handleWill(option: number, responses: Buffer[]): void {
    const name = OPTION_NAMES.get(option) ?? String(option)
    iacLogger('← WILL %s', name)

    if (SUPPORTED_OPTIONS.has(option)) {
      iacLogger('→ DO %s', name)
      responses.push(Buffer.from([IAC, DO, option]))
    } else {
      iacLogger('→ DONT %s (unsupported)', name)
      responses.push(Buffer.from([IAC, DONT, option]))
    }
  }

  private handleSubnegByte(byte: number): void {
    if (byte === IAC) {
      this.state = ParserState.SubnegotiationGotIAC
    } else {
      this.subnegBuffer.push(byte)
    }
  }

  private handleSubnegIACByte(byte: number, responses: Buffer[]): void {
    if (byte === SE) {
      this.processSubnegotiation(responses)
      this.state = ParserState.Data
    } else if (byte === IAC) {
      // Escaped 0xFF inside subnegotiation
      this.subnegBuffer.push(0xFF)
      this.state = ParserState.InSubnegotiation
    } else {
      // Unexpected byte after IAC in subneg - treat as end
      this.state = ParserState.Data
    }
  }

  private processSubnegotiation(responses: Buffer[]): void {
    if (this.subnegBuffer.length < 2) {
      return
    }

    const option = this.subnegBuffer[0] as number   // guarded by length >= 2
    const qualifier = this.subnegBuffer[1] as number // guarded by length >= 2
    const name = OPTION_NAMES.get(option) ?? String(option)

    if (option === TERMINAL_TYPE && qualifier === SEND) {
      iacLogger('← SB %s SEND', name)
      iacLogger('→ SB %s IS %s', name, this.terminalType)
      responses.push(this.encodeTerminalType())
    }

    this.subnegBuffer = []
  }
}

// ── Module-level helpers ─────────────────────────────────────────────

/**
 * Append a byte to the array, doubling it if it equals 0xFF (IAC escape).
 */
function appendEscaped(bytes: number[], value: number): void {
  if (value === IAC) {
    bytes.push(IAC, IAC)
  } else {
    bytes.push(value)
  }
}
