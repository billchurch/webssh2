const merge = require("webpack-merge");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");
const common = require("./webpack.common.js");

module.exports = merge(
  {
    plugins: [
      new UglifyJSPlugin({
        uglifyOptions: {
          ie8: false,
          dead_code: true,
          output: {
            comments: false,
            beautify: false,
          },
        },
      }),
    ],
  },
  common
);
