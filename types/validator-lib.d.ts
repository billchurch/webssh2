// Ambient declarations for `validator/lib/<fn>` subpath imports.
//
// `validator` ships no types of its own; `@types/validator` only publishes
// declarations for the package root (`node_modules/@types/validator/index.d.ts`).
// Under `moduleResolution: NodeNext`, TypeScript does not mirror deep/subpath
// imports of a runtime package onto a separate `@types/*` package's matching
// subpath (only the package root gets that fallback), so
// `import isIP from 'validator/lib/isIP'` fails with TS2307 even though the
// file exists on disk and resolves fine at runtime. These declarations close
// that gap for the specific functions this codebase imports by subpath,
// mirroring the real signatures from `@types/validator`.
declare module 'validator/lib/isIP' {
  import type { IsIPOptions, IPVersion } from 'validator'

  export default function isIP(str: string, versionOrOptions?: IPVersion | IsIPOptions): boolean
}

declare module 'validator/lib/escape' {
  export default function escape(input: string): string
}

declare module 'validator/lib/isLength' {
  import type { IsLengthOptions } from 'validator'

  export default function isLength(str: string, minOrOptions?: number | IsLengthOptions): boolean
}

declare module 'validator/lib/matches' {
  export default function matches(str: string, pattern: RegExp | string, modifiers?: string): boolean
}

declare module 'validator/lib/isInt' {
  import type { IsIntOptions } from 'validator'

  export default function isInt(str: string, options?: IsIntOptions): boolean
}

declare module 'validator/lib/isPort' {
  export default function isPort(str: string): boolean
}
