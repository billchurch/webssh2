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
    it("should mask simple password property", () => {
      const testObj = { username: "user", password: "secret123" }
      const maskedObj = maskSensitiveData(testObj)
      console.log("maskedObj.password.length: ", maskedObj.password.length)

      expect(maskedObj.username).toBe("user")
      expect(maskedObj.password).not.toBe("secret123")
      expect(maskedObj.password.length).toBeGreaterThanOrEqual(3)
      expect(maskedObj.password.length).toBeLessThanOrEqual(9)
    })

    it("should mask array elements when property is specified", () => {
      const testObj = {
        action: "keyboard-interactive",
        responses: ["sensitive_password", "another_sensitive_value"]
      }
      const maskedObj = maskSensitiveData(testObj, {
        properties: ["responses"]
      })

      expect(maskedObj.action).toBe("keyboard-interactive")
      expect(Array.isArray(maskedObj.responses)).toBe(true)
      expect(maskedObj.responses).toHaveLength(2)
      expect(maskedObj.responses[0]).not.toBe("sensitive_password")
      expect(maskedObj.responses[1]).not.toBe("another_sensitive_value")
      expect(maskedObj.responses[0]).toHaveLength(8)
      expect(maskedObj.responses[1]).toHaveLength(8)
    })

    it("should not mask non-specified properties", () => {
      const testObj = {
        username: "user",
        password: "secret",
        data: ["public_info", "not_sensitive"]
      }
      const maskedObj = maskSensitiveData(testObj, {
        properties: ["password"]
      })

      expect(maskedObj.username).toBe("user")
      expect(maskedObj.password).not.toBe("secret")
      expect(maskedObj.data).toEqual(["public_info", "not_sensitive"])
    })

    it("should handle nested objects", () => {
      const testObj = {
        user: {
          name: "John",
          credentials: {
            password: "topsecret",
            token: "abcdef123456"
          }
        }
      }
      const maskedObj = maskSensitiveData(testObj)

      expect(maskedObj.user.name).toBe("John")
      expect(maskedObj.user.credentials.password).not.toBe("topsecret")
      expect(maskedObj.user.credentials.token).not.toBe("abcdef123456")
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
