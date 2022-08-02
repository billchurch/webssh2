# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [0.4.7](https://github.com/billchurch/webssh2/compare/webssh2-v0.4.6...webssh2-v0.4.7) (2022-08-02)


### ⚠ BREAKING CHANGES

* validate referer to /reauth is valid
* bump xterm to 4.18.0
* consistent logging messages see #286
* config system changes #284 (#285)

### Features

* add additional params for POST requests [#290](https://github.com/billchurch/webssh2/issues/290) ([46c1560](https://github.com/billchurch/webssh2/commit/46c1560e3c126376e18124e14e5c7fb8c029a0a1))
* add additional vars to POST requests [#290](https://github.com/billchurch/webssh2/issues/290) ([0a4e419](https://github.com/billchurch/webssh2/commit/0a4e419fb371ae95340fa890497022a2aa9d063a))
* add fontFamily, letterSpacing, lineHeight ([97f3088](https://github.com/billchurch/webssh2/commit/97f3088780744e13a6724a4967a4896aac3f20d8))
* add fontSize option [#292](https://github.com/billchurch/webssh2/issues/292) ([5e78812](https://github.com/billchurch/webssh2/commit/5e788129744d326e78ec91bda86ed5cecfd70d3f))
* config system changes [#284](https://github.com/billchurch/webssh2/issues/284) ([#285](https://github.com/billchurch/webssh2/issues/285)) ([9c99b09](https://github.com/billchurch/webssh2/commit/9c99b0940ec726193deae3c4999d25a297874d67))
* consistent logging messages see [#286](https://github.com/billchurch/webssh2/issues/286) ([50cfcb9](https://github.com/billchurch/webssh2/commit/50cfcb97788cbd3409b4605adceef3d47e370e38))
* credentials over http post for [#290](https://github.com/billchurch/webssh2/issues/290) ([5b8f88c](https://github.com/billchurch/webssh2/commit/5b8f88cfef1745c88748277217204e6c38c7ff7e))
* reorder viewport setup at ssh handshake [#292](https://github.com/billchurch/webssh2/issues/292) ([140e1e2](https://github.com/billchurch/webssh2/commit/140e1e24b14d6b74848e9d250c2b44f806ad627d))
* validate referer to /reauth is valid ([0dcaa6e](https://github.com/billchurch/webssh2/commit/0dcaa6e15062cdc3252ce52abd9057caf4c00a30))


### Bug Fixes

* Fix the parameter passing problem of setDefaultCredentials to make it perform data initialization normally ([#288](https://github.com/billchurch/webssh2/issues/288)) ([40cbb35](https://github.com/billchurch/webssh2/commit/40cbb35616fa17c1c36520690f40ebce0b488153))
* invalid css in style.css ([ffab534](https://github.com/billchurch/webssh2/commit/ffab5345dcb568fa2bb50a96f403174ad3728286))


### package

* bump xterm to 4.18.0 ([84c09ec](https://github.com/billchurch/webssh2/commit/84c09ec8a1909e4bbd0051debdbb905276a4245e))

### [0.4.6](https://github.com/billchurch/WebSSH2/compare/v0.2.10-0...v0.4.6) (2022-04-17)


### Features

* add SIGTERM to safe shutdown feature ([675b4f5](https://github.com/billchurch/WebSSH2/commit/675b4f5a3a92b187b620684eb1ce1b7afa0e2e08))
* **auth:** ssh private key auth implemented via config.json ([#161](https://github.com/billchurch/WebSSH2/issues/161)) ([342df8e](https://github.com/billchurch/WebSSH2/commit/342df8eb9cafba52eb63b50a60e11e1431d6fbd4))
* **config:** specify local source address and port for client connections fixes [#152](https://github.com/billchurch/WebSSH2/issues/152) ([#158](https://github.com/billchurch/WebSSH2/issues/158)) ([65d6ec6](https://github.com/billchurch/WebSSH2/commit/65d6ec68452b80c42fd62534355e456ce1f16a32))
* CORS support ([b324f33](https://github.com/billchurch/WebSSH2/commit/b324f338adeb3518322941639fb83ba9370814cc)), closes [#240](https://github.com/billchurch/WebSSH2/issues/240)


### Bug Fixes

* deprecated term.setOption ([d903da8](https://github.com/billchurch/WebSSH2/commit/d903da87c41882a3736683c7de497cb8bd37f885))
* dockerignore ([#272](https://github.com/billchurch/WebSSH2/issues/272)) ([8a68cca](https://github.com/billchurch/WebSSH2/commit/8a68ccaffa374584b5d9531f9dbeae616bd971f5))
* fixes default for allowreauth ([#239](https://github.com/billchurch/WebSSH2/issues/239)) ([dcfd81b](https://github.com/billchurch/WebSSH2/commit/dcfd81b454b9fe66edec489266dc35a765464c6b)), closes [#238](https://github.com/billchurch/WebSSH2/issues/238)
* missing ENTRYPOINT for Dockerfile ([6a3a47a](https://github.com/billchurch/WebSSH2/commit/6a3a47a13de3cd70d603379a27e055f08a6ee62c))
* obey host ssh.host in config fixes [#190](https://github.com/billchurch/WebSSH2/issues/190) ([7b7e8e7](https://github.com/billchurch/WebSSH2/commit/7b7e8e753358ed48f52eb9aa2fc359bf758f304b))
* subnet unauthorized now emits "ssherror" which persists across websocket termination ([e796f9f](https://github.com/billchurch/WebSSH2/commit/e796f9fb5874d6557433f25e8976b7aa58fa8144))
* update config.json.sample ([#177](https://github.com/billchurch/WebSSH2/issues/177)) ([42f973b](https://github.com/billchurch/WebSSH2/commit/42f973b4796f7f50237dc8ce613e477aa89352ca))
* update read-config-ng to 3.0.5, fixes [#277](https://github.com/billchurch/WebSSH2/issues/277) ([3e82c0d](https://github.com/billchurch/WebSSH2/commit/3e82c0dc4d31d1c97a7cf98139ef8e6dc0213b22))
* update xterm.js fixes [#261](https://github.com/billchurch/WebSSH2/issues/261) ([c801ef9](https://github.com/billchurch/WebSSH2/commit/c801ef9e5826e13a403a6462241cf8a4ff456d45))
