/** @type {import('next').NextConfig} */
const nextConfig = {
  // Disable the "X-Powered-By" header for security
  poweredByHeader: false,

  // Enable React strict mode for development best practices
  reactStrictMode: true,

  // Configure image domains if needed later
  images: {
    domains: [],
  },

  async redirects() {
    return [
      {
        source: "/input",
        destination: "/record",
        permanent: false,
      },
      {
        source: "/history",
        destination: "/insights",
        permanent: false,
      },
      {
        source: "/advice",
        destination: "/discovery-hub",
        permanent: false,
      },
      {
        source: "/settings",
        destination: "/profile",
        permanent: false,
      },
    ];
  },
};

module.exports = nextConfig;
