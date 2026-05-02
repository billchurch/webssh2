# Terminal Theming

WebSSH2 includes an opt-in terminal theming system that lets operators
ship branded color palettes, expose a curated set of built-in themes,
and (optionally) let users paste their own theme JSON in the settings
modal.

## Overview

- **Opt-in.** Theming is disabled by default. Upgrading WebSSH2 does
  not change the observed terminal appearance for any deployment.
- **Three theme sources.** Built-in themes ship with the client.
  Operator-injected themes are supplied via `config.json` or an
  environment variable. Optional user-pasted themes are stored in
  browser `localStorage` only.
- **Validated everywhere.** Server-side validation rejects malformed
  theme entries at startup. Client-side validation blocks malformed
  pasted themes before they reach `localStorage`.
- **Header bar coupling.** Operators can keep the header bar at its
  configured color or follow the active terminal theme.

> **Note:** Theming is **disabled by default**. Set
> `options.theming.enabled` to `true` in `config.json` or
> `WEBSSH2_THEMING_ENABLED=true` to activate it.

## Quick Start

Enable theming with the default built-in palette and let users paste
custom themes:

```bash
WEBSSH2_THEMING_ENABLED=true
```

That single variable is enough. The settings modal will expose the
theme picker pre-populated with all built-in themes, and the custom-theme
paste textarea will be available.

To restrict the picker to a specific subset of built-ins:

```bash
WEBSSH2_THEMING_ENABLED=true
WEBSSH2_THEMING_THEMES="Default,Dracula,Nord,Tokyo Night"
WEBSSH2_THEMING_DEFAULT_THEME="Tokyo Night"
```

## Configuration Matrix

| Field | Default | Effect |
| --- | --- | --- |
| `enabled` | `false` | Master switch. When `false`, the terminal renders with the previous (non-themed) defaults and the modal hides theming controls. |
| `allowCustom` | `true` | When `true` the settings modal exposes a JSON paste textarea. When `false`, users can only choose from the operator-supplied list. |
| `themes` | `null` | Allowlist of built-in theme names. `null` means *all built-ins*. An explicit array (even empty) restricts the picker to only those built-ins. |
| `additionalThemes` | `[]` | Operator-injected themes. Names are namespaced separately from built-ins; case-insensitive collisions with built-ins are rejected. |
| `defaultTheme` | `"Default"` | The picker's initial value. Must resolve to either a built-in (subject to `themes` filtering) or an entry in `additionalThemes`. |
| `headerBackground` | `"independent"` | Header bar coupling. See below. |

### Built-in Themes

WebSSH2 ships nine built-in themes:

- `Default`
- `Dracula`
- `Nord`
- `Solarized Dark`
- `One Dark`
- `Monokai`
- `Gruvbox Dark`
- `Tokyo Night`
- `Catppuccin Mocha`

Each built-in is reviewed for WCAG AA contrast (≥ 4.5:1 between the
default foreground and background). Solarized Light is intentionally
omitted because it fails this check (4.13:1).

License attribution for the built-ins lives in `THEMES-NOTICES.md` in
the client repository (`webssh2_client`).

### Header Background Coupling

`headerBackground` controls whether the header bar tracks the active
terminal theme:

| Value | Behavior |
| --- | --- |
| `independent` | Header uses the configured `header.background` color. This is the previous (non-themed) behavior. |
| `followTerminal` | Header background tracks the active terminal theme's background color. |
| `locked` | Same as `independent`; reserved for a future "always honor configured value, even when followTerminal would otherwise apply" mode. |

## Shipping a Branded Theme

Operators can inject branded themes via
`WEBSSH2_THEMING_ADDITIONAL_THEMES` (base64-encoded JSON array) or via
`config.json`'s `options.theming.additionalThemes` array. The example
below uses the env var.

### Step 1 — author the theme JSON

```json
[
  {
    "name": "Acme Corp",
    "license": "Proprietary - Acme Corp",
    "source": "https://internal.acme.example/themes/acme-corp",
    "colors": {
      "background": "#0b1220",
      "foreground": "#e6edf3",
      "cursor": "#58a6ff",
      "selectionBackground": "#1f6feb",
      "black": "#1f2937",
      "red": "#f87171",
      "green": "#4ade80",
      "yellow": "#fde047",
      "blue": "#60a5fa",
      "magenta": "#c084fc",
      "cyan": "#67e8f9",
      "white": "#e6edf3",
      "brightBlack": "#475569",
      "brightRed": "#fca5a5",
      "brightGreen": "#86efac",
      "brightYellow": "#fef08a",
      "brightBlue": "#93c5fd",
      "brightMagenta": "#d8b4fe",
      "brightCyan": "#a5f3fc",
      "brightWhite": "#f8fafc"
    }
  }
]
```

