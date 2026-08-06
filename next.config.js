const nextconfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'image.tmdb.org',
        pathname: '/**'
      },
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  }
};

module.exports = nextconfig;
