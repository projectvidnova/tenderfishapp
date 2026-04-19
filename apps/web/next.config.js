/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone",
  transpilePackages: ["@tenderfish/shared"],
};

module.exports = nextConfig;
