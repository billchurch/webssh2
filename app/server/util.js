const forge = require('node-forge');

function convertPKCS8toPKCS1(pkcs8Key) {
  const privateKeyInfo = forge.pki.privateKeyFromPem(pkcs8Key);

  // Convert the private key to PKCS#1 format
  const pkcs1Pem = forge.pki.privateKeyToPem(privateKeyInfo);
  return pkcs1Pem;
}

module.exports = { convertPKCS8toPKCS1 };
