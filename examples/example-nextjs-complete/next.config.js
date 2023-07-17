/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // this allows us to return dates in the `getServerSideProps` function
    swcPlugins: [['next-superjson-plugin', {}]],
  },
  images: {
    domains: [process.env.EDGE_STORE_BASE_URL ?? 'files.edge-store.com'],
  },
};

module.exports = nextConfig;
