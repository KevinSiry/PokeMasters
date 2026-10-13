import { ImageResponse } from "next/og";
import { BRAND, Monogram } from "./brand-art";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Icône d'écran d'accueil iOS : monogramme sur fond de la marque. */
export default function AppleIcon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: BRAND.bg }}>
      <Monogram size={104} />
    </div>,
    size,
  );
}
