import { gameConfig } from "@pokeflex/config";
import { ImageResponse } from "next/og";
import { BRAND, Monogram, spaceMonoBold } from "./brand-art";

export const alt = "PokeFlex : collectionne toutes les cartes Pokémon sorties depuis 1999";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Image de partage par défaut (réseaux sociaux, messageries). Les fiches de carte utilisent l'illustration de la carte. */
export default async function OpenGraphImage() {
  const mono = await spaceMonoBold();
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 72,
        color: BRAND.fg,
        background: `radial-gradient(circle at 85% 15%, ${BRAND.accent}55, transparent 45%), radial-gradient(circle at 10% 100%, ${BRAND.coral}40, transparent 50%)`,
        backgroundColor: BRAND.bg,
        fontFamily: mono ? "Space Mono" : "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <Monogram size={84} />
        <div
          style={{
            fontSize: 76,
            fontWeight: 700,
            letterSpacing: -2,
            backgroundImage: `linear-gradient(90deg, ${BRAND.accent}, ${BRAND.coral})`,
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          PokeFlex
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 58, fontWeight: 700, lineHeight: 1.1, maxWidth: 980 }}>Toutes les cartes Pokémon depuis 1999. À toi de les collectionner.</div>
        <div style={{ display: "flex", gap: 16, fontSize: 26, color: BRAND.muted }}>
          <span style={{ color: BRAND.lime }}>1 booster / {gameConfig.boosters.refillIntervalMs / 60_000} min</span>
          <span>·</span>
          <span>Marché entre joueurs</span>
          <span>·</span>
          <span>Gratuit, sans pub</span>
        </div>
      </div>
    </div>,
    { ...size, fonts: mono ? [{ name: "Space Mono", data: mono, weight: 700, style: "normal" }] : [] },
  );
}
