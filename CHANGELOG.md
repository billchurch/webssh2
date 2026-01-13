# Changelog

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
