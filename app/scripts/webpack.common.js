const webpack = require("webpack");
const { BannerPlugin } = require("webpack");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const CleanWebpackPlugin = require("clean-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const packageJson = require("../package.json"); // Load package.json
const commitHash = require("child_process")
  .execSync("git rev-parse --short HEAD")
  .toString()
  .trim();

module.exports = {
  context: path.resolve(__dirname, "../"),
  entry: {
    webssh2: "./client/src/js/index.js",
  },
  plugins: [
    new BannerPlugin({
      banner: `Version ${
        packageJson.version
      } - ${new Date().toISOString()} - ${commitHash}`,
      include: /\.(js|css|html|htm)$/,
    }),
    new CleanWebpackPlugin(["client/public"], {
      root: path.resolve("__dirname", "../"),
      verbose: true,
    }),
    new HtmlWebpackPlugin({
      template: "./client/src/client.htm", // Path to your source template
      filename: "client.htm", // Optional: output file name, defaults to index.html
      minify: false,
      scriptLoading: "defer",
      version: `Version ${
        packageJson.version
      } - ${new Date().toISOString()} - ${commitHash}`,
      publicPath: "/ssh/", // Prepend /ssh/ to the script tags
    }),
    new CopyWebpackPlugin([
      { from: "./client/src/favicon.ico", to: "favicon.ico" },
    ]),
    new ExtractTextPlugin("[name].css"),
  ],
  output: {
    filename: "[name].bundle.js",
    path: path.resolve(__dirname, "../client/public"),
    publicPath: "/ssh/", // Prepend /ssh/ to the script tags
  },
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ExtractTextPlugin.extract({
          fallback: "style-loader",
          use: [{ loader: "css-loader" }],
        }),
      },
    ],
  },
};
