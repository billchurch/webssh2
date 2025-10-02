import {execSync} from 'child_process';
import {existsSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'os';

const projectRoot = dirname(fileURLToPath(import.meta.url));
const releaseRoot = join(projectRoot, '..');

const hasPrebuiltBundle = existsSync(join(releaseRoot, 'dist')) && existsSync(join(releaseRoot, 'manifest.json'));

if (hasPrebuiltBundle) {
  process.stdout.write('postinstall: prebuilt dist detected; skipping optional native dependency install\n');
  process.exit(0);
}

const platform = os.platform();
const arch = os.arch();

const install = (pkg) => {
  execSync(`npm install ${pkg} --no-save`, {stdio: 'inherit'});
};

const getLibcFamily = () => {
  if (process.report && typeof process.report.getReport === 'function') {
    const report = process.report.getReport();
    if (report?.header?.glibcVersionRuntime) {
      return 'gnu';
    }
  }
  return 'musl';
};

if (platform === 'darwin' && arch === 'arm64') {
  install('@rollup/rollup-darwin-arm64');
} else if (platform === 'linux') {
  const libcFamily = getLibcFamily();

  if (arch === 'x64') {
    const pkg = libcFamily === 'gnu'
      ? '@rollup/rollup-linux-x64-gnu'
      : '@rollup/rollup-linux-x64-musl';
    install(pkg);
  } else if (arch === 'arm64') {
    const pkg = libcFamily === 'gnu'
      ? '@rollup/rollup-linux-arm64-gnu'
      : '@rollup/rollup-linux-arm64-musl';
    install(pkg);
  } else if (arch === 'arm') {
    const pkg = libcFamily === 'gnu'
      ? '@rollup/rollup-linux-arm-gnueabihf'
      : '@rollup/rollup-linux-arm-musleabihf';
    install(pkg);
  }
}
