const nextconfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  eslint: {
    ignoreDuringBuilds: true
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/t/p/**'
      }
    ]
  }
};

module.exports = nextconfig;
