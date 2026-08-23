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
        hostname: 'upload.wikimedia.org',
        pathname: '/**'
      }
    ]
  }
};

module.exports = nextconfig;
