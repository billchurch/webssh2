declare module 'basic-auth' {
  import type { IncomingMessage } from 'http'
  interface Credentials { name?: string; pass?: string }
  export default function basicAuth(req: IncomingMessage): Credentials | undefined
}
