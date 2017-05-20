# Change Log
## [Unreleased]
### Added
- This ChangeLog.md file
- Snyk, Bithound, Travis CI
- Cross platform improvements (path mappings)
- Session fixup between Express and Socket.io

### Changed

### Fixed

## [0.0.5] - 2017-0323
### Added
- Added experimental support for logging (see Readme)

### Fixed
- Terminal geometry now properly fills the browser screen and communicates this to the ssh session. Tested with IE 11 and recent versions of Chrome/Safari/Firefox.

## [0.0.4] - 2017-03-23
### Added
- Set default terminal to xterm-color
- Mouse event support
- New config option, config.ssh.term to set terminal

### Changed
- Update to Xterm.js 2.4.0
- Minor code formatting cleanup

## [0.0.3] - 2017-02-16
### Changed
- Update xterm to latest (2.3.0)
### Fixed
- Fixed misspelled config.ssh.port property

## [0.0.2] - 2017-02-01
### Changed
- Moving terminal emulation to xterm.js
- updating module version dependencies

### Fixed
- Fixed issue with banners not being displayed properly from UNIX hosts when only lf is used

## [0.0.1] - 2016-06-28
### Added
- Initial proof of concept and release. For historical purposes only.
