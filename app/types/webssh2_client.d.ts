// Type declaration for webssh2_client module
declare module 'webssh2_client' {
  interface WebSSH2Client {
    getPublicPath(): string;
  }
  
  const webssh2Client: WebSSH2Client;
  export = webssh2Client;
}