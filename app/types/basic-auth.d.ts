// Type declaration for basic-auth module
declare module 'basic-auth' {
  import type { IncomingMessage } from 'http';
  
  interface Credentials {
    name: string;
    pass: string;
  }
  
  function basicAuth(req: IncomingMessage): Credentials | undefined;
  export = basicAuth;
}