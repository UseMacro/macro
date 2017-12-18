var webpack = require("webpack"),
    path = require("path"),
    fileSystem = require("fs"),
    env = require("./util/env"),

    // Used to remove previous build files before rebuilding new ones
    CleanWebpackPlugin = require("clean-webpack-plugin"),

    // Copies files over from one directory to another
    CopyWebpackPlugin = require("copy-webpack-plugin"),

    // Generates an HTML file. Customizable, and pretty powerful.
    HtmlWebpackPlugin = require("html-webpack-plugin"),

    // Forces webpack-dev-server program to write bundle files to the file system.
    // TODO: Might not even need this.
    WriteFilePlugin = require("write-file-webpack-plugin");

// load the secrets
var alias = {};
var secretsPath = path.join(__dirname, ("secrets." + env.NODE_ENV + ".js"));
if (fileSystem.existsSync(secretsPath)) {
  alias["secrets"] = secretsPath;
}

var fileExtensions = ["jpg", "jpeg", "png", "gif", "eot", "otf", "svg", "ttf", "woff", "woff2"];

var options = {
  entry: {
    popup: path.join(__dirname, "chrome-extension", "js", "popup.js"),
    options: path.join(__dirname, "chrome-extension", "js", "options.ts"),
    background: path.join(__dirname, "chrome-extension", "js", "background.js")
  },

  // All file outputs from webpack will be under the 'build/' directory.
  output: {
    path: path.join(__dirname, "build"),
    filename: "[name].js"
  },

  module: {
    rules: [
      {
        // Bundles all imported CSS files into one file
        test: /\.css$/,
        loader: "style-loader!css-loader",
        exclude: /node_modules/
      },
      {
        // Handles loading images
        test: new RegExp('\.(' + fileExtensions.join('|') + ')$'),
        loader: "file-loader?name=[name].[ext]",
        exclude: /node_modules/
      },
      {
        // Handles importing html files in webpack
        test: /\.html$/,
        loader: "html-loader",
        exclude: /node_modules/
      },
      {
        // Handles compiling TypeScript files into JS
        test: /\.tsx?$/,
        loader: "ts-loader"
      }
    ]
  },
  resolve: {
    // This is to alias different module names.
    // For example, we can alias ReactDOM to be 'react-dom' so that we
    // can import it in a file as
    // `import * from 'react-dom'`
    alias: alias
  },

  // Plugins that handle a lot of the files moving around.
  plugins: [
    // clean the build folder
    new CleanWebpackPlugin(["build"]),
    // expose and write the allowed env vars on the compiled bundle
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(env.NODE_ENV)
    }),
    new CopyWebpackPlugin([{
      from: "chrome-extension/manifest.json"
    }, {
      from: "chrome-extension/img",
      to: "./img"
    }]),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "chrome-extension", "popup.html"),
      filename: "popup.html",
      chunks: ["popup"]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "chrome-extension", "options.html"),
      filename: "options.html",
      chunks: ["options"]
    }),
    new HtmlWebpackPlugin({
      template: path.join(__dirname, "chrome-extension", "background.html"),
      filename: "background.html",
      chunks: ["background"]
    }),
    new WriteFilePlugin()
  ]
};

if (env.NODE_ENV === "development") {
  options.devtool = "cheap-module-eval-source-map";
}

module.exports = options;
