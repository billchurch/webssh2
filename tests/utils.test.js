// server
// tests/utils.test.js

const {
  deepMerge,
  getValidatedHost,
  getValidatedPort,
  isValidCredentials,
  maskSensitiveData,
  modifyHtml,
  validateConfig,
  validateSshTerm
} = require("../app/utils")

describe("utils", () => {
  describe("deepMerge", () => {
    it("should merge two objects deeply", () => {
      const obj1 = { a: { b: 1 }, c: 2 }
      const obj2 = { a: { d: 3 }, e: 4 }
      const result = deepMerge(obj1, obj2)
      expect(result).toEqual({ a: { b: 1, d: 3 }, c: 2, e: 4 })
    })
  })

  describe("getValidatedHost", () => {
    it("should return IP address unchanged", () => {
      expect(getValidatedHost("192.168.1.1")).toBe("192.168.1.1")
    })

    it("should escape hostname", () => {
      expect(getValidatedHost("example.com")).toBe("example.com")
      expect(getValidatedHost("<script>alert('xss')</script>")).toBe(
        "&lt;script&gt;alert(&#x27;xss&#x27;)&lt;&#x2F;script&gt;"
      )
    })
  })

  describe("getValidatedPort", () => {
    it("should return valid port number", () => {
      expect(getValidatedPort("22")).toBe(22)
      expect(getValidatedPort("8080")).toBe(8080)
    })

    it("should return default port for invalid input", () => {
      expect(getValidatedPort("invalid")).toBe(22)
      expect(getValidatedPort("0")).toBe(22)
      expect(getValidatedPort("65536")).toBe(22)
    })
  })

  describe("isValidCredentials", () => {
    it("should return true for valid credentials", () => {
      const validCreds = {
        username: "user",
        password: "pass",
        host: "example.com",
        port: 22
      }
      expect(isValidCredentials(validCreds)).toBe(true)
    })

    it("should return false for invalid credentials", () => {
      expect(isValidCredentials(null)).toBe(false)
      expect(isValidCredentials({})).toBe(false)
      expect(isValidCredentials({ username: "user" })).toBe(false)
    })
  })

  describe("maskSensitiveData", () => {
    it("should mask sensitive data", () => {
      const data = {
        username: "user",
        password: "secret",
        token: "12345"
      }
      const masked = maskSensitiveData(data)
      expect(masked.username).toBe("user")
      expect(masked.password).not.toBe("secret")
      expect(masked.token).not.toBe("12345")
    })
  })

  describe("modifyHtml", () => {
    it("should modify HTML content", () => {
      const html = "window.webssh2Config = null;"
      const config = { key: "value" }
      const content = `window.webssh2Config = ${JSON.stringify(config)};`
      const modified = modifyHtml(html, config)
      expect(modified).toContain('window.webssh2Config = {"key":"value"};')
    })
  })

  describe("validateConfig", () => {
    it("should validate correct config", () => {
      const validConfig = {
        listen: {
          ip: "0.0.0.0",
          port: 2222
        },
        http: {
          origins: ["http://localhost:8080"]
        },
        user: {
          name: null,
          password: null,
          privatekey: null
        },
        ssh: {
          host: null,
          port: 22,
          localAddress: null,
          localPort: null,
          term: "xterm-color",
          readyTimeout: 20000,
          keepaliveInterval: 120000,
          keepaliveCountMax: 10,
          allowedSubnets: []
        },
        header: {
          text: null,
          background: "green"
        },
        options: {
          challengeButton: true,
          autoLog: false,
          allowReauth: true,
          allowReconnect: true,
          allowReplay: true
        },
        algorithms: {
          kex: [
            "ecdh-sha2-nistp256",
            "ecdh-sha2-nistp384",
            "ecdh-sha2-nistp521",
            "diffie-hellman-group-exchange-sha256",
            "diffie-hellman-group14-sha1"
          ],
          cipher: [
            "aes128-ctr",
            "aes192-ctr",
            "aes256-ctr",
            "aes128-gcm",
            "aes128-gcm@openssh.com",
            "aes256-gcm",
            "aes256-gcm@openssh.com",
            "aes256-cbc"
          ],
          hmac: ["hmac-sha2-256", "hmac-sha2-512", "hmac-sha1"],
          compress: ["none", "zlib@openssh.com", "zlib"]
        }
      }

      expect(() => validateConfig(validConfig)).not.toThrow()
    })

    it("should throw error for invalid config", () => {
      const invalidConfig = {}
      expect(() => validateConfig(invalidConfig)).toThrow()
    })
  })

  describe("validateSshTerm", () => {
    it("should return valid SSH term", () => {
      expect(validateSshTerm("xterm")).toBe("xterm")
      expect(validateSshTerm("xterm-256color")).toBe("xterm-256color")
    })

    it("should return null for invalid SSH term", () => {
      expect(validateSshTerm("")).toBe(null)
      expect(validateSshTerm("<script>alert('xss')</script>")).toBe(null)
    })
  })
})
