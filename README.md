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
- Inscription en 4 étapes (pseudo, emblème avec aperçu 3D, niveau, validation) suivie d'une animation de bienvenue en 3D.
- Comptes : inscription et connexion par e-mail et mot de passe (confirmation d'adresse, mot de passe oublié) ou avec GitHub / Google, sauvegarde automatique du profil et reconnexion sur n'importe quel appareil (Supabase).
- Mode invité : jouer contre l'IA, en local et analyser une partie sans compte ; cours, puzzles, jeu en ligne et profil demandent un compte. Sans configuration Supabase, l'app reste entièrement locale.
- Déconnexion, export/import et suppression des données (RGPD).
- Profil : Elo contre l'IA, historique, échelle des IA battues, série de jours, export/import.
- Mentions légales, politique de confidentialité et gestion des cookies (mesure d'audience anonyme uniquement après consentement). Les informations de l'éditeur sont dans `src/data/legal.ts`.

## Stack

React 19 · TypeScript · Vite · chess.js · Stockfish 19 (WASM, deux Web Workers : jeu et analyse) · three.js / react-three-fiber · motion · zustand · PeerJS · Supabase (auth OAuth + sauvegardes).

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

## Comptes (Supabase)

Les comptes (e-mail + mot de passe, GitHub, Google) et les sauvegardes passent par [Supabase](https://supabase.com) (offre gratuite suffisante). Aucun serveur à héberger.

1. Crée un projet Supabase, de préférence dans une région européenne (Francfort ou Paris).
2. **SQL Editor** : exécute `supabase/migrations/0001_cloud_saves.sql` (table `saves` protégée par RLS + fonction de suppression de compte).
3. **Authentication → URL Configuration** : *Site URL* = l'URL de ton site (ex. `https://chess-arena.vercel.app`), et ajoute-la aussi dans *Redirect URLs* avec `http://localhost:5173` pour le développement.
4. **Authentication → Providers → Email** : laisse-le activé avec *Confirm email*. Pour la production, configure un SMTP (**Authentication → Emails → SMTP Settings**) : l'envoi intégré de Supabase est limité à quelques e-mails par heure. Tu peux traduire les modèles d'e-mails en français dans **Authentication → Emails → Templates**.
5. **Authentication → Providers**, active aussi GitHub et/ou Google. Pour chacun, l'URL de callback à déclarer chez le fournisseur est `https://<ton-projet>.supabase.co/auth/v1/callback`.
   - **GitHub** : GitHub → Settings → Developer settings → OAuth Apps → New OAuth App, puis copie Client ID et Client secret dans Supabase.
   - **Google** : Google Cloud Console → APIs & Services → Credentials → OAuth client ID (type Web), puis copie l'ID et le secret.
6. **Settings → API** : copie l'URL du projet et la clé `anon` dans les variables d'environnement Vercel (voir `.env.example`) :
   `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (et `VITE_AUTH_PROVIDERS=github` pour n'afficher que GitHub).
7. Redéploie. L'écran de connexion apparaît à l'ouverture du site, avec l'option « Jouer en invité ».

**Sécurité** : `VITE_SUPABASE_URL` et la clé `anon` sont intégrées au JavaScript du site, c'est voulu. La protection repose sur la RLS de la migration : sans connexion, aucun accès à la table ; connecté, chaque joueur ne peut lire, écrire ou supprimer que sa propre ligne, et la date de sauvegarde est fixée par le serveur. Ne mets jamais la clé `service_role` dans une variable `VITE_`. Après la migration, l'onglet **Advisors → Security** de Supabase ne doit signaler aucune alerte sur `saves`.

La synchronisation est automatique : chaque changement est envoyé quelques secondes après ; à la connexion sur un nouvel appareil, la sauvegarde est restaurée ; si les deux versions ont changé, le joueur choisit laquelle garder.

## Crédits

- [Stockfish](https://stockfishchess.org) (GPLv3) via [stockfish.js](https://github.com/nmrugg/stockfish.js).
- Pièces 2D « cburnett » de Colin M. L. Burnett.
- Licence du projet : MIT, voir `LICENSE`.
