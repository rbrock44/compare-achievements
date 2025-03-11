const webpack = require('webpack');
const dotenv = require('dotenv');

module.exports = {
  plugins: [
    new webpack.DefinePlugin({
      'process.env': {
        STEAM_API_KEY: JSON.stringify(process.env.STEAM_API_KEY)
      }
    })
  ]
};
