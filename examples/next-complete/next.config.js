/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // this allows us to return dates in the `getServerSideProps` function
    swcPlugins: [['next-superjson-plugin', {}]],
  },
  images: {
    domains: [
      process.env.NEXT_PUBLIC_EDGE_STORE_BASE_URL.replace('https://', ''),
      'files.edgestore.dev',
    ],
  },
};

module.exports = nextConfig;
