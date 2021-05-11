const path = require('path')
const { CleanWebpackPlugin } = require('clean-webpack-plugin')
const CopyWebpackPlugin = require('copy-webpack-plugin')
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
module.exports = {
  context: path.resolve('__dirname', '../'),
  entry: {
    webssh2: './client/src/js/index.js'
  },
  plugins: [
    new CleanWebpackPlugin(),
    new CopyWebpackPlugin({
      patterns: [
        './client/src/client.htm',
        './client/src/favicon.ico'
      ]
    }),
    new MiniCssExtractPlugin()
  ],
  output: {
    filename: '[name].bundle.js',
    path: path.resolve(__dirname, '../client/public')
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: [MiniCssExtractPlugin.loader, 'css-loader']
      }
    ]
  }
}
