module.exports = ({ config }) => {
  const profile = process.env.EAS_BUILD_PROFILE || '';
  const productionLike = process.env.NODE_ENV === 'production' || (profile !== '' && profile !== 'development');
  const cleartextRequested = process.env.ALLOW_CLEARTEXT_DEV === 'true';
  if (productionLike && cleartextRequested) {
    throw new Error('ALLOW_CLEARTEXT_DEV can only be enabled for a development build');
  }
  const allowCleartextDev = cleartextRequested && !productionLike;
  const buildPropertyPlugins = (config.plugins || []).filter((plugin) =>
    Array.isArray(plugin) && plugin[0] === 'expo-build-properties'
  );
  if (buildPropertyPlugins.length !== 1) {
    throw new Error('Exactly one configured expo-build-properties plugin is required');
  }

  const plugins = (config.plugins || []).map((plugin) => {
    if (!Array.isArray(plugin) || plugin[0] !== 'expo-build-properties') return plugin;
    const options = plugin[1];
    if (!options || typeof options !== 'object' || Array.isArray(options)) {
      throw new Error('expo-build-properties must use an options object');
    }
    return [plugin[0], {
      ...options,
      android: {
        ...(options.android || {}),
        usesCleartextTraffic: allowCleartextDev,
      },
    }];
  });

  return {
    ...config,
    plugins,
    ios: {
      ...(config.ios || {}),
      infoPlist: {
        ...(config.ios?.infoPlist || {}),
        NSAppTransportSecurity: {
          NSAllowsArbitraryLoads: false,
          ...(!productionLike ? {
            NSExceptionDomains: {
              localhost: { NSExceptionAllowsInsecureHTTPLoads: true },
            },
          } : {}),
        },
      },
    },
  };
};
