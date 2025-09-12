// Flip helper: runtime implementation shim for connectionHandler
// Re-exports default from the original JS implementation under a stable name
// that TS mirror can target without circular import issues.
export { default } from './connectionHandler.impl.target.js'
