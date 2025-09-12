declare module 'webssh2_client' {
  export function getPublicPath(): string
  const api: { getPublicPath: typeof getPublicPath }
  export default api
}
