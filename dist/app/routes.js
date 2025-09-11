// server
// app/routes.ts
// Type-only mirror that re-exports JS implementation without changing runtime
import * as Impl from './routes.impl.js';
// Re-export helpers with explicit types, delegating to JS implementation
export const processHeaderParameters = Impl.processHeaderParameters;
export const processEnvironmentVariables = Impl.processEnvironmentVariables;
export const setupSshCredentials = Impl.setupSshCredentials;
export const processSessionRecordingParams = Impl.processSessionRecordingParams;
export const handleRouteError = Impl.handleRouteError;
// Main factory re-export with strong typing
export const createRoutes = Impl.createRoutes;
