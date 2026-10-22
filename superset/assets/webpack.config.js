const path = require('path');
const webpack = require('webpack');
const MinimizerPlugin = require('minimizer-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');

const APP_DIR = path.resolve(__dirname, './');
const BUILD_DIR = path.resolve(__dirname, './dist');
const POLYFILLS = path.resolve(APP_DIR, 'javascripts/polyfills.js');

const withPolyfills = entry => [POLYFILLS, path.resolve(APP_DIR, entry)];

module.exports = (env, argv = {}) => {
  const mode = argv.mode || 'development';
  const isProduction = mode === 'production';

  return {
    mode,
    entry: {
      theme: path.resolve(APP_DIR, 'javascripts/theme.js'),
      reactTheme: path.resolve(APP_DIR, 'javascripts/reactTheme.js'),
      reactShell: withPolyfills('javascripts/reactShell.js'),
      fabBs5: withPolyfills('javascripts/fabBs5/index.jsx'),
      common: withPolyfills('javascripts/common.js'),
      addSlice: withPolyfills('javascripts/addSlice/index.jsx'),
      explore: withPolyfills('javascripts/explore/index.jsx'),
      dashboard: withPolyfills('javascripts/dashboard/index.jsx'),
      sqllab: withPolyfills('javascripts/SqlLab/index.jsx'),
      welcome: withPolyfills('javascripts/welcome/index.jsx'),
      profile: withPolyfills('javascripts/profile/index.jsx'),
      custom: withPolyfills('javascripts/custom/index.jsx'),
      indexmanage: withPolyfills('javascripts/indexManage/index.jsx'),
      indexdatamanage: withPolyfills('javascripts/indexDataManage/index.jsx'),
      reportsdata: withPolyfills('javascripts/reportsData/index.jsx'),
      homePage: withPolyfills('javascripts/homePage/index.jsx'),
    },
    output: {
      path: BUILD_DIR,
      filename: '[name].[chunkhash].entry.js',
      chunkFilename: '[name].[chunkhash].chunk.js',
      assetModuleFilename: '[contenthash][ext][query]',
      clean: true,
    },
    resolve: {
      extensions: ['.js', '.jsx'],
      alias: {
        webworkify: 'webworkify-webpack',
      },
      fallback: {
        fs: false,
        vm: require.resolve('vm-browserify'),
      },
    },
    module: {
      rules: [
        {
          test: /datatables\.net.*/,
          loader: 'imports-loader',
          options: {
            additionalCode: 'var define = false;',
          },
        },
        {
          test: /\.jsx?$/,
          exclude: /node_modules/,
          use: {
            loader: 'babel-loader',
            options: {
              cacheDirectory: true,
            },
          },
        },
        {
          test: /\.css$/,
          include: APP_DIR,
          exclude: [
            /ckeditor5-[^/\\]+[/\\]theme[/\\].+\.css/,
          ],
          use: [MiniCssExtractPlugin.loader, 'css-loader'],
        },
        {
          test: /\.less$/,
          include: APP_DIR,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            {
              loader: 'less-loader',
              options: {
                lessOptions: {
                  math: 'always',
                },
              },
            },
          ],
        },
        {
          test: /\.s[ac]ss$/,
          include: APP_DIR,
          use: [
            MiniCssExtractPlugin.loader,
            'css-loader',
            'sass-loader',
          ],
        },
        {
          test: /\.png$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 100000,
            },
          },
        },
        {
          test: /\.(jpe?g|gif)$/,
          type: 'asset/resource',
        },
        {
          test: /\.woff2?(\?v=[0-9]+\.[0-9]+\.[0-9]+)?$/,
          type: 'asset',
          parser: {
            dataUrlCondition: {
              maxSize: 10000,
            },
          },
        },
        {
          test: /\.(ttf|eot|svg)(\?v=[0-9]+\.[0-9]+\.[0-9]+)?$/,
          type: 'asset/resource',
          exclude: [
            /ckeditor5-[^/\\]+[/\\]theme[/\\]icons[/\\][^/\\]+\.svg$/,
            /ckeditor5-[^/\\]+[/\\]theme[/\\].+\.css/,
          ],
        },
      ],
    },
    externals: {
      cheerio: 'window',
      echarts: 'echarts',
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(mode),
      }),
      new MiniCssExtractPlugin({
        filename: '[name].[chunkhash].css',
        chunkFilename: '[name].[chunkhash].css',
      }),
      new WebpackManifestPlugin({
        fileName: 'manifest.json',
        publicPath: '',
        generate(seed, files) {
          const manifest = files.reduce((result, file) => {
            if (file.name) {
              result[file.name] = file.path;
            }
            return result;
          }, seed);

          return Object.keys(manifest).sort().reduce((result, key) => {
            result[key] = manifest[key];
            return result;
          }, {});
        },
      }),
    ],
    optimization: {
      minimize: isProduction,
      minimizer: [
        new MinimizerPlugin({
          // Terser starts one worker per available CPU by default. Limit it
          // to one worker to prevent production builds from exhausting RAM.
          parallel: 2,
          extractComments: false,
          minimizerOptions: {
            compress: {
              passes: 1,
            },
          },
        }),
      ],
    },
    performance: {
      hints: false,
    },
  };
};
