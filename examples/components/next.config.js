/** @type {import('next').NextConfig} */
const nextConfig = {
  basePath: process.env.NEXT_PUBLIC_BASE_PATH,
  redirects: async () => {
    return [
      {
        source: '/',
        destination: '/single-image',
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
