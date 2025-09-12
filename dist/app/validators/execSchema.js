// TypeScript mirror for exec payload validation schema
// Delegates runtime to JS implementation via impl shim
import * as Impl from './execSchema.impl.js';
export const execSchema = Impl.execSchema;
