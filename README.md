# Chess Arena Monorepo

Projet d'echecs multi-frontends avec IA locale et integration API, compose de:
1. Une app React/Vite moderne pour jouer localement, contre IA, ou en ligne.
2. Un backend web Python (aiohttp) pour servir des assets et des endpoints API.
3. Un prototype C++/SFML historique conserve dans `backup/`.

## Apercu

- Frontend principal: `react-app/`
- Backend web: `web/`
- Legacy C++ (reference): `backup/`

## Fonctionnalites actuelles

- Regles d'echecs completes: roque, en passant, promotion, echec/mat, pat.
- Modes de jeu: local 2 joueurs, vs IA, online (via WebSocket/API).
- IA hybride:
1. Niveaux faibles/moyens avec moteur JS local.
2. Niveaux eleves avec pipeline API/WASM et fallback de securite.
- Interface moderne React avec historique des coups, timers, pieces capturees, overlays.
- Fond 3D anime via Three.js.

## Structure du repo

```text
ChessGame/
|- README.md
|- LICENSE
|- react-app/          # Frontend principal (React + Vite)
|- web/                # Backend Python (aiohttp) + static app
`- backup/             # Ancienne version C++/SFML (reference)
```

## Quickstart local

### 1) Lancer le backend web

```bash
cd web
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python server.py
```

Le serveur tourne par defaut sur `http://localhost:8080`.

### 2) Lancer le frontend React

```bash
cd react-app
npm install
npm run dev
```

Vite demarre en general sur `http://localhost:5173`.
La config proxy en dev redirige:
1. `/api` vers `http://localhost:8080`
2. `/ws` vers `ws://localhost:8080`

## Build frontend

```bash
cd react-app
npm run build
npm run preview
```

## Configuration IA (React)

Le frontend React supporte une API IA externe de fort niveau.

1. Copier les variables de `react-app/.env.example` vers un fichier `.env`.
2. Configurer au minimum l'URL du backend IA si necessaire.

Variables disponibles:
1. `VITE_AI_API_BASE_URL`
2. `VITE_AI_API_MOVE_PATH`
3. `VITE_AI_API_KEY`
4. `VITE_AI_API_TIMEOUT_MS`
5. `VITE_AI_FORCE_SERVER`

Exemple:

```env
VITE_AI_API_BASE_URL=http://localhost:8080
VITE_AI_API_MOVE_PATH=/api/ai-move
VITE_AI_API_TIMEOUT_MS=15000
VITE_AI_FORCE_SERVER=false
```

## API et compatibilite

Le frontend React consomme plusieurs endpoints, notamment:
1. `POST /api/login`
2. `POST /api/register`
3. `POST /api/verify-token`
4. `GET /api/ranking`
5. `GET /api/online-players`
6. `POST /api/ai-move`
7. `WS /ws`

Le serveur `web/server.py` actuel est une version simplifiee orientee demo. Selon ton usage (online complet + IA serveur), tu peux avoir besoin d'un backend plus complet que celui present dans `web/`.

## Mode C++/SFML (legacy)

Le code C++ se trouve dans `backup/` et reste utile pour reference technique. Ce n'est plus le frontend principal du projet.

## Stack technique

- Frontend: React 18, Vite, Three.js
- Backend: Python 3, aiohttp
- IA: moteur JS, Stockfish WASM, API IA externe configurable
- Analytics: `@vercel/analytics`

## Idees sympas a ajouter

- Relecture de partie avec timeline interactive et eval bar.
- Import/export PGN avec annotations.
- Puzzle mode quotidien (mate in 2/3).
- Opening explorer local (ECO + stats).
- Profil ELO local avec historique de progression.
- Theme editor (plateau, pieces, effets sonores, ambience).

## Roadmap

- [ ] Unifier le backend API pour couvrir tous les appels React.
- [ ] Ajouter tests automatiques pour la logique d'echecs et les hooks.
- [ ] Stabiliser completement le mode GM en production (telemetrie IA + retries).
- [ ] Ajouter sauvegarde cloud des parties et replay shareable.

## Licence

Projet sous licence MIT. Voir `LICENSE`.
