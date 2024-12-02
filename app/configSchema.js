/**
 * Schema for validating the config
 */
const configSchema = {
  type: "object",
  properties: {
    listen: {
      type: "object",
      properties: {
        ip: { type: "string", format: "ipv4" },
        port: { type: "integer", minimum: 1, maximum: 65535 }
      },
      required: ["ip", "port"]
    },
    http: {
      type: "object",
      properties: {
        origins: {
          type: "array",
          items: { type: "string" }
        }
      },
      required: ["origins"]
    },
    user: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        password: { type: ["string", "null"] },
        privateKey: { type: ["string", "null"] }
      },
      required: ["name", "password"]
    },
    ssh: {
      type: "object",
      properties: {
        host: { type: ["string", "null"] },
        port: { type: "integer", minimum: 1, maximum: 65535 },
        term: { type: "string" },
        readyTimeout: { type: "integer" },
        keepaliveInterval: { type: "integer" },
        keepaliveCountMax: { type: "integer" },
        algorithms: {
          type: "object",
          properties: {
            kex: {
              type: "array",
              items: { type: "string" }
            },
            cipher: {
              type: "array",
              items: { type: "string" }
            },
            hmac: {
              type: "array",
              items: { type: "string" }
            },
            serverHostKey: {
              type: "array",
              items: { type: "string" }
            },
            compress: {
              type: "array",
              items: { type: "string" }
            }
          },
          required: ["kex", "cipher", "hmac", "serverHostKey", "compress"]
        }
      },
      required: [
        "host",
        "port",
        "term",
        "readyTimeout",
        "keepaliveInterval",
        "keepaliveCountMax"
      ]
    },
    header: {
      type: "object",
      properties: {
        text: { type: ["string", "null"] },
        background: { type: "string" }
      },
      required: ["text", "background"]
    },
    options: {
      type: "object",
      properties: {
        challengeButton: { type: "boolean" },
        autoLog: { type: "boolean" },
        allowReauth: { type: "boolean" },
        allowReconnect: { type: "boolean" },
        allowReplay: { type: "boolean" }
      },
      required: ["challengeButton", "allowReauth", "allowReplay"]
    },
    session: {
      type: "object",
      properties: {
        secret: { type: "string" },
        name: { type: "string" }
      },
      required: ["secret", "name"]
    }
  },
  required: ["listen", "http", "user", "ssh", "header", "options"]
}
module.exports = configSchema
