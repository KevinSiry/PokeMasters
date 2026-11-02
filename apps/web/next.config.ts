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
    // Images de cartes : CDN TCGdex, scans Poképédia (cartes FR non scannées), Pokémon TCG API ; jamais re-hébergées.
    remotePatterns: [
      { protocol: "https", hostname: "assets.tcgdex.net" },
      { protocol: "https", hostname: "images.pokemontcg.io" },
      { protocol: "https", hostname: "www.pokepedia.fr" },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
