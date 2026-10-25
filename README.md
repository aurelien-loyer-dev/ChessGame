# Chess Arena

Jeu d'échecs complet qui tourne entièrement dans le navigateur : IA calibrées en Elo (Stockfish 19 en WebAssembly), parties en ligne entre amis, cours interactifs, puzzles, analyse de parties et plateau 3D. Aucun serveur à héberger : c'est un site statique (Vercel, Netlify, GitHub Pages…).

## Fonctionnalités

**Jouer**
- 9 adversaires IA de **400 à 3200 Elo**. Jusqu'à 1100, Stockfish calcule les meilleurs coups puis en choisit un avec un hasard pondéré (erreurs humaines plutôt qu'aléatoires). De 1400 à 2800, c'est le limiteur officiel `UCI_Elo` de Stockfish. Singularity joue à pleine puissance.
- Cadences bullet → classique avec incrément, couleur au choix, départ depuis une FEN.
- Aides activables : indice, reprise de coup, barre d'évaluation en direct.
- Mode local à deux joueurs.
- **En ligne entre amis** : crée une partie, envoie le lien ou le code, et les coups passent directement d'un navigateur à l'autre en WebRTC (PeerJS). Horloges, nulle, revanche, réactions et reconnexion automatique.

**Apprendre**
- 5 cours / 24 leçons : bases, tactiques, mats essentiels, ouvertures (lignes à rejouer coup par coup), finales. Les exercices ont été vérifiés avec Stockfish.
- 134 puzzles classés (classement Elo), puzzle du jour et **Puzzle Rush** (3 min, 3 vies). Puzzles générés par auto-jeu Stockfish, avec un seul coup gagnant vérifié à profondeur 16.

**Analyser**
- Revue de partie : précision par camp, classification de chaque coup, moments clés, graphe d'évaluation interactif.
- Moteur en direct (3 lignes), exploration de variantes, détection d'ouverture (≈90 positions ECO), import/export PGN et FEN.

**Interface**
- Transitions 3D entre écrans, plateau 3D orbital (pièces procédurales), scène 3D sur l'accueil.
- Plateau 2D : glisser-déposer ou clic, animations, flèches au clic droit, promotion visuelle, 4 thèmes.
- Sons synthétisés, raccourcis clavier (`←` `→` `F`), responsive mobile.
- Inscription en 4 étapes (pseudo, emblème avec aperçu 3D, niveau, validation) suivie d'une animation de bienvenue en 3D. Le profil reste dans le navigateur, sans mot de passe ni e-mail.
- Profil : Elo contre l'IA, historique, échelle des IA battues, série de jours, export/import.
- Mentions légales, politique de confidentialité et gestion des cookies (mesure d'audience anonyme uniquement après consentement). Les informations de l'éditeur sont dans `src/data/legal.ts`.

## Stack

React 19 · TypeScript · Vite · chess.js · Stockfish 19 (WASM, deux Web Workers : jeu et analyse) · three.js / react-three-fiber · motion · zustand · PeerJS.

```text
src/
├─ screens/      # Accueil, Jouer, Partie, En ligne, Cours, Puzzles, Analyse, Profil
├─ components/   # Plateau 2D, horloges, liste de coups, graphes, modales
├─ three/        # Plateau 3D, scène d'accueil, pièces procédurales
├─ game/         # Logique de partie, revue, exercices
├─ online/       # Jeu en ligne pair-à-pair
├─ lib/          # Moteur Stockfish, bots, sons, règles
├─ data/         # Cours, puzzles, ouvertures
└─ store/        # Profil, réglages, session (localStorage)
```

## Démarrage

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # site statique dans dist/
npm test
```

`npm install` copie le moteur Stockfish dans `public/engine`. Pour Vercel, `vercel.json` est fourni : importer le repo suffit.

Le jeu en ligne utilise par défaut le service public gratuit de PeerJS pour mettre les deux navigateurs en relation. Pour utiliser ton propre broker : `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE`.

## Crédits

- [Stockfish](https://stockfishchess.org) (GPLv3) via [stockfish.js](https://github.com/nmrugg/stockfish.js).
- Pièces 2D « cburnett » de Colin M. L. Burnett.
- Licence du projet : MIT, voir `LICENSE`.
