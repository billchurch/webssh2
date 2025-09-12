import * as Impl from './crypto-utils.impl.js'

export const generateSecureSecret: () => string =
  Impl.generateSecureSecret as unknown as () => string
