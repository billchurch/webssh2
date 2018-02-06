const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')

module.exports = {
  entry: {
    webssh2: './src/js/index.js'
  },
  plugins: [
    new CleanWebpackPlugin(['./public']),
    new CopyWebpackPlugin([
      './src/client-full.htm',
      './src/client-min.htm',
      './src/favicon.ico'
    ])
  ],
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, './public')
  },
  module: {
    loaders: [
      { test: /\.css$/, loader: 'style-loader!css-loader' }
    ]
  }
}
