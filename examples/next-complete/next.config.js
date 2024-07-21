/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // this allows us to return dates in the `getServerSideProps` function
    swcPlugins: [['next-superjson-plugin', {}]],
  },
  images: {
    domains: ['files.edgestore.dev'],
  },
};

module.exports = nextConfig;
