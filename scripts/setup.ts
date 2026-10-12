/**
 * Prépare l'environnement local (fonctionne sous Windows, macOS et Linux) :
 * crée .env depuis .env.example et génère AUTH_SECRET s'il est vide.
 *
 * Lancer : npm run setup
 */
import { randomBytes } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const envPath = path.join(root, ".env");
const examplePath = path.join(root, ".env.example");

if (!existsSync(envPath)) {
  copyFileSync(examplePath, envPath);
  console.log("✓ .env créé à partir de .env.example");
} else {
  console.log("• .env existe déjà, je ne l'écrase pas");
}

const env = readFileSync(envPath, "utf8");
if (/^AUTH_SECRET=""\s*$/m.test(env) || !/^AUTH_SECRET=/m.test(env)) {
  const secret = randomBytes(32).toString("base64url");
  const next = /^AUTH_SECRET=/m.test(env)
    ? env.replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${secret}"`)
    : `${env.trimEnd()}\nAUTH_SECRET="${secret}"\n`;
  writeFileSync(envPath, next);
  console.log("✓ AUTH_SECRET généré");
} else {
  console.log("• AUTH_SECRET déjà défini");
}

console.log("\nÉtapes suivantes :\n  npm run db:up\n  npm run db:deploy\n  npm run db:seed\n  npm run dev");
