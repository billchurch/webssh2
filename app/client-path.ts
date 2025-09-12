import * as Impl from './client-path.impl.js'

export const getClientPublicPath: () => string = Impl.getClientPublicPath as unknown as () => string
