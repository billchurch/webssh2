// Ambient declarations for `validator/lib/<fn>` subpath imports.
//
// `validator` ships no types of its own; `@types/validator` only publishes
// declarations for the package root (`node_modules/@types/validator/index.d.ts`).
// Under `moduleResolution: NodeNext`, TypeScript does not mirror deep/subpath
// imports of a runtime package onto a separate `@types/*` package's matching
// subpath (only the package root gets that fallback), so
// `import isIP from 'validator/lib/isIP.js'` fails with TS2307 even though
// the file exists on disk and resolves fine at runtime. These declarations
// close that gap for the specific functions this codebase imports by
// subpath, mirroring the real signatures from `@types/validator`.
//
// IMPORTANT: the module specifiers below are NOT resolution-checked by tsc.
// A `declare module '<anything>'` block is accepted verbatim whether or not
// that path actually exists on disk — tsc will happily typecheck an import
// of a module that doesn't exist at runtime. The `.js` extension on every
// specifier here is load-bearing and must exactly match the extension used
// in the corresponding `import` statement: this package is
// `"type": "module"`, `validator` has no `package.json` `exports` map, and
// Node's ESM resolver (unlike CommonJS `require`) does not search for
// extensions on bare/deep specifiers — an extensionless
// `validator/lib/isIP` import throws `ERR_MODULE_NOT_FOUND` at runtime even
// though it typechecks fine. If you add another subpath here, verify it
// actually resolves at runtime (see the runtime import check in
// task-3-report.md) — tsc will not catch a mismatch for you.
declare module 'validator/lib/isIP.js' {
  import type { IsIPOptions, IPVersion } from 'validator'

  export default function isIP(str: string, versionOrOptions?: IPVersion | IsIPOptions): boolean
}

declare module 'validator/lib/escape.js' {
  export default function escape(input: string): string
}

declare module 'validator/lib/isLength.js' {
  import type { IsLengthOptions } from 'validator'

  export default function isLength(str: string, minOrOptions?: number | IsLengthOptions): boolean
}

declare module 'validator/lib/matches.js' {
  export default function matches(str: string, pattern: RegExp | string, modifiers?: string): boolean
}

declare module 'validator/lib/isInt.js' {
  import type { IsIntOptions } from 'validator'

  export default function isInt(str: string, options?: IsIntOptions): boolean
}

declare module 'validator/lib/isPort.js' {
  export default function isPort(str: string): boolean
}
