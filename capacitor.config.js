const target = process.env.VERT_APP_URL?.trim();
const config = {
  appId: 'com.vert.app',
  appName: 'Vert',
  webDir: 'www'
};

if (target) {
  config.server = {
    url: target,
    cleartext: target.startsWith('http://'),
    androidScheme: 'https'
  };
}

module.exports = config;
