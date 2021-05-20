// expressOptions.js
module.exports = {
  dotfiles: 'ignore',
  etag: false,
  extensions: ['htm', 'html'],
  index: false,
  maxAge: '1s',
  redirect: false,
  setHeaders(res) {
    res.set('x-timestamp', Date.now());
  },
};
