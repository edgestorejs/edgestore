/** @type {import('next').NextConfig} */
const nextConfig = {
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/single-image-tab',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
