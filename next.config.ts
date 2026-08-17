import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_PAGES === "true";

const nextConfig: NextConfig = {
  ...(isGitHubPages ? {
    output: "export",
    basePath: "/ai_literacy",
    assetPrefix: "/ai_literacy",
    trailingSlash: true,
    typescript: { ignoreBuildErrors: true },
  } : {}),
};

export default nextConfig;
