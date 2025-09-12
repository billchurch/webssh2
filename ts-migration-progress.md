# Migration Progress

- Total source files: 58
- TypeScript files: 29 (50%)
- JavaScript files: 29
- explicit 'any' uses (TS): 0

## Areas
- [x] Constants
- [x] Utils
- [x] Config + Env
- [x] Socket handlers (contracts v1 present)
- [x] Routes
- [x] Entry/Packaging

## TypeScript Flags
### tsconfig.json
```json
{
  "strict": true,
  "noImplicitAny": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "useUnknownInCatchVariables": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```
### tsconfig.build.json
```json
{
  "strict": true,
  "noImplicitAny": true,
  "exactOptionalPropertyTypes": true,
  "noUncheckedIndexedAccess": true,
  "noImplicitOverride": true,
  "useUnknownInCatchVariables": true,
  "noImplicitReturns": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true,
  "noFallthroughCasesInSwitch": true
}
```

CI typecheck gate enabled: yes
