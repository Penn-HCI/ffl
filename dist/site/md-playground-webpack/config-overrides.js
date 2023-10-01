"use strict";
/* config-overrides.js */
module.exports = function override(config, env) {
    require('react-app-rewire-postcss')(config);
    config.module.rules.push({
        test: /\.m?js/,
        resolve: {
            fullySpecified: false,
        },
    });
    return config;
};
//# sourceMappingURL=config-overrides.js.map