# Changelog

## [2.1.0](https://github.com/billchurch/webssh2/compare/webssh2-server-v2.0.0...webssh2-server-v2.1.0) (2025-09-26)


### Features

* implement pure functions and SRP architecture refactor ([06245c1](https://github.com/billchurch/webssh2/commit/06245c16da248ba0a14e30394aad81684fb1bd92))


### Bug Fixes

* consolidate changelog to CHANGELOG.md ([f62b5e5](https://github.com/billchurch/webssh2/commit/f62b5e5031d9efda268c1481399bd46af5e5caf3))
* replace custom basic-auth types with official package ([ab5a22f](https://github.com/billchurch/webssh2/commit/ab5a22faf4cbc2204959a0e506a7d9d596f2fae8)), closes [#405](https://github.com/billchurch/webssh2/issues/405)
* update misleading config.json missing message ([#407](https://github.com/billchurch/webssh2/issues/407)) ([fae7d8a](https://github.com/billchurch/webssh2/commit/fae7d8a394e3361f7b69eeb7fd48dbe284a48ee6))

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
