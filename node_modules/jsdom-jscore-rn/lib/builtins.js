module.exports = {
  url: require('./builtins/url/url'),
  path: require('./builtins/path-browserify/index'),
  htmlparser2: require('htmlparser2-without-node-native'),
  nwmatcher: require('./builtins/nwmatcher/src/nwmatcher-noqsa'),
  cssom: require('./builtins/cssom/lib/index'),
  cssstyle: require('./builtins/cssstyle/lib/CSSStyleDeclaration')
};
