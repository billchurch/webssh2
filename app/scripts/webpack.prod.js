const TerserPlugin = require('terser-webpack-plugin');
const merge = require('webpack-merge')
// const UglifyJSPlugin = require('uglifyjs-webpack-plugin')
const common = require('./webpack.common.js')

module.exports = merge(common, {
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin({
      terserOptions: {
        parallel: 4,
        ie8: false,
        safari10: false  
      }
    })],
  }
})


/* new UglifyJSPlugin({
  uglifyOptions: {
    ie8: false,
    dead_code: true,
    output: {
      comments: false,
      beautify: false
    }
  }
}) */