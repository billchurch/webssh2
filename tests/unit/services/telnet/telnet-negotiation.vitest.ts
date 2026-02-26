import { describe, it, expect } from 'vitest'
import { TelnetNegotiator, IAC, DO, DONT, WILL, WONT, SB, SE, ECHO, SGA, NAWS, TERMINAL_TYPE, SEND, IS } from '../../../../app/services/telnet/telnet-negotiation.js'

describe('TelnetNegotiator', () => {
  describe('processInbound - strip IAC sequences from mixed data', () => {
    it('should pass through clean data unchanged when no IAC sequences present', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from('Hello, world!')
      const result = negotiator.processInbound(input)

      expect(result.cleanData.toString()).toBe('Hello, world!')
      expect(result.responses).toHaveLength(0)
    })

    it('should strip IAC sequences from mixed data and return only clean data', () => {
      const negotiator = new TelnetNegotiator()
      // "Hi" + IAC DO ECHO + "there"
      const input = Buffer.from([
        0x48, 0x69,        // "Hi"
        IAC, DO, ECHO,     // IAC DO ECHO
        0x74, 0x68, 0x65, 0x72, 0x65, // "there"
      ])
      const result = negotiator.processInbound(input)

      expect(result.cleanData.toString()).toBe('Hithere')
      expect(result.responses.length).toBeGreaterThan(0)
    })
  })

  describe('processInbound - DO negotiations', () => {
    it('should respond WILL ECHO when server sends DO ECHO', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, DO, ECHO])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, WILL, ECHO]))
    })

    it('should respond WILL SGA when server sends DO SGA', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, DO, SGA])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, WILL, SGA]))
    })

    it('should respond WONT for unsupported DO option', () => {
      const negotiator = new TelnetNegotiator()
      const unsupportedOption = 50
      const input = Buffer.from([IAC, DO, unsupportedOption])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, WONT, unsupportedOption]))
    })

    it('should respond WILL TERMINAL_TYPE when server sends DO TERMINAL_TYPE', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, DO, TERMINAL_TYPE])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, WILL, TERMINAL_TYPE]))
    })
  })

  describe('processInbound - WILL negotiations', () => {
    it('should respond DO for supported WILL option', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, WILL, ECHO])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, DO, ECHO]))
    })

    it('should respond DONT for unsupported WILL option', () => {
      const negotiator = new TelnetNegotiator()
      const unsupportedOption = 50
      const input = Buffer.from([IAC, WILL, unsupportedOption])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, DONT, unsupportedOption]))
    })
  })

  describe('processInbound - DO NAWS triggers WILL NAWS + NAWS size report', () => {
    it('should respond with WILL NAWS and immediately send NAWS size', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, DO, NAWS])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      // Should have two responses: WILL NAWS + NAWS subnegotiation
      expect(result.responses).toHaveLength(2)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, WILL, NAWS]))
      // Default size is 80x24
      expect(result.responses[1]).toEqual(
        Buffer.from([IAC, SB, NAWS, 0, 80, 0, 24, IAC, SE])
      )
    })
  })

  describe('processInbound - terminal type subnegotiation', () => {
    it('should respond to terminal type SEND subnegotiation', () => {
      const negotiator = new TelnetNegotiator('xterm-256color')
      // IAC SB TERMINAL_TYPE SEND IAC SE
      const input = Buffer.from([IAC, SB, TERMINAL_TYPE, SEND, IAC, SE])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)

      // Expected: IAC SB TERMINAL_TYPE IS <term-bytes> IAC SE
      const termBytes = Buffer.from('xterm-256color', 'ascii')
      const expected = Buffer.concat([
        Buffer.from([IAC, SB, TERMINAL_TYPE, IS]),
        termBytes,
        Buffer.from([IAC, SE]),
      ])
      expect(result.responses[0]).toEqual(expected)
    })

    it('should use default terminal type vt100 when not specified', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, SB, TERMINAL_TYPE, SEND, IAC, SE])
      const result = negotiator.processInbound(input)

      expect(result.responses).toHaveLength(1)
      const termBytes = Buffer.from('vt100', 'ascii')
      const expected = Buffer.concat([
        Buffer.from([IAC, SB, TERMINAL_TYPE, IS]),
        termBytes,
        Buffer.from([IAC, SE]),
      ])
      expect(result.responses[0]).toEqual(expected)
    })
  })

  describe('processInbound - IAC IAC escape', () => {
    it('should decode IAC IAC (0xFF 0xFF) as single 0xFF in clean data', () => {
      const negotiator = new TelnetNegotiator()
      // "A" + IAC IAC + "B"
      const input = Buffer.from([0x41, IAC, IAC, 0x42])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toEqual(Buffer.from([0x41, 0xFF, 0x42]))
      expect(result.responses).toHaveLength(0)
    })
  })

  describe('processInbound - partial IAC at buffer boundary', () => {
    it('should buffer incomplete IAC sequence and complete on next call', () => {
      const negotiator = new TelnetNegotiator()

      // First chunk: data + IAC with no following byte
      const chunk1 = Buffer.from([0x41, 0x42, IAC])
      const result1 = negotiator.processInbound(chunk1)
      expect(result1.cleanData).toEqual(Buffer.from([0x41, 0x42]))
      expect(result1.responses).toHaveLength(0)

      // Second chunk: the rest of the IAC DO ECHO
      const chunk2 = Buffer.from([DO, ECHO, 0x43])
      const result2 = negotiator.processInbound(chunk2)
      expect(result2.cleanData).toEqual(Buffer.from([0x43]))
      expect(result2.responses).toHaveLength(1)
      expect(result2.responses[0]).toEqual(Buffer.from([IAC, WILL, ECHO]))
    })

    it('should buffer partial IAC DO at boundary (IAC DO but no option byte)', () => {
      const negotiator = new TelnetNegotiator()

      // First chunk: IAC DO (missing option byte)
      const chunk1 = Buffer.from([IAC, DO])
      const result1 = negotiator.processInbound(chunk1)
      expect(result1.cleanData).toHaveLength(0)
      expect(result1.responses).toHaveLength(0)

      // Second chunk: the option byte + data
      const chunk2 = Buffer.from([ECHO, 0x44])
      const result2 = negotiator.processInbound(chunk2)
      expect(result2.cleanData).toEqual(Buffer.from([0x44]))
      expect(result2.responses).toHaveLength(1)
      expect(result2.responses[0]).toEqual(Buffer.from([IAC, WILL, ECHO]))
    })

    it('should buffer partial subnegotiation at boundary', () => {
      const negotiator = new TelnetNegotiator()

      // First chunk: IAC SB TERMINAL_TYPE SEND (missing IAC SE)
      const chunk1 = Buffer.from([IAC, SB, TERMINAL_TYPE, SEND])
      const result1 = negotiator.processInbound(chunk1)
      expect(result1.cleanData).toHaveLength(0)
      expect(result1.responses).toHaveLength(0)

      // Second chunk: IAC SE to close subnegotiation
      const chunk2 = Buffer.from([IAC, SE])
      const result2 = negotiator.processInbound(chunk2)
      expect(result2.cleanData).toHaveLength(0)
      expect(result2.responses).toHaveLength(1)
    })
  })

  describe('encodeNaws', () => {
    it('should encode NAWS correctly for cols=80, rows=24', () => {
      const negotiator = new TelnetNegotiator()
      const result = negotiator.encodeNaws(80, 24)

      expect(result).toEqual(
        Buffer.from([IAC, SB, NAWS, 0, 80, 0, 24, IAC, SE])
      )
    })

    it('should encode NAWS with high byte for large dimensions', () => {
      const negotiator = new TelnetNegotiator()
      // cols=256 → high=1, low=0
      const result = negotiator.encodeNaws(256, 50)

      expect(result).toEqual(
        Buffer.from([IAC, SB, NAWS, 1, 0, 0, 50, IAC, SE])
      )
    })

    it('should escape byte value 0xFF in NAWS encoding', () => {
      const negotiator = new TelnetNegotiator()
      // cols=255 (0xFF) must be escaped as 0xFF 0xFF
      const result = negotiator.encodeNaws(255, 24)

      // Width: high=0, low=0xFF → escaped as 0xFF 0xFF
      expect(result).toEqual(
        Buffer.from([IAC, SB, NAWS, 0, IAC, IAC, 0, 24, IAC, SE])
      )
    })

    it('should escape 0xFF in high byte of dimensions', () => {
      const negotiator = new TelnetNegotiator()
      // cols=65535 (0xFF, 0xFF) → both bytes must be escaped
      const result = negotiator.encodeNaws(65535, 24)

      expect(result).toEqual(
        Buffer.from([IAC, SB, NAWS, IAC, IAC, IAC, IAC, 0, 24, IAC, SE])
      )
    })

    it('should escape 0xFF in row bytes', () => {
      const negotiator = new TelnetNegotiator()
      // rows=255 (0x00, 0xFF)
      const result = negotiator.encodeNaws(80, 255)

      expect(result).toEqual(
        Buffer.from([IAC, SB, NAWS, 0, 80, 0, IAC, IAC, IAC, SE])
      )
    })
  })

  describe('encodeTerminalType', () => {
    it('should encode terminal type subnegotiation response', () => {
      const negotiator = new TelnetNegotiator('vt100')
      const result = negotiator.encodeTerminalType()

      const termBytes = Buffer.from('vt100', 'ascii')
      const expected = Buffer.concat([
        Buffer.from([IAC, SB, TERMINAL_TYPE, IS]),
        termBytes,
        Buffer.from([IAC, SE]),
      ])
      expect(result).toEqual(expected)
    })

    it('should encode custom terminal type', () => {
      const negotiator = new TelnetNegotiator('xterm-256color')
      const result = negotiator.encodeTerminalType()

      const termBytes = Buffer.from('xterm-256color', 'ascii')
      const expected = Buffer.concat([
        Buffer.from([IAC, SB, TERMINAL_TYPE, IS]),
        termBytes,
        Buffer.from([IAC, SE]),
      ])
      expect(result).toEqual(expected)
    })
  })

  describe('processInbound - multiple IAC sequences in one buffer', () => {
    it('should handle multiple DO commands in one buffer', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([
        IAC, DO, ECHO,
        IAC, DO, SGA,
        IAC, DO, TERMINAL_TYPE,
      ])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(3)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, WILL, ECHO]))
      expect(result.responses[1]).toEqual(Buffer.from([IAC, WILL, SGA]))
      expect(result.responses[2]).toEqual(Buffer.from([IAC, WILL, TERMINAL_TYPE]))
    })
  })

  describe('processInbound - DONT and WONT commands', () => {
    it('should respond WONT to DONT', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, DONT, ECHO])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, WONT, ECHO]))
    })

    it('should respond DONT to WONT', () => {
      const negotiator = new TelnetNegotiator()
      const input = Buffer.from([IAC, WONT, ECHO])
      const result = negotiator.processInbound(input)

      expect(result.cleanData).toHaveLength(0)
      expect(result.responses).toHaveLength(1)
      expect(result.responses[0]).toEqual(Buffer.from([IAC, DONT, ECHO]))
    })
  })
})
