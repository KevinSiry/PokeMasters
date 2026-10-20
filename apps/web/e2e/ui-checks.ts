/**
 * Contrôles d'interface partagés par les tests e2e et l'audit (`npm run audit:ui`).
 */
import type { Page } from "@playwright/test";

/** Zone tactile minimale visée sur écran tactile (recommandation Apple et Material, au-delà de WCAG 2.5.8). */
export const MIN_TOUCH_TARGET = 44;

/**
 * Débordement horizontal mesuré contre la largeur de l'écran émulé : sur mobile, le navigateur
 * élargit la fenêtre au contenu (et dézoome toute la page), donc window.innerWidth ne suffit pas.
 */
export async function overflowX(page: Page) {
  const width = page.viewportSize()!.width;
  return (await page.evaluate(() => document.documentElement.scrollWidth)) - width;
}

export interface SmallTarget {
  what: string;
  w: number;
  h: number;
}

/**
 * Contrôles visibles dont la zone cliquable fait moins de `min` px de côté.
 * La zone compte l'élément, son libellé (case à cocher dans un <label>) et l'agrandissement
 * invisible `.pf-hit` (pseudo-élément ::after). Un lien au fil d'une phrase est exempté (WCAG 2.5.8).
 */
export async function smallTargets(page: Page, min = MIN_TOUCH_TARGET, scope = "body"): Promise<SmallTarget[]> {
  return page.evaluate(([min, scope]) => {
    const out: { what: string; w: number; h: number }[] = [];
    const controls = [...document.querySelectorAll(scope)].flatMap((root) => [...root.querySelectorAll(
      "a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem]",
    )]);
    for (const el of controls) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      if (r.width <= 1 || r.height <= 1 || s.visibility === "hidden") continue;
      if (el.closest("[hidden], [aria-hidden='true'], dialog:not([open])")) continue;
      const inline = s.display === "inline" && el.parentElement?.closest("p, li, dd, td, figcaption") != null;
      if (inline) continue;
      let w = r.width;
      let h = r.height;
      const label = (el as HTMLInputElement).labels?.[0]?.getBoundingClientRect();
      if (label) {
        w = Math.max(w, label.width);
        h = Math.max(h, label.height);
      }
      const after = getComputedStyle(el, "::after");
      if (after.content !== "none" && after.position === "absolute") {
        w = Math.max(w, parseFloat(after.width) || 0);
        h = Math.max(h, parseFloat(after.height) || 0);
      }
      if (w < min - 0.5 || h < min - 0.5) {
        const name = el.getAttribute("aria-label") ?? (el as HTMLElement).innerText?.trim() ?? "";
        out.push({ what: `${el.tagName.toLowerCase()} « ${name.replace(/\s+/g, " ").slice(0, 40)} »`, w: Math.round(w), h: Math.round(h) });
      }
    }
    return out;
  }, [min, scope] as const);
}

/** Contrôles sans nom accessible (ni texte, ni aria-label, ni libellé, ni image décrite). */
export async function unnamedControls(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll("a[href], button, input:not([type=hidden]), select, textarea")) {
      const r = el.getBoundingClientRect();
      if (r.width <= 1 || r.height <= 1 || el.closest("[hidden], [aria-hidden='true']")) continue;
      const named =
        el.getAttribute("aria-label") ||
        el.getAttribute("aria-labelledby") ||
        el.getAttribute("title") ||
        (el as HTMLElement).innerText?.trim() ||
        el.querySelector("img[alt]:not([alt=''])") ||
        (el as HTMLInputElement).labels?.length;
      if (!named) out.push(el.outerHTML.slice(0, 120));
    }
    return out;
  });
}

/** Images sans attribut alt (une image décorative a alt=""). */
export async function imagesWithoutAlt(page: Page): Promise<number> {
  return page.locator("img:not([alt])").count();
}
