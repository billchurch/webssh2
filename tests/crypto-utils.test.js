// server
// tests/crypto-utils.test.js

const { generateSecureSecret } = require("../app/crypto-utils")

describe("generateSecureSecret", () => {
  it("should generate a 64-character hex string", () => {
    const secret = generateSecureSecret()
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
  })
})
