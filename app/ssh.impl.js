// Flip helper: runtime implementation shim for ssh
// Re-export default from the original JS implementation under a stable name
// that TS mirror can target without circular import issues.
export { default } from './ssh.impl.target.js'
