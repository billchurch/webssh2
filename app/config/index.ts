// app/config/index.ts
// Central export for configuration modules

export {
  ALGORITHM_PRESETS,
  getAlgorithmPreset,
  getPresetNames,
  isValidPreset,
  type Algorithms,
} from './algorithm-presets.js'

export {
  parseArrayValue,
  parseEnvValue,
  parseBooleanEnv,
  parseNumberEnv,
  type EnvValueType,
} from './env-parser.js'

export {
  ENV_VAR_MAPPING,
  mapEnvironmentVariables,
  setNestedProperty,
  setNestedPropertyImmutable,
  type EnvVarMap,
} from './env-mapper.js'