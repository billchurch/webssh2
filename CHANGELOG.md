# Changelog

## [5.2.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v5.1.0...webssh2-server-v5.2.0) (2026-07-30)


### Features

* **config:** shiftEnterNewline option + client config injection ([#558](https://github.com/billchurch/webssh2/issues/558)) ([93cf88d](https://github.com/billchurch/webssh2/commit/93cf88d95347a4a2ba35f42d13b0af725de5cdd8))
* honor operator-configured Socket.IO transport ([#549](https://github.com/billchurch/webssh2/issues/549)) ([#563](https://github.com/billchurch/webssh2/issues/563)) ([4a2747c](https://github.com/billchurch/webssh2/commit/4a2747cae1a95f73976b7d38d0d88a779dcd735b))


### Bug Fixes

* **config:** ignore prototype-member algorithm preset names ([#562](https://github.com/billchurch/webssh2/issues/562)) ([b1df44d](https://github.com/billchurch/webssh2/commit/b1df44d4b28ef4a0306d1643e56fd7f5e10950e4))
* **deps:** upgrade eslint toolchain to clear brace-expansion HIGH advisory ([#559](https://github.com/billchurch/webssh2/issues/559)) ([f883e1d](https://github.com/billchurch/webssh2/commit/f883e1d65138a1be86cbd75ad1de244fc5688e98))
* **docker:** upgrade bundled npm to 11.18.0 to clear npm-CLI CVEs ([#555](https://github.com/billchurch/webssh2/issues/555)) ([b51dda3](https://github.com/billchurch/webssh2/commit/b51dda38c5a5a380e3781f8c9e81be6e158e4e5a))
* **lint:** enable modern-JS unicorn rules and resolve SonarCloud findings ([#557](https://github.com/billchurch/webssh2/issues/557)) ([31a37f8](https://github.com/billchurch/webssh2/commit/31a37f836d94c232724741d8ea29473d2a4ce2e5))
* resolve remaining 37 SonarCloud findings (phases 2-4) ([#560](https://github.com/billchurch/webssh2/issues/560)) ([9a9dbdd](https://github.com/billchurch/webssh2/commit/9a9dbdd01cb522d060457c8a26ddf2ce9747211c))

## [5.1.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v5.0.1...webssh2-server-v5.1.0) (2026-06-17)


### Features

* **http:** cache headers for static assets, no-store for dynamic HTML ([#545](https://github.com/billchurch/webssh2/issues/545)) ([ffe55c3](https://github.com/billchurch/webssh2/commit/ffe55c3ec82fef8208f79f100443e1543c6b8b83)), closes [#537](https://github.com/billchurch/webssh2/issues/537)
* **security:** JSON config-block injection + tightened CSP ([#546](https://github.com/billchurch/webssh2/issues/546)) ([#551](https://github.com/billchurch/webssh2/issues/551)) ([33201a0](https://github.com/billchurch/webssh2/commit/33201a0288072b61dc4800f5b3d5b58d832ae406))
* **security:** verify webssh2_client bundle integrity + provenance ([#547](https://github.com/billchurch/webssh2/issues/547)) ([#553](https://github.com/billchurch/webssh2/issues/553)) ([b4c918e](https://github.com/billchurch/webssh2/commit/b4c918ef8bcdb11350c557c1b487fc32cfdf81df))
* **security:** warn loudly at startup on permissive security defaults ([#542](https://github.com/billchurch/webssh2/issues/542)) ([29f7ba4](https://github.com/billchurch/webssh2/commit/29f7ba40ffbd1f0108eeae9924384c113ea8bf5a))


### Bug Fixes

* **config:** honor WEBSSH2_SESSION_SECRET in fallback, warn on generated secret ([#541](https://github.com/billchurch/webssh2/issues/541)) ([59e34aa](https://github.com/billchurch/webssh2/commit/59e34aa82f2eb0136e7973c55209612aacd555eb))
* **deps:** bump brace-expansion to patched versions ([#540](https://github.com/billchurch/webssh2/issues/540)) ([1868a6d](https://github.com/billchurch/webssh2/commit/1868a6df727f133258391a22841322c4f82b911c)), closes [#538](https://github.com/billchurch/webssh2/issues/538)
* **ssh:** add shared settled guard to connect timeout/ready/error race ([#544](https://github.com/billchurch/webssh2/issues/544)) ([89a5590](https://github.com/billchurch/webssh2/commit/89a55908357416a32ec7c6957349b98ff29fb13c)), closes [#536](https://github.com/billchurch/webssh2/issues/536)

## [5.0.1](https://github.com/billchurch/webssh2/compare/webssh2-server-v5.0.0...webssh2-server-v5.0.1) (2026-05-28)


### ⚠ BREAKING CHANGES

* scripts that invoke --known-hosts to populate the DB must add --commit. Without it the command is a dry-run preview.

### Bug Fixes

* **deps:** override qs to 6.15.2 for CVE-2026-8723 ([#532](https://github.com/billchurch/webssh2/issues/532)) ([9bc30e5](https://github.com/billchurch/webssh2/commit/9bc30e56adfeb90b11ad7c0a60eaac99135bfbe4))
* harden host-key-seed CLI (closes [#528](https://github.com/billchurch/webssh2/issues/528)) ([#531](https://github.com/billchurch/webssh2/issues/531)) ([53c372d](https://github.com/billchurch/webssh2/commit/53c372d1181bde6e1722d50a47212daf6add6858))
* **scripts:** host-key-seed entry-point guard for compiled CLI ([#527](https://github.com/billchurch/webssh2/issues/527)) ([#529](https://github.com/billchurch/webssh2/issues/529)) ([2d6d4ba](https://github.com/billchurch/webssh2/commit/2d6d4ba4421a45633b851d1963ebc234548b9dff))


### Chores

* release webssh2-server 5.0.1 ([9a21bd6](https://github.com/billchurch/webssh2/commit/9a21bd6bf341e15da965e48234d897ca7cf13490))

## [5.0.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v4.2.2...webssh2-server-v5.0.0) (2026-05-24)


### ⚠ BREAKING CHANGES

* **security:** HeaderOverride.style and HeaderValues.color no longer exist on the public types. The header.color POST field and headerStyle GET parameter are silently ignored.

### Features

* **theming:** opt-in server-side theming — config, env, validation, injection ([#513](https://github.com/billchurch/webssh2/issues/513)) ([f7978d1](https://github.com/billchurch/webssh2/commit/f7978d168f045aeeb873de703e30d0a11261b31e))


### Bug Fixes

* **deps:** bump webssh2_client to ^3.7.0 for theming UI support ([#520](https://github.com/billchurch/webssh2/issues/520)) ([0b88c49](https://github.com/billchurch/webssh2/commit/0b88c493c53fd938c43ca356045ba920b89761b7)), closes [#518](https://github.com/billchurch/webssh2/issues/518)
* **deps:** bump webssh2_client to ^4.0.0 for issue [#102](https://github.com/billchurch/webssh2/issues/102) fix ([#524](https://github.com/billchurch/webssh2/issues/524)) ([cf46eb7](https://github.com/billchurch/webssh2/commit/cf46eb74b33702b29fa44d14b155d76b204dcb49))
* **security:** remove header.color and colorToStyle ([#102](https://github.com/billchurch/webssh2/issues/102) + supersedes [#519](https://github.com/billchurch/webssh2/issues/519)) ([#522](https://github.com/billchurch/webssh2/issues/522)) ([ee657d7](https://github.com/billchurch/webssh2/commit/ee657d7581e0f7a7c58d1a4fa6954252f323562e))

## [4.2.2](https://github.com/billchurch/webssh2/compare/webssh2-server-v4.2.1...webssh2-server-v4.2.2) (2026-04-25)


### Bug Fixes

* pin node:22-alpine base image by digest ([#498](https://github.com/billchurch/webssh2/issues/498)) ([#499](https://github.com/billchurch/webssh2/issues/499)) ([ac41510](https://github.com/billchurch/webssh2/commit/ac4151097bc3f32c2440060a0b56e5d2691a5e40))

## [4.2.1](https://github.com/billchurch/webssh2/compare/webssh2-server-v4.2.0...webssh2-server-v4.2.1) (2026-04-07)


### Bug Fixes

* add vite override to resolve HIGH audit finding in CI ([4c20966](https://github.com/billchurch/webssh2/commit/4c20966330534613a90a8f1caa9b918eda1c7c76))
* patch HIGH CVE dependencies and pin versions ([391d64f](https://github.com/billchurch/webssh2/commit/391d64f60c0d04c3dfa3ede98f9858698f269048))
* resolve lint errors blocking CI ([6e576d6](https://github.com/billchurch/webssh2/commit/6e576d6a248155af6caf5d85259f55b291894905))
* sync package-lock.json with webssh2_client 3.6.0 ([eece96d](https://github.com/billchurch/webssh2/commit/eece96dd833a9b5e27a353a18eff8763e59cc486))
* update trivy-action to v0.35.0 and add vite override ([4fb397d](https://github.com/billchurch/webssh2/commit/4fb397d461c3644e30d191483ad82c0245ebae70))

## [4.2.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v4.1.0...webssh2-server-v4.2.0) (2026-03-13)


### Features

* add backpressure control to SFTP download streaming ([ec684ea](https://github.com/billchurch/webssh2/commit/ec684eaa2feb2c2ab1b11d9f743356bbdcb3dccf)), closes [#492](https://github.com/billchurch/webssh2/issues/492)
* add telnet protocol support ([#490](https://github.com/billchurch/webssh2/issues/490)) ([c7c6103](https://github.com/billchurch/webssh2/commit/c7c6103bfc36aed1461d345a74ece16fcd6e7670))
* emit raw Buffer for SFTP download chunks instead of base64 ([5d5440f](https://github.com/billchurch/webssh2/commit/5d5440f55eecb9eefecc989b43ed63b714ef457c))


### Bug Fixes

* add re-entrancy guard and cancellation cleanup to SFTP backpressure ([5ae39ac](https://github.com/billchurch/webssh2/commit/5ae39ace391a9d33415ed29947ad5ef79e987dab))
* lint error in SFTP backpressure test (strict boolean expression) ([54a8fbc](https://github.com/billchurch/webssh2/commit/54a8fbc101fb9c1c21a6a42b9b3f0fe681266170))
* resolve stale waitForDrain promise on concurrent calls, add missing tests ([46c86c1](https://github.com/billchurch/webssh2/commit/46c86c14e778b5e6e2b35880723b95d96399d549))
* SFTP download backpressure and binary transfer ([#492](https://github.com/billchurch/webssh2/issues/492)) ([ca88c95](https://github.com/billchurch/webssh2/commit/ca88c954a1d55663a1c8020590bc85cb56a60ef9))
* use correct secret name for workflow dispatch PAT ([7036788](https://github.com/billchurch/webssh2/commit/7036788a2d4d2a7504fc8099d48d59e107032618))

## [4.1.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v4.0.1...webssh2-server-v4.1.0) (2026-02-26)


### Features

* **host-key:** add hostkey socket events to constants ([cc23da0](https://github.com/billchurch/webssh2/commit/cc23da01d552fc32c35125c9995c976e104ed542))
* **host-key:** add hostKeyVerification to legacy socket-adapter permissions ([1a69405](https://github.com/billchurch/webssh2/commit/1a69405dbc01d09e2749881e88383360a58668dd))
* **host-key:** implement hostVerifier callback factory ([62ef1cb](https://github.com/billchurch/webssh2/commit/62ef1cbaf8018db7525544c4b01fdfef9e79c43c))
* **host-key:** send host key config with permissions event ([47a0f70](https://github.com/billchurch/webssh2/commit/47a0f7011f2124c86e8e841b32015c595f75bf90))
* **host-key:** wire hostVerifier into SSH service connect flow ([eddf34e](https://github.com/billchurch/webssh2/commit/eddf34e4a18ab6b5d05afb62a8577e583e307a06))
* send host key verification config pre-auth and honor env vars in hostkeys script ([97cb173](https://github.com/billchurch/webssh2/commit/97cb1730ac7f6eac3525b262e554b651668c5980))
* **sftp:** add shell-command file backend for BusyBox devices ([c33a7e8](https://github.com/billchurch/webssh2/commit/c33a7e88c2f823c9d730f2eb134ea546e0b1cd3d))
* **sftp:** add shell-command file backend for BusyBox devices ([#483](https://github.com/billchurch/webssh2/issues/483)) ([dbebb23](https://github.com/billchurch/webssh2/commit/dbebb239f35075bd93db3ee28177568777894ebb))
* SSH host key verification (TOFU) ([dc22703](https://github.com/billchurch/webssh2/commit/dc227030dfc9801aababca9af40a78c3b69070ec))
* update webssh2_client dependency to version 3.4.0 ([7ae7e63](https://github.com/billchurch/webssh2/commit/7ae7e6308ccd62045320b3653bc298e258ec71aa))


### Bug Fixes

* address code review findings for host key verification ([6f53016](https://github.com/billchurch/webssh2/commit/6f530169f93ec8491136d5f72499d5d1eb0849e3))
* reduce awaitClientVerification params to options object (S107) and use structuredClone (S7784) ([a6163d6](https://github.com/billchurch/webssh2/commit/a6163d6163fed778dc736d07e04deaa1c5f73bcb))
* remove void operator from test files (S3735) ([3bec992](https://github.com/billchurch/webssh2/commit/3bec992c4aec97afa0a9b2ba2d9d6ee36b748f52))
* resolve lint errors in test files ([ad14af9](https://github.com/billchurch/webssh2/commit/ad14af90e5722872a79f8338aa32cfcd459785ea))
* resolve markdownlint warnings in host-key-protocol.md ([142db67](https://github.com/billchurch/webssh2/commit/142db67ba699cb754e0ecba8d24ced642e6fdc72))
* resolve SonarQube issues across codebase (S3735, S3776, S2871, S4623, S6557, S4043, S7763, S4325, S6594, S7781, S7755, S7784, S7924) ([b33dc6d](https://github.com/billchurch/webssh2/commit/b33dc6dcc73aecdc9b5aa67561ae68fcd51185e0))
* resolve SonarQube lint warnings in shell-commands ([6c1035e](https://github.com/billchurch/webssh2/commit/6c1035ec285cf70d5901b306caed359c968f402f))
* resolve SonarQube quality gate failures on PR [#488](https://github.com/billchurch/webssh2/issues/488) ([6315836](https://github.com/billchurch/webssh2/commit/63158369f5ed1b0bdd8efe3304c3042ce9f75b76))
* SFTP error propagation with fileName + relax waitForPrompt regex ([213ec12](https://github.com/billchurch/webssh2/commit/213ec12cd009c64ee4044d95a66e51efffea4030))
* **sftp:** use basename for download filename in shell backend ([d84b78c](https://github.com/billchurch/webssh2/commit/d84b78cfad6ab428c8fea0dba646755ae4386f72))
* **tests:** add hostKeyVerification to socket-v2 mock config ([0a76bea](https://github.com/billchurch/webssh2/commit/0a76bea6c131a5d87818d6f34da521499caa2069))
* update rollup to 4.59.0 for GHSA-mw96-cpmx-2vgc path traversal fix ([dbea2df](https://github.com/billchurch/webssh2/commit/dbea2dff7c705286f56fd26d16dc0928c983cfdc))
* use eslint-disable for no-new in side-effect constructors ([bdd7991](https://github.com/billchurch/webssh2/commit/bdd7991aba42b8b3dd1cad4365b0b2dd578dd933))

## [4.0.1](https://github.com/billchurch/webssh2/compare/webssh2-server-v4.0.0...webssh2-server-v4.0.1) (2026-02-07)


### Bug Fixes

* **perf:** binary WebSocket transport and backpressure fix ([#479](https://github.com/billchurch/webssh2/issues/479)) ([2cc6ba0](https://github.com/billchurch/webssh2/commit/2cc6ba0b8b9f08db136c53080efef219eae767a9))

## [4.0.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v3.1.1...webssh2-server-v4.0.0) (2026-02-02)


### ⚠ BREAKING CHANGES

* **ux:** Error responses are now JSON-only. Clients must handle the 'connection-error' event to display connection failures.

### Features

* **ux:** client-side connection error modal with algorithm debugging ([#476](https://github.com/billchurch/webssh2/issues/476)) ([2236a4e](https://github.com/billchurch/webssh2/commit/2236a4eff14d2540f2c823fa0eb17b2154b41907))


### Bug Fixes

* **ci:** use PAT_WORKFLOW token for Docker build dispatch [skip ci] ([0e1c280](https://github.com/billchurch/webssh2/commit/0e1c2802a21267d3bd4c677ff14e19658fca691e))

## [3.1.1](https://github.com/billchurch/webssh2/compare/webssh2-server-v3.1.0...webssh2-server-v3.1.1) (2026-01-28)


### Bug Fixes

* **ssh:** ensure environment variable algorithms are always honored ([#473](https://github.com/billchurch/webssh2/issues/473)) ([9a9077b](https://github.com/billchurch/webssh2/commit/9a9077beb9d795cf5f266764972005a2222c9e07))

## [3.1.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v3.0.0...webssh2-server-v3.1.0) (2026-01-13)


### Features

* **debug:** add ssh2 protocol-level debug logging ([#469](https://github.com/billchurch/webssh2/issues/469)) ([e4ba8fa](https://github.com/billchurch/webssh2/commit/e4ba8fa62153e73ae496bd4c8054fdea4cad7f1a))

## [3.0.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.6.1...webssh2-server-v3.0.0) (2025-12-30)


### ⚠ BREAKING CHANGES

* **sftp:** SFTP protocol updated - clients must not send transferId in start requests; use server-provided ID from response.

### Features

* add server-side generic prompt interface ([#465](https://github.com/billchurch/webssh2/issues/465)) ([e96f979](https://github.com/billchurch/webssh2/commit/e96f979cbf3b034ff075b6e6d783fe56c164320b))


### Bug Fixes

* **sftp:** server-side transfer ID generation and ownership verification ([#467](https://github.com/billchurch/webssh2/issues/467)) ([e3ebea2](https://github.com/billchurch/webssh2/commit/e3ebea2776611a601491b97f96c89cd69ada0bfb))

## [2.6.1](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.6.0...webssh2-server-v2.6.1) (2025-12-09)


### Bug Fixes

* SSH algorithm env var precedence and debug output improvements ([#460](https://github.com/billchurch/webssh2/issues/460)) ([bceb5b8](https://github.com/billchurch/webssh2/commit/bceb5b85bc7faeac610ec28957fd0640b2247e38)), closes [#459](https://github.com/billchurch/webssh2/issues/459)

## [2.6.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.5.0...webssh2-server-v2.6.0) (2025-12-04)


### Features

* add SFTP support, fixes [#322](https://github.com/billchurch/webssh2/issues/322) ([cc5d932](https://github.com/billchurch/webssh2/commit/cc5d93214b244cac5692ecd6ebb6871d508f1f39))

## [2.5.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.4.0...webssh2-server-v2.5.0) (2025-12-01)


### Features

* **docker:** append Docker image info to GitHub releases [skip ci] ([2911905](https://github.com/billchurch/webssh2/commit/29119059d695f457efdcc50183f67f416c184f12))
* **docs:** add keyboard capture documentation and quick reference ([7b08ca5](https://github.com/billchurch/webssh2/commit/7b08ca512c7bc8c3a000f0cc4a61b18918575029))
* update webssh2_client to version 2.2.0 ([ffdb9b7](https://github.com/billchurch/webssh2/commit/ffdb9b701fe7e6a86195dfd8a32d06e4a295f73d))


### Bug Fixes

* **docker:** optimize builder stage and add timeout ([d07df7b](https://github.com/billchurch/webssh2/commit/d07df7b9837c5a5ec5583f7c30eef2df78ae9097))

## [2.4.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.3.5...webssh2-server-v2.4.0) (2025-11-27)


### Features

* Implemented rate limiting and output truncation features in the SSH service to prevent memory overflow during high-volume output. fixes [#451](https://github.com/billchurch/webssh2/issues/451) ([b575bba](https://github.com/billchurch/webssh2/commit/b575bba1445ff15aba596f5a52314dfae506156b))


### Bug Fixes

* package.json & package-lock.json to reduce vulnerabilities ([#453](https://github.com/billchurch/webssh2/issues/453)) ([9a9719b](https://github.com/billchurch/webssh2/commit/9a9719b814a9f07a07f6bb5745be0611804e5018))
* Refactor constants import paths and enhance SSH output handling ([b575bba](https://github.com/billchurch/webssh2/commit/b575bba1445ff15aba596f5a52314dfae506156b))

## [2.3.5](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.3.4...webssh2-server-v2.3.5) (2025-11-06)


### Bug Fixes

* package.json & package-lock.json to reduce vulnerabilities ([#440](https://github.com/billchurch/webssh2/issues/440)) ([6e3261b](https://github.com/billchurch/webssh2/commit/6e3261b6a9aaf1b7ea685831afb48779593d962b))
* private key authentication not working with config credentials ([#443](https://github.com/billchurch/webssh2/issues/443)) ([e43c811](https://github.com/billchurch/webssh2/commit/e43c811ce38eddb2ddf3d04a50c5158af46a0532))

## [2.3.4](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.3.3...webssh2-server-v2.3.4) (2025-10-14)


### Bug Fixes

* csp headers upgrade-insecure-requests cause browser to attempt https, removed. fixes [#434](https://github.com/billchurch/webssh2/issues/434) ([#435](https://github.com/billchurch/webssh2/issues/435)) ([ac87aaf](https://github.com/billchurch/webssh2/commit/ac87aaf833158029c94570ab56c936de7bdd0611))

## [2.3.3](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.3.2...webssh2-server-v2.3.3) (2025-10-06)


### Bug Fixes

* respect config ssh port ([#432](https://github.com/billchurch/webssh2/issues/432)) ([dcaf257](https://github.com/billchurch/webssh2/commit/dcaf2574fade5f517c13dbb7e88eccc61c2e1fcd))

## [2.3.2](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.3.1...webssh2-server-v2.3.2) (2025-10-02)


### Chores

* **release:** 2.3.2 ([d5e5c22](https://github.com/billchurch/webssh2/commit/d5e5c22baa8b3ccc1c08f8e0c9815bc07cd30596))

## [2.3.1](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.3.0...webssh2-server-v2.3.1) (2025-10-02)


### Bug Fixes

* install rollup binary for musl-based builds ([ae03d07](https://github.com/billchurch/webssh2/commit/ae03d07e976eddc82322c50896ba6feddf208c54))

## [2.3.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.2.0...webssh2-server-v2.3.0) (2025-10-02)


### Features

* enhance local logging ([7fb516f](https://github.com/billchurch/webssh2/commit/7fb516f47b288a1a6ffc49be59dbb5972a7f8815))

## [2.2.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.1.0...webssh2-server-v2.2.0) (2025-09-30)


### ⚠ BREAKING CHANGES

* Error messages from credential validation have changed

### Features

* migrate from Ajv to Zod for config validation ([#415](https://github.com/billchurch/webssh2/issues/415)) ([4230595](https://github.com/billchurch/webssh2/commit/4230595efdc742892f05cc19176cd11122e1a45b))


### Bug Fixes

* rename AuthMethod to SSHAuthMethod to avoid type naming conflict ([#418](https://github.com/billchurch/webssh2/issues/418)) ([0b82619](https://github.com/billchurch/webssh2/commit/0b826198159078b29b8709aa781da5e1dbf3336d))


### Chores

* release 2.2.0 ([e50427c](https://github.com/billchurch/webssh2/commit/e50427c8d4de0e15bbb30dfa10cc841ed457c43b))


### Code Refactoring

* unify credential extraction with SRP and pure functions ([#417](https://github.com/billchurch/webssh2/issues/417)) ([e568ea1](https://github.com/billchurch/webssh2/commit/e568ea1431b238dcc5d6047c07f2c9536ee0c610))

## [2.1.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.0.0...webssh2-server-v2.1.0) (2025-09-26)


### Features

* implement pure functions and SRP architecture refactor ([06245c1](https://github.com/billchurch/webssh2/commit/06245c16da248ba0a14e30394aad81684fb1bd92))


### Bug Fixes

* consolidate changelog to CHANGELOG.md ([f62b5e5](https://github.com/billchurch/webssh2/commit/f62b5e5031d9efda268c1481399bd46af5e5caf3))
* replace custom basic-auth types with official package ([ab5a22f](https://github.com/billchurch/webssh2/commit/ab5a22faf4cbc2204959a0e506a7d9d596f2fae8)), closes [#405](https://github.com/billchurch/webssh2/issues/405)
* update misleading config.json missing message ([#407](https://github.com/billchurch/webssh2/issues/407)) ([fae7d8a](https://github.com/billchurch/webssh2/commit/fae7d8a394e3361f7b69eeb7fd48dbe284a48ee6))
* fix: add missing allowedSubnets field to SSH config, closes [#409](https://github.com/billchurch/webssh2/issues/409)
* fix: handle keyboard-interactive auth to prevent timeout, closes [#409](https://github.com/billchurch/webssh2/issues/409)

## [2.0.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.0.0...webssh2-server-v2.0.0) (2025-09-15)

### ⚠ BREAKING CHANGES

* validate referer to /reauth is valid
* consistent logging messages see #286
* config system changes #284 ([#285](https://github.com/billchurch/webssh2/issues/285))
* bump express to 5.1.0
* bump socket.io to 4.8.1
* bump ssh2 to 1.17
* bump webssh2_client to 2.0.0
* bump xterm to 5.5.0

### Features

* add additional params for POST requests [#290](https://github.com/billchurch/webssh2/issues/290) ([46c1560](https://github.com/billchurch/webssh2/commit/46c1560e3c126376e18124e14e5c7fb8c029a0a1))
* add additional vars to POST requests [#290](https://github.com/billchurch/webssh2/issues/290) ([0a4e419](https://github.com/billchurch/webssh2/commit/0a4e419fb371ae95340fa890497022a2aa9d063a))
* add fontFamily, letterSpacing, lineHeight ([97f3088](https://github.com/billchurch/webssh2/commit/97f3088780744e13a6724a4967a4896aac3f20d8))
* add fontSize option [#292](https://github.com/billchurch/webssh2/issues/292) ([5e78812](https://github.com/billchurch/webssh2/commit/5e788129744d326e78ec91bda86ed5cecfd70d3f))
* add NPM supply chain security policy ([#394](https://github.com/billchurch/webssh2/issues/394)) ([fe2f875](https://github.com/billchurch/webssh2/commit/fe2f8757663a9b28954fa0bddd376b9395ae7ea8)), closes [#393](https://github.com/billchurch/webssh2/issues/393)
* add SIGTERM to safe shutdown feature ([675b4f5](https://github.com/billchurch/webssh2/commit/675b4f5a3a92b187b620684eb1ce1b7afa0e2e08))
* **auth:** ssh private key auth implemented via config.json ([#161](https://github.com/billchurch/webssh2/issues/161)) ([342df8e](https://github.com/billchurch/webssh2/commit/342df8eb9cafba52eb63b50a60e11e1431d6fbd4))
* config system changes [#284](https://github.com/billchurch/webssh2/issues/284) ([#285](https://github.com/billchurch/webssh2/issues/285)) ([9c99b09](https://github.com/billchurch/webssh2/commit/9c99b0940ec726193deae3c4999d25a297874d67))
* **config:** specify local source address and port for client connections fixes [#152](https://github.com/billchurch/webssh2/issues/152) ([#158](https://github.com/billchurch/webssh2/issues/158)) ([65d6ec6](https://github.com/billchurch/webssh2/commit/65d6ec68452b80c42fd62534355e456ce1f16a32))
* consistent logging messages see [#286](https://github.com/billchurch/webssh2/issues/286) ([50cfcb9](https://github.com/billchurch/webssh2/commit/50cfcb97788cbd3409b4605adceef3d47e370e38))
* CORS support ([b324f33](https://github.com/billchurch/webssh2/commit/b324f338adeb3518322941639fb83ba9370814cc))
* credentials over http post for [#290](https://github.com/billchurch/webssh2/issues/290) ([5b8f88c](https://github.com/billchurch/webssh2/commit/5b8f88cfef1745c88748277217204e6c38c7ff7e))
* reorder viewport setup at ssh handshake [#292](https://github.com/billchurch/webssh2/issues/292) ([140e1e2](https://github.com/billchurch/webssh2/commit/140e1e24b14d6b74848e9d250c2b44f806ad627d))
* test change for release ([476b566](https://github.com/billchurch/webssh2/commit/476b566c08a84bd35aaccf847253875b2c3afb10))
* validate referer to /reauth is valid ([0dcaa6e](https://github.com/billchurch/webssh2/commit/0dcaa6e15062cdc3252ce52abd9057caf4c00a30))

### Bug Fixes

* cols and rows were not properly assigned for terminal ([#337](https://github.com/billchurch/webssh2/issues/337)) ([3246df7](https://github.com/billchurch/webssh2/commit/3246df75b6516309479beffb0948fd3233caa57b))
* deprecated term.setOption ([d903da8](https://github.com/billchurch/webssh2/commit/d903da87c41882a3736683c7de497cb8bd37f885))
* docker multiplatform build on push fixes [#293](https://github.com/billchurch/webssh2/issues/293) ([f041c77](https://github.com/billchurch/webssh2/commit/f041c779e92dee52ce931ba01f9eadb1ace68cc3))
* dockerignore ([#272](https://github.com/billchurch/webssh2/issues/272)) ([8a68cca](https://github.com/billchurch/webssh2/commit/8a68ccaffa374584b5d9531f9dbeae616bd971f5))
* exclude chore commits from changelog ([caa0288](https://github.com/billchurch/webssh2/commit/caa0288ad132f5c65fba38b30664fb2a3a328e92))
* Fix the parameter passing problem of setDefaultCredentials to make it perform data initialization normally ([#288](https://github.com/billchurch/webssh2/issues/288)) ([40cbb35](https://github.com/billchurch/webssh2/commit/40cbb35616fa17c1c36520690f40ebce0b488153))
* fixes default for allowreauth ([#239](https://github.com/billchurch/webssh2/issues/239)) ([dcfd81b](https://github.com/billchurch/webssh2/commit/dcfd81b454b9fe66edec489266dc35a765464c6b)), closes [#238](https://github.com/billchurch/webssh2/issues/238)
* invalid css in style.css ([ffab534](https://github.com/billchurch/webssh2/commit/ffab5345dcb568fa2bb50a96f403174ad3728286))
* lost comma in config.json.sample ([a75f6d7](https://github.com/billchurch/webssh2/commit/a75f6d73a55917bcd944c95337816556f03538d3))
* lost comma in config.json.sample ([a75f6d7](https://github.com/billchurch/webssh2/commit/a75f6d73a55917bcd944c95337816556f03538d3))
* missing ENTRYPOINT for Dockerfile ([6a3a47a](https://github.com/billchurch/webssh2/commit/6a3a47a13de3cd70d603379a27e055f08a6ee62c))
* obey host ssh.host in config fixes [#190](https://github.com/billchurch/webssh2/issues/190) ([7b7e8e7](https://github.com/billchurch/webssh2/commit/7b7e8e753358ed48f52eb9aa2fc359bf758f304b))
* **package:** update ssh2 to version 0.6.1 ([42523fc](https://github.com/billchurch/webssh2/commit/42523fc56853c909e49d54b6ede3aa3ae2dcdce9))
* **package:** update ssh2 to version 0.6.1 ([bf15b3e](https://github.com/billchurch/webssh2/commit/bf15b3e11d3d0659a3fafdeec616aa6bce719cb7)), closes [#55](https://github.com/billchurch/webssh2/issues/55)
* **package:** update validator to version 10.1.0 ([23ae7d5](https://github.com/billchurch/webssh2/commit/23ae7d5ce7481439280e641bc34904c433dfc99a))
* **package:** update validator to version 10.1.0 ([1a15fa5](https://github.com/billchurch/webssh2/commit/1a15fa57bbea3b137f0c9ce122542d387119ec4a)), closes [#62](https://github.com/billchurch/webssh2/issues/62)
* subnet unauthorized now emits "ssherror" which persists across websocket termination ([e796f9f](https://github.com/billchurch/webssh2/commit/e796f9fb5874d6557433f25e8976b7aa58fa8144))
* update config.json.sample ([#177](https://github.com/billchurch/webssh2/issues/177)) ([42f973b](https://github.com/billchurch/webssh2/commit/42f973b4796f7f50237dc8ce613e477aa89352ca))
* update read-config-ng to 3.0.5, fixes [#277](https://github.com/billchurch/webssh2/issues/277) ([3e82c0d](https://github.com/billchurch/webssh2/commit/3e82c0dc4d31d1c97a7cf98139ef8e6dc0213b22))
* update xterm.js fixes [#261](https://github.com/billchurch/webssh2/issues/261) ([c801ef9](https://github.com/billchurch/webssh2/commit/c801ef9e5826e13a403a6462241cf8a4ff456d45))
