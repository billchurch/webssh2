// Flip helper: runtime implementation shim for validators/execSchema
// Re-export from the original JS implementation under a stable name
// that TS mirror can target without circular import issues.
export { execSchema } from './execSchema.impl.target.js'

