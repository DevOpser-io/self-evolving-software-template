const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    mode: 'production',
    entry: {
        bundle: ['./src/chat.js', './src/styles.css'],
        mfa: ['./src/mfa.js', './src/mfa.css'],
        account: ['./src/account.js', './src/account.css']
    },
    output: {
        filename: '[name].js',
        path: path.resolve(__dirname, 'public/static/dist'),
        clean: true
    },
    module: {
        rules: [
            {
                test: /\.css$/,
                use: [
                    MiniCssExtractPlugin.loader,
                    'css-loader'
                ]
            },
            {
                test: /\.(png|svg|jpg|jpeg|gif)$/i,
                type: 'asset/resource'
            }
        ]
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].css'
        })
    ]
};