### Step 2 — base64-encode the JSON

```bash
printf '[{"name":"Acme Corp","colors":{"background":"#0b1220","foreground":"#e6edf3","cursor":"#58a6ff"}}]' | base64
```

Sample output (truncated colors for brevity):

```text
W3sibmFtZSI6IkFjbWUgQ29ycCIsImNvbG9ycyI6eyJiYWNrZ3JvdW5kIjoiIzBiMTIyMCIsImZv
cmVncm91bmQiOiIjZTZlZGYzIiwiY3Vyc29yIjoiIzU4YTZmZiJ9fV0=
```

### Step 3 — set the env vars and restart

```bash
WEBSSH2_THEMING_ENABLED=true
WEBSSH2_THEMING_ADDITIONAL_THEMES="W3sibmFtZSI6IkFjbWUgQ29ycCIsImNvbG9ycyI6eyJiYWNrZ3JvdW5kIjoiIzBiMTIyMCIsImZvcmVncm91bmQiOiIjZTZlZGYzIiwiY3Vyc29yIjoiIzU4YTZmZiJ9fV0="
WEBSSH2_THEMING_DEFAULT_THEME="Acme Corp"
```

Restart WebSSH2 and confirm the new theme is selected by default in the
settings modal. Validation failures are dropped silently at startup
(empty `additionalThemes` is the safe fallback) — see
*Failure-mode logging* below.

### Equivalent `config.json`

```json
{
  "options": {
    "theming": {
      "enabled": true,
      "allowCustom": true,
      "defaultTheme": "Acme Corp",
      "headerBackground": "independent",
      "additionalThemes": [
        {
          "name": "Acme Corp",
          "license": "Proprietary - Acme Corp",
          "source": "https://internal.acme.example/themes/acme-corp",
          "colors": {
            "background": "#0b1220",
            "foreground": "#e6edf3",
            "cursor": "#58a6ff"
          }
        }
      ]
    }
  }
}
```

## Validator Rules

Every theme entry — built-in, operator-injected, or user-pasted —
passes the same validator. Failed entries are rejected; the surrounding
configuration is left intact.

### Theme name

- Must match `/^[\w .\-()]{1,64}$/u`.
  - Allowed: word characters, space, `.`, `-`, `(`, `)`.
  - Disallowed: `/`, `\`, control chars, anything > 64 chars.
- Reserved names (case-insensitive after canonicalization):
  `default`, `custom`. These are sentinel labels used by the modal.
- Operator-injected names that collide with a built-in
  (case-insensitive) are rejected.
- Names are NFKC-normalized, trimmed, and internal whitespace is
  collapsed before comparison.

### Colors

- The `colors` object is required.
- All values must be hex strings: `#rgb`, `#rrggbb`, or `#rrggbbaa`.
- Only these keys are accepted (everything else is rejected as
  "unknown color key"):

```text
background          foreground          cursor              cursorAccent
selectionBackground selectionForeground selectionInactiveBackground
black               red                 green               yellow
blue                magenta             cyan                white
brightBlack         brightRed           brightGreen         brightYellow
brightBlue          brightMagenta       brightCyan          brightWhite
```

- The validator iterates the allowlist (not the input keys), which
  blocks prototype-pollution payloads (`__proto__`, `constructor`,
  `prototype`).

### Optional metadata

- `license` (≤ 256 chars, alphanumerics + `.`, `,`, `-`, `(`, `)`,
  `@`, `/`, `+`, `:`, space). Script-bait sequences like `<script` or
  `<!--` are rejected.
- `source` (URL string). Must be a valid `https:` URL ≤ 256 chars.

### Size cap

- The serialized JSON for a single theme must be ≤ 4 KiB. Larger
  entries are rejected.

### Windows Terminal compatibility (client only)

The client validator auto-converts a few Windows Terminal field names
during paste:

- `purple` → `magenta`, `brightPurple` → `brightMagenta`
- `cursorColor` → `cursor`

Non-hex named CSS colors, RGB tuples, etc. are rejected by the
operator-side validator. The client validator is intentionally a strict
superset of the server validator — anything the server accepts, the
client accepts.

## Security Model

- **Operator-controlled by default.** Themes injected via env var or
  `config.json` are admin-controlled. Validation runs at startup; the
  resulting allowlist is the only thing handed to the client.
- **`allowCustom: false` removes the user input surface.** When set,
  the modal renders only the picker — there is no JSON paste textarea
  and no path for a user to introduce a theme the operator did not
  approve.
