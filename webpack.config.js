const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./public/src/app.js",
  output: {
    filename: "game.bundle.js",
    path: path.resolve(__dirname, "public/dist"),
    publicPath: "",
    clean: true,
  },
  module: {
    rules: [
      // Images & textures
      {
        test: /\.(png|jpg|jpeg|gif|svg)$/i,
        type: "asset/resource",
        generator: { filename: "models/[name][ext]" },
      },
      // 3D models
      {
        test: /\.(glb|gltf|babylon)$/i,
        type: "asset/resource",
        generator: { filename: "models/[name][ext]" },
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: "public/car.php",
      filename: "car.php",
      inject: "body",
    }),
    new CopyPlugin({
      patterns: [
        { from: "./public/models", to: "models" }
      ],
    }),
  ],
  resolve: { extensions: [".js"] },
  mode: "development",
  devtool: "source-map",
  
};
