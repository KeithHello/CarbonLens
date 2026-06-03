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
};

module.exports = nextConfig;
