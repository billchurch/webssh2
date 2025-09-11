// server
// app/socket.ts
// Type-only mirror that re-exports JS implementation without changing runtime
import impl from './socket.impl.js';
// Default initializer with strong types; delegates to JS implementation
export default function init(io, config, SSHConnectionClass) {
    // Cast through unknown to avoid changing runtime while preserving types
    ;
    impl(io, config, SSHConnectionClass);
}
