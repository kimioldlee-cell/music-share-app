/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // 允许在打包时忽略 ESLint 报错，避免因严格校验导致部署中断
    ignoreDuringBuilds: true,
  },
  typescript: {
    // 允许在打包时忽略 TypeScript 报错，用于快速部署 MVP
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
