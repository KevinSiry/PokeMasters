import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";

// Le fichier .env unique vit à la racine du monorepo.
const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
loadEnvConfig(rootDir);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Les paquets internes sont publiés en TypeScript source.
  transpilePackages: ["@pokeflex/config", "@pokeflex/db", "@pokeflex/game", "@pokeflex/server"],
  outputFileTracingRoot: rootDir,
  poweredByHeader: false,
  images: {
    // Les images de cartes viennent du CDN TCGdex, jamais re-hébergées.
    remotePatterns: [{ protocol: "https", hostname: "assets.tcgdex.net" }],
    unoptimized: true,
  },
};

export default nextConfig;
