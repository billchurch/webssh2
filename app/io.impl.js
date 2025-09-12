// Flip helper: runtime implementation shim for io
// Re-export from the original JS implementation under a stable name
// that TS mirror can target without circular import issues.
export { configureSocketIO } from './io.impl.target.js'
