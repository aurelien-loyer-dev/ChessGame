# Chess Game - SFML

Un jeu d'échecs complet avec interface graphique en C++ utilisant SFML.

![Chess Game](screenshots/chess_preview.png)

## Fonctionnalités

- ♟️ Règles d'échecs complètes
  - Tous les mouvements de pièces standards
  - Roque (petit et grand)
  - Prise en passant
  - Promotion des pions
- 🎨 Interface utilisateur élégante
  - Design moderne avec thème vert/crème
  - Surbrillance des coups légaux
  - Animation des mouvements
  - Indicateur de tour
  - Détection d'échec et mat
- 🎮 Contrôles intuitifs
  - Clic gauche pour sélectionner/déplacer
  - Clic droit pour désélectionner
  - Touches clavier pour la promotion

## Prérequis

- macOS 10.15 ou plus récent
- SFML 2.5 ou plus récent
- Compilateur C++17 (Clang/GCC)

## Installation de SFML sur macOS

### Option 1: Homebrew (recommandé)

```bash
# Installer Homebrew si ce n'est pas déjà fait
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Installer SFML
brew install sfml
```

### Option 2: Téléchargement direct

1. Télécharger SFML depuis [sfml-dev.org](https://www.sfml-dev.org/download/sfml/2.6.1/)
2. Extraire dans `/usr/local/` ou configurer CMAKE_PREFIX_PATH

## Compilation

```bash
# Créer le dossier de build
mkdir build
cd build

# Configurer avec CMake
cmake ..

# Compiler
make -j$(sysctl -n hw.ncpu)
```

### Compilation avec Xcode

```bash
mkdir build
cd build
cmake -G Xcode ..
open ChessGame.xcodeproj
```

## Exécution

```bash
# Depuis le dossier build
./ChessGame

# Ou sur macOS avec bundle
open ChessGame.app
```

## Contrôles

| Action | Contrôle |
|--------|----------|
| Sélectionner une pièce | Clic gauche |
| Déplacer une pièce | Clic gauche sur destination |
| Annuler la sélection | Clic droit |
| Nouvelle partie | Touche `R` |
| Quitter | Touche `ESC` |

### Promotion de pion

Quand un pion atteint la dernière rangée :
- `Q` - Dame
- `R` - Tour
- `B` - Fou
- `N` - Cavalier

## Structure du Projet

```
echecs/
├── CMakeLists.txt
├── README.md
├── include/
│   ├── Types.hpp       # Types et énumérations
│   ├── Piece.hpp       # Classe pièce
│   ├── Board.hpp       # Plateau de jeu
│   ├── ChessLogic.hpp  # Logique des échecs
│   ├── Renderer.hpp    # Rendu graphique
│   └── Game.hpp        # Boucle de jeu principale
├── src/
    ├── main.cpp
    ├── Piece.cpp
    ├── Board.cpp
    ├── ChessLogic.cpp
    ├── Renderer.cpp
    └── Game.cpp
```

## Architecture

### Classes principales

- **Game** : Gère la boucle principale, les événements et coordonne les autres composants
- **Board** : Représente l'échiquier avec les pièces
- **ChessLogic** : Implémente toutes les règles d'échecs
- **Renderer** : Gère l'affichage graphique avec SFML
- **Piece** : Représente une pièce d'échec

### Caractéristiques techniques

- Utilisation des caractères Unicode pour les pièces (♔♕♖♗♘♙)
- Rendu avec anti-aliasing
- Animation fluide des mouvements
- Vérification complète des coups légaux

## Palette de couleurs

| Élément | Couleur |
|---------|---------|
| Cases claires | #EEEED2 (Crème) |
| Cases foncées | #769656 (Vert forêt) |
| Sélection | #BACA44 (Jaune-vert) |
| Coups légaux | Gris semi-transparent |
| Captures | Rouge semi-transparent |
| Échec | Rouge vif |

## Dépannage

### SFML non trouvé
```bash
# Vérifier l'installation de SFML
brew info sfml

# Si nécessaire, spécifier le chemin
cmake -DSFML_DIR=/usr/local/lib/cmake/SFML ..
```

### Problèmes de polices
Le jeu utilise les polices système macOS. Si les pièces ne s'affichent pas correctement, vérifiez que vous avez "Arial Unicode.ttf" ou "Apple Symbols.ttf" installés.

## Licence

Ce projet est sous licence MIT. Voir le fichier LICENSE pour plus de détails.

## Améliorations futures

- [ ] Mode 2 joueurs en réseau
- [ ] IA avec minimax et élagage alpha-beta
- [ ] Historique des coups avec notation algébrique
- [ ] Sauvegarde/Chargement de parties (format PGN)
- [ ] Thèmes personnalisables
- [ ] Son et musique
- [ ] Horloge d'échecs

---

Développé avec ❤️ et SFML