- **Custom themes never leave the browser.** When `allowCustom: true`,
  user-pasted themes are stored in `localStorage` on the client only.
  They are not sent over the wire to the server, not logged, and not
  shared between tabs/sessions for other users.
- **Prototype-pollution payloads are blocked.** Keys named
  `__proto__`, `constructor`, or `prototype` cause the entry to be
  rejected outright.
- **Script-bait blocked in metadata.** Strings matching
  `<script` or `<!--` in `license` or `source` cause rejection.
- **No raw color values logged.** The masked-config logger
  (`maskSensitiveConfig`) emits only `themesCount` and
  `additionalThemesCount` — never the underlying color JSON or theme
  names.
- **License attribution.** Built-in MIT-licensed sources are recorded
  in `THEMES-NOTICES.md` in the client repository.

## Failure-mode Logging

Theming is designed to never fail startup. If a theme entry is
malformed, the entry is dropped and the rest of the configuration
loads normally. Specific failure modes:

| Scenario | Behavior |
| --- | --- |
| `WEBSSH2_THEMING_ADDITIONAL_THEMES` not valid base64 | `additionalThemes` is set to `[]`. |
| Decoded payload exceeds 64 KiB total | `additionalThemes` is set to `[]`. |
| Decoded payload is not valid JSON | `additionalThemes` is set to `[]`. |
| Decoded JSON is not an array | `additionalThemes` is set to `[]`. |
| Individual theme entry fails validation | That entry is dropped; valid entries in the same array are kept. |
| Duplicate names within `additionalThemes` | Subsequent duplicates are dropped; the first occurrence wins. |
| `WEBSSH2_THEMING_THEMES` contains an invalid name | That token is filtered out before the allowlist is applied. |
| `WEBSSH2_THEMING_DEFAULT_THEME` fails the name regex | Falls back to `"Default"`. |
| `WEBSSH2_THEMING_HEADER_BACKGROUND` is not one of the three valid values | Field is left at its existing value (default `independent`). |

The `maskSensitiveConfig` startup log line includes the
`additionalThemesCount` and `themesCount` fields, so operators can
verify how many entries actually loaded after validation.

> **Note:** Per-entry validation failures from
> `WEBSSH2_THEMING_ADDITIONAL_THEMES` are not emitted as structured
> log entries in the current release. If you suspect entries are
> being dropped, compare your input array length against the
> `additionalThemesCount` reported in the startup log.

## Troubleshooting

### Picker is empty / shows only "Default"

- Check that `options.theming.themes` is `null` or contains the names
  you expect. An explicit empty array filters out every built-in.
- Verify built-in names are spelled exactly as listed above
  (case-insensitive matching is performed, but typos like
  `"Tokyonight"` will not match `"Tokyo Night"`).

### Pasted theme not saved (custom theme)

- The pasted JSON must be a valid theme object (not an array).
- Required: a `name` matching `/^[\w .\-()]{1,64}$/u` and a `colors`
  object containing only known keys with hex string values.
- Reserved names `default` and `custom` are rejected.
- The modal shows an inline validation error when the paste is invalid.
- The pasted theme is stored in `localStorage` only — clearing site
  data removes it.

### Header bar didn't change color

- Set `headerBackground: "followTerminal"` in `config.json` or
  `WEBSSH2_THEMING_HEADER_BACKGROUND=followTerminal`.
- The default value is `independent`, which retains the previous
  behavior of using `header.background`.
- Theming must also be enabled (`enabled: true`).

### "My branded theme isn't there after restart"

- Check that the JSON was base64-encoded without any line-wrapping
  introduced by your shell. `printf '...' | base64` on macOS/Linux
  works; some `base64` implementations wrap at 76 chars by default —
  pass `-w 0` (GNU coreutils) or pipe through `tr -d '\n'`.
- Each theme entry must be ≤ 4 KiB serialized, and the full decoded
  payload must be ≤ 64 KiB.
- Names that collide with a built-in (case-insensitively) are
  rejected. Pick a distinct name like `"Acme Corp Dark"` instead of
  `"Default"`.

## Reference

- [`CONFIG-JSON.md`](../configuration/CONFIG-JSON.md) — full
  `options.theming` schema with examples.
- [`ENVIRONMENT-VARIABLES.md`](../configuration/ENVIRONMENT-VARIABLES.md) —
  the six `WEBSSH2_THEMING_*` environment variables.
- `THEMES-NOTICES.md` (in the `webssh2_client` repository) — license
  attribution for the built-in themes.
