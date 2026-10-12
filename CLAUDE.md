# PokeFlex — consignes pour les sessions Claude

- Échanges avec Kevin **en français**. Il développe sous **Windows (PowerShell)** avec Docker Desktop : toute commande ou script doit marcher sous Windows (scripts Node/TS, pas de bash).
- Plan validé : `docs/plan-v1.md`. On avance phase par phase, une PR par phase ; à la fin de chaque phase, lint + typecheck + tests + build verts et récap.
- Toute valeur d'équilibrage va dans `config/game.ts` ; toute décision dans `DECISIONS.md`.
- La logique métier va dans `packages/game` (pure, sans I/O, testée avec Vitest). Le serveur est autoritaire : le client n'envoie que des intentions.
- Ne jamais re-héberger les images de cartes : URLs du CDN `assets.tcgdex.net`.
- Vérifs avant PR : `npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e`.
