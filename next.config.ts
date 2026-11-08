import { createRequire } from "node:module";
import path from "node:path";
import type { NextConfig } from "next";

const appRequire = createRequire(path.join(process.cwd(), "package.json"));
const nextClientPath = path.join(
  path.dirname(appRequire.resolve("next/package.json")),
  "dist",
  "client",
);
const runtimeFiles = [
  "next.js",
  "next-dev.js",
  "app-next.js",
  "app-next-dev.js",
  path.join("dev", "amp-dev.js"),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack(config) {
    for (const file of runtimeFiles) {
      const target = path.join(nextClientPath, file);
      const relativeTarget = path.relative(process.cwd(), target);

      if (!path.isAbsolute(relativeTarget)) continue;

      config.resolve.alias = {
        ...config.resolve.alias,
        [`./${relativeTarget.replace(/\\/g, "/")}`]: target,
      };
    }

    return config;
  },
};

export default nextConfig;
