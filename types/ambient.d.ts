declare module 'jsmasker' {
  const maskObject: (obj: unknown, options?: unknown) => unknown
  export default maskObject
}

declare module './app/configSchema.js' {
  const schema: unknown
  export default schema
}

declare module './configSchema.js' {
  const schema: unknown
  export default schema
}

