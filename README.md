# Chess Arena

Jeu d'échecs complet dans le navigateur : IA calibrées en Elo (Stockfish 19 en WebAssembly), parties en ligne, cours interactifs, puzzles, analyse de parties et plateau 3D.

## Fonctionnalités

**Jouer**
- 9 adversaires IA de **400 à 3200 Elo**. Jusqu'à 1100, Stockfish calcule les meilleurs coups puis en choisit un avec un hasard pondéré (erreurs humaines plutôt qu'aléatoires). De 1400 à 2800, c'est le limiteur officiel `UCI_Elo` de Stockfish. Singularity joue à pleine puissance.
- Cadences bullet → classique avec incrément, couleur au choix, départ depuis une FEN.
- Aides activables : indice (meilleur coup), reprise de coup, barre d'évaluation en direct.
- Mode local à deux joueurs.
- **En ligne** : matchmaking par cadence (appariement au classement le plus proche), salons privés avec code ou lien, horloges arbitrées par le serveur, reconnexion automatique (60 s de grâce), propositions de nulle, revanche, réactions, classement Elo.

**Apprendre**
- 5 cours / 24 leçons : bases, tactiques, mats essentiels, ouvertures (lignes à rejouer coup par coup), finales. Chaque exercice est vérifié par Stockfish (`npm run verify:lessons -w @chess/web`).
- Puzzles classés (classement Elo), puzzle du jour, **Puzzle Rush** (3 min, 3 vies). Les puzzles sont générés hors ligne par auto-jeu Stockfish puis vérifiés (coup unique gagnant à profondeur 16).

**Analyser**
- Revue de partie automatique : précision par camp, classification de chaque coup (meilleur, imprécision, erreur, gaffe…), moments clés, graphe d'évaluation interactif.
- Moteur en direct (3 lignes, profondeur 20), exploration de variantes, détection d'ouverture (≈90 positions ECO, transpositions comprises), import/export PGN et FEN.

**Interface**
- Transitions 3D entre écrans, plateau 3D orbital (pièces procédurales, aucun modèle à télécharger), scène 3D animée sur l'accueil.
- Plateau 2D : glisser-déposer ou clic, animations des pièces, flèches et cercles au clic droit, promotion visuelle, 4 thèmes.
- Sons synthétisés (Web Audio), raccourcis clavier (`←` `→` `F`), responsive mobile.
- Profil local : Elo contre l'IA avec courbe, historique, échelle des IA battues, série de jours, export/import des données.

## Architecture

```text
ChessGame/
├─ apps/
│  ├─ web/        # React 19 + TypeScript + Vite, Stockfish 19 WASM, three.js / react-three-fiber, motion
│  └─ server/     # Node + ws : matchmaking, salons, horloges, Elo, classement (JSON), sert le build web
├─ packages/
│  └─ shared/     # Protocole WebSocket typé et cadences, partagés client/serveur
└─ backup/        # Ancienne version C++/SFML conservée pour référence
```

- Les règles sont gérées par `chess.js` des deux côtés ; le serveur valide chaque coup et arbitre le temps.
- Le moteur tourne dans deux Web Workers (un pour l'IA, un pour l'analyse) afin que la barre d'évaluation ne ralentisse jamais l'adversaire.
- Les données joueur sont locales (`localStorage`) ; seul le classement en ligne vit sur le serveur.

## Démarrage

Prérequis : Node 20+.

```bash
npm install          # installe tout et copie Stockfish dans apps/web/public/engine
npm run dev          # serveur sur :8080 + Vite sur :5173 (proxy /ws et /api)
```

Ouvre http://localhost:5173. Sans le serveur, tout fonctionne sauf le jeu en ligne.

### Production

```bash
npm run build        # build du front dans apps/web/dist
npm start            # le serveur sert le front et le WebSocket sur $PORT (8080)
```

Ou avec Docker :

```bash
docker build -t chess-arena .
docker run -p 8080:8080 -v chess-data:/data chess-arena
```

Front sur Vercel et serveur ailleurs : `vercel.json` est fourni ; définis `VITE_SERVER_URL` (voir `apps/web/.env.example`) et `ALLOWED_ORIGINS` côté serveur.

| Variable serveur | Rôle | Défaut |
| --- | --- | --- |
| `PORT` | Port HTTP/WS | `8080` |
| `DATA_FILE` | Fichier JSON des joueurs | `apps/server/data/players.json` |
| `WEB_DIST` | Dossier du build web à servir | `apps/web/dist` |
| `ALLOWED_ORIGINS` | Origines autorisées (séparées par des virgules) | toutes |

## Tests et outils

```bash
npm test             # tests web (contenus, moteur, règles) + serveur (horloges, matchmaking, reconnexion)
npm run typecheck
npm run generate:puzzles -w @chess/web -- 50 3 1000  # génère 50 puzzles ≥ 1000 Elo
npm run verify:lessons -w @chess/web                 # vérifie les leçons avec Stockfish
```

## Crédits

- [Stockfish](https://stockfishchess.org) (GPLv3) via [stockfish.js](https://github.com/nmrugg/stockfish.js).
- Pièces 2D « cburnett » de Colin M. L. Burnett.
- Licence du projet : MIT, voir `LICENSE`.
