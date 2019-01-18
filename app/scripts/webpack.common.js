const webpack = require('webpack')
const path = require('path')
const CleanWebpackPlugin = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const ExtractTextPlugin = require('extract-text-webpack-plugin')
module.exports = {
  context: path.resolve('__dirname', '../'),
  entry: {
    webssh2: './client/src/js/index.js'
  },
  plugins: [
    new CleanWebpackPlugin(['client/public'], {
      root: path.resolve('__dirname', '../'),
      verbose: true
    }),
    new CopyWebpackPlugin([
      './client/src/client.htm',
      './client/src/favicon.ico'
    ]),
    new ExtractTextPlugin('[name].css')
  ],
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '../client/public')
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: 'style-loader',
          use: [
            {
              loader: 'css-loader'
            }
          ]
        })
      }
    ]
  }
}
