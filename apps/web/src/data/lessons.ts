import type { Color } from '@chess/shared';
import type { Square } from '../lib/chess';

export type LessonStep =
  | {
      kind: 'info';
      title?: string;
      text: string;
      fen?: string;
      /** SAN moves played from the initial position (alternative to `fen`). */
      moves?: string;
      arrows?: [Square, Square][];
      marks?: Square[];
      orientation?: Color;
    }
  | {
      kind: 'move';
      text: string;
      fen?: string;
      moves?: string;
      /** UCI line alternating the learner's move and the scripted reply. */
      solution: string[];
      /** Accept any checkmating move as correct. */
      anyMate?: boolean;
      /** Other first moves that also count as correct (single-move steps only). */
      alternatives?: string[];
      /** Rule demonstration: the move is required by the text, not by engine strength. */
      rule?: boolean;
      hint?: string;
      success?: string;
      orientation?: Color;
    }
  | {
      kind: 'line';
      text: string;
      /** SAN sequence to reproduce; the learner plays `userColor`, the coach plays the rest. */
      line: string;
      userColor: Color;
      success?: string;
    };

export interface Lesson {
  id: string;
  title: string;
  summary: string;
  steps: LessonStep[];
}

export interface Course {
  id: string;
  title: string;
  level: 'Débutant' | 'Intermédiaire' | 'Avancé';
  description: string;
  glyph: string;
  hue: number;
  lessons: Lesson[];
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const COURSES: Course[] = [
  {
    id: 'bases',
    title: 'Les bases',
    level: 'Débutant',
    description: 'Le plateau, la marche de chaque pièce et les règles spéciales.',
    glyph: '♙',
    hue: 160,
    lessons: [
      {
        id: 'plateau',
        title: 'Le plateau',
        summary: 'Colonnes, rangées et position de départ.',
        steps: [
          {
            kind: 'info',
            title: 'Un champ de 64 cases',
            text: 'L’échiquier compte 8 colonnes (de a à h) et 8 rangées (de 1 à 8). Chaque case a un nom : la case en bas à droite, toujours claire, s’appelle h1.',
            fen: '8/8/8/8/8/8/8/8 w - - 0 1',
            marks: ['h1', 'a1', 'e4'],
          },
          {
            kind: 'info',
            title: 'La position de départ',
            text: 'Les Blancs commencent toujours. La dame se place sur sa couleur : dame blanche sur d1 (case claire), dame noire sur d8 (case foncée).',
            fen: START,
            marks: ['d1', 'd8'],
          },
          {
            kind: 'move',
            text: 'À toi : avance le pion e de deux cases (e2 → e4). Au premier coup, un pion peut avancer d’une ou deux cases.',
            fen: START,
            solution: ['e2e4'],
            rule: true,
            hint: 'Clique sur le pion en e2, puis sur la case e4.',
            success: 'Parfait. 1.e4 est l’ouverture la plus jouée de l’histoire.',
          },
        ],
      },
      {
        id: 'tour',
        title: 'La tour',
        summary: 'Les lignes droites et le mat du couloir.',
        steps: [
          {
            kind: 'info',
            title: 'Lignes droites',
            text: 'La tour se déplace d’autant de cases qu’elle veut, horizontalement ou verticalement, sans sauter par-dessus les pièces. Elle vaut environ 5 pions.',
            fen: '8/8/8/8/3R4/8/8/8 w - - 0 1',
            arrows: [['d4', 'd8'], ['d4', 'd1'], ['d4', 'a4'], ['d4', 'h4']],
          },
          {
            kind: 'move',
            text: 'La dame noire est sur la même colonne que ta tour. Capture-la.',
            fen: '4k3/8/8/8/q7/8/8/R5K1 w - - 0 1',
            solution: ['a1a4'],
            success: 'Une dame gagnée pour rien : la tour contrôle toute la colonne a.',
          },
          {
            kind: 'move',
            text: 'Le roi noir est enfermé derrière ses propres pions. Trouve le mat en un coup.',
            fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
            solution: ['a1a8'],
            anyMate: true,
            hint: 'Attaque la dernière rangée.',
            success: 'C’est le mat du couloir, l’un des plus fréquents en partie.',
          },
        ],
      },
      {
        id: 'fou',
        title: 'Le fou',
        summary: 'Les diagonales et la couleur des cases.',
        steps: [
          {
            kind: 'info',
            title: 'Les diagonales',
            text: 'Le fou se déplace en diagonale, aussi loin qu’il veut. Il reste toute la partie sur la même couleur de case. Il vaut environ 3 pions.',
            fen: '8/8/8/8/3B4/8/8/8 w - - 0 1',
            arrows: [['d4', 'h8'], ['d4', 'a7'], ['d4', 'a1'], ['d4', 'g1']],
          },
          {
            kind: 'move',
            text: 'Ton fou en a1 vise toute la grande diagonale. Capture la tour noire.',
            fen: '4k3/8/8/8/8/2r5/8/B5K1 w - - 0 1',
            solution: ['a1c3'],
            success: 'Bien vu. Un fou sur la grande diagonale est souvent redoutable.',
          },
        ],
      },
      {
        id: 'dame',
        title: 'La dame',
        summary: 'La pièce la plus puissante.',
        steps: [
          {
            kind: 'info',
            title: 'Tour + fou',
            text: 'La dame combine les mouvements de la tour et du fou. Elle vaut environ 9 pions : ne la sors pas trop tôt, elle se ferait chasser par les pièces adverses.',
            fen: '8/8/8/8/3Q4/8/8/8 w - - 0 1',
            arrows: [['d4', 'd8'], ['d4', 'h8'], ['d4', 'h4'], ['d4', 'g1'], ['d4', 'd1'], ['d4', 'a1'], ['d4', 'a4'], ['d4', 'a7']],
          },
          {
            kind: 'move',
            text: 'Ton roi en b6 bloque les cases de fuite. Donne mat avec la dame.',
            fen: 'k7/8/1K6/8/8/8/7Q/8 w - - 0 1',
            solution: ['h2h8'],
            anyMate: true,
            success: 'Mat ! La dame contrôle la rangée, le roi blanc fait le reste.',
          },
        ],
      },
      {
        id: 'roi',
        title: 'Le roi',
        summary: 'Une case à la fois, jamais en échec.',
        steps: [
          {
            kind: 'info',
            title: 'Le roi',
            text: 'Le roi avance d’une case dans toutes les directions. Il ne peut jamais aller sur une case attaquée : se mettre en échec est interdit.',
            fen: '8/8/8/8/3K4/8/8/8 w - - 0 1',
            marks: ['c3', 'c4', 'c5', 'd3', 'd5', 'e3', 'e4', 'e5'],
          },
          {
            kind: 'move',
            text: 'Ton roi est en échec par la dame noire, qui n’est pas protégée. Débarrasse-toi d’elle.',
            fen: '7k/8/8/8/8/3q4/3K4/8 w - - 0 1',
            solution: ['d2d3'],
            rule: true,
            success: 'Le roi peut capturer, à condition que la pièce ne soit pas défendue.',
          },
        ],
      },
      {
        id: 'cavalier',
        title: 'Le cavalier',
        summary: 'Le saut en L et la fourchette.',
        steps: [
          {
            kind: 'info',
            title: 'Le saut en L',
            text: 'Le cavalier saute en L : deux cases dans une direction puis une sur le côté. C’est la seule pièce qui passe par-dessus les autres.',
            fen: '8/8/8/8/3N4/8/8/8 w - - 0 1',
            marks: ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5'],
          },
          {
            kind: 'move',
            text: 'Un saut peut attaquer deux pièces à la fois. Trouve la fourchette entre le roi et la tour.',
            fen: 'r3k3/8/8/3N4/8/8/8/4K3 w - - 0 1',
            solution: ['d5c7', 'e8d7', 'c7a8'],
            hint: 'Cherche une case d’où le cavalier attaque e8 et a8.',
            success: 'Fourchette royale : le roi doit bouger et la tour tombe.',
          },
        ],
      },
      {
        id: 'speciaux',
        title: 'Coups spéciaux',
        summary: 'Roque, prise en passant et promotion.',
        steps: [
          {
            kind: 'move',
            text: 'Le roque met le roi à l’abri et active la tour. Fais le petit roque : déplace ton roi de deux cases vers la tour h1.',
            fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
            solution: ['e1g1'],
            rule: true,
            hint: 'Fais glisser le roi de e1 vers g1.',
            success: 'Roqué ! Le roi est en g1, la tour a sauté en f1.',
          },
          {
            kind: 'move',
            text: 'Le pion noir vient d’avancer de deux cases (d7 → d5) à côté du tien. Prends-le en passant.',
            fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1',
            solution: ['e5d6'],
            rule: true,
            hint: 'Ton pion capture en diagonale vers d6, comme si le pion noir n’avait avancé que d’une case.',
            success: 'La prise en passant n’est possible qu’immédiatement après la double avancée.',
          },
          {
            kind: 'move',
            text: 'Un pion qui atteint la dernière rangée se transforme. Promeus ton pion en dame.',
            fen: '4k3/P7/8/8/8/8/8/4K3 w - - 0 1',
            solution: ['a7a8q'],
            rule: true,
            success: 'Nouvelle dame, et elle donne échec en prime.',
          },
        ],
      },
      {
        id: 'mat',
        title: 'Échec, mat et pat',
        summary: 'Comment une partie se termine.',
        steps: [
          {
            kind: 'info',
            title: 'Les trois fins',
            text: 'Échec : le roi est attaqué et doit s’en sortir. Mat : il ne peut plus s’en sortir, la partie est gagnée. Pat : le camp au trait n’a aucun coup légal sans être en échec, et c’est nulle. Ici, les Noirs sont pat.',
            fen: '7k/5Q2/6K1/8/8/8/8/8 b - - 0 1',
          },
          {
            kind: 'move',
            text: 'Trouve le mat en un coup avec la tour.',
            fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1',
            solution: ['d1d8'],
            anyMate: true,
            success: 'Mat. Tu connais maintenant toutes les règles.',
          },
        ],
      },
    ],
  },
  {
    id: 'tactiques',
    title: 'Tactiques',
    level: 'Intermédiaire',
    description: 'Les motifs qui gagnent du matériel : fourchette, clouage, enfilade, découverte.',
    glyph: '♘',
    hue: 210,
    lessons: [
      {
        id: 'fourchette',
        title: 'La fourchette',
        summary: 'Une pièce, deux cibles.',
        steps: [
          {
            kind: 'info',
            title: 'Deux cibles',
            text: 'Une fourchette attaque deux pièces en même temps. L’adversaire ne peut en sauver qu’une. Toutes les pièces peuvent fourchetter, même les pions.',
            fen: '4k3/8/8/2n1b3/3P4/2P5/8/4K3 b - - 0 1',
            arrows: [['d4', 'c5'], ['d4', 'e5']],
          },
          {
            kind: 'move',
            text: 'Avec un pion, attaque le cavalier et le fou noirs à la fois.',
            fen: '4k3/8/8/2n1b3/8/2PP4/8/4K3 w - - 0 1',
            solution: ['d3d4'],
            success: 'Le pion est protégé par c3 : une des deux pièces va tomber.',
          },
          {
            kind: 'move',
            text: 'Le cavalier est le roi des fourchettes. Gagne la dame noire.',
            fen: '2q1k3/8/8/8/4N3/8/8/4K3 w - - 0 1',
            solution: ['e4d6', 'e8d7', 'd6c8'],
            hint: 'Un saut qui donne échec et attaque c8.',
            success: 'Échec et attaque de la dame : imparable.',
          },
        ],
      },
      {
        id: 'clouage',
        title: 'Le clouage',
        summary: 'Immobiliser une pièce devant plus précieux.',
        steps: [
          {
            kind: 'info',
            title: 'Cloué',
            text: 'Une pièce est clouée quand elle ne peut pas bouger sans exposer une pièce plus importante derrière elle. Clouée devant le roi, elle ne peut plus bouger du tout.',
            moves: 'd4 Nf6 c4 e6 Nc3 Bb4',
            arrows: [['b4', 'e1']],
            marks: ['c3'],
          },
          {
            kind: 'move',
            text: 'La dame noire attaque ta tour. Mets la tour à l’abri en clouant la dame contre son roi.',
            fen: '4k3/8/8/4q3/8/8/5KPP/R7 w - - 0 1',
            solution: ['a1e1'],
            hint: 'Le roi noir et sa dame sont sur la même colonne.',
            success: 'La dame est clouée : au mieux, elle se sacrifie contre ta tour et ta finale de pions est gagnante.',
          },
        ],
      },
      {
        id: 'enfilade',
        title: 'L’enfilade',
        summary: 'Le clouage à l’envers.',
        steps: [
          {
            kind: 'info',
            title: 'Le rayon X',
            text: 'Dans une enfilade, la pièce la plus précieuse est devant. Elle doit s’écarter et découvre celle qui se trouve derrière.',
            fen: '8/8/8/8/R2k3q/8/8/1K6 b - - 0 1',
            arrows: [['a4', 'h4']],
          },
          {
            kind: 'move',
            text: 'Le roi et la dame noirs sont alignés sur la quatrième rangée. Donne échec avec la tour, puis gagne la dame.',
            fen: '8/8/8/8/3k3q/8/8/RK6 w - - 0 1',
            solution: ['a1a4', 'd4e5', 'a4h4'],
            success: 'Enfilade réussie : le roi s’écarte, la dame tombe.',
          },
        ],
      },
      {
        id: 'decouverte',
        title: 'L’attaque à la découverte',
        summary: 'Démasquer une pièce à longue portée.',
        steps: [
          {
            kind: 'info',
            title: 'Deux menaces en un coup',
            text: 'Quand une pièce bouge, elle peut démasquer une tour, un fou ou une dame placés derrière elle. Si la pièce qui bouge crée elle aussi une menace, l’adversaire est débordé.',
            fen: '4k3/8/8/2q5/4N3/8/8/4RK2 w - - 0 1',
            arrows: [['e1', 'e8']],
          },
          {
            kind: 'move',
            text: 'Ta tour vise le roi noir derrière ton cavalier. Bouge le cavalier pour gagner la dame.',
            fen: '4k3/8/8/2q5/4N3/8/8/4RK2 w - - 0 1',
            solution: ['e4c5'],
            success: 'Échec à la découverte : la dame est perdue.',
          },
        ],
      },
      {
        id: 'etouffe',
        title: 'Le mat à l’étouffée',
        summary: 'Le roi asphyxié par ses propres pièces.',
        steps: [
          {
            kind: 'move',
            text: 'Le roi noir est entouré de ses propres pièces. Un seul saut suffit pour le mater.',
            fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
            solution: ['g5f7'],
            anyMate: true,
            success: 'Mat à l’étouffée : aucune case de fuite, aucune pièce pour capturer le cavalier.',
          },
        ],
      },
    ],
  },
  {
    id: 'mats',
    title: 'Mats essentiels',
    level: 'Débutant',
    description: 'Les schémas de mat qu’il faut reconnaître en un coup d’œil.',
    glyph: '♛',
    hue: 330,
    lessons: [
      {
        id: 'berger',
        title: 'Le coup du berger',
        summary: 'Le piège le plus célèbre, et comment l’éviter.',
        steps: [
          {
            kind: 'info',
            title: 'f7, le point faible',
            text: 'Au départ, f7 n’est défendu que par le roi. La dame et le fou blancs peuvent s’y concentrer dès le troisième coup.',
            moves: 'e4 e5 Bc4 Nc6 Qh5',
            arrows: [['c4', 'f7'], ['h5', 'f7']],
          },
          {
            kind: 'move',
            text: 'Les Noirs ont joué 3...Cf6 pour attaquer ta dame, mais oublient f7. Punis-les.',
            moves: 'e4 e5 Bc4 Nc6 Qh5 Nf6',
            solution: ['h5f7'],
            anyMate: true,
            success: 'Mat du berger. Pour l’éviter, les Noirs devaient jouer 3...g6 ou 3...De7.',
          },
        ],
      },
      {
        id: 'escalier',
        title: 'Le mat de l’escalier',
        summary: 'Deux tours qui poussent le roi au bord.',
        steps: [
          {
            kind: 'info',
            title: 'Une marche après l’autre',
            text: 'Une tour coupe le roi sur une rangée pendant que l’autre donne échec sur la suivante. Le roi recule jusqu’au bord.',
            fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1',
            arrows: [['a7', 'h7']],
          },
          {
            kind: 'move',
            text: 'La tour a7 garde la septième rangée. Termine le travail.',
            fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1',
            solution: ['b1b8'],
            anyMate: true,
            success: 'Mat de l’escalier.',
          },
        ],
      },
      {
        id: 'dame-roi',
        title: 'Dame et roi contre roi',
        summary: 'Le mat de base à connaître par cœur.',
        steps: [
          {
            kind: 'move',
            text: 'Ton roi en c6 protège la case b7. Donne mat.',
            fen: 'k7/8/2K5/8/8/8/8/1Q6 w - - 0 1',
            solution: ['b1b7'],
            anyMate: true,
            success: 'Mat du baiser : la dame colle au roi, protégée par le sien.',
          },
          {
            kind: 'move',
            text: 'Attention au pat ! Ici, un coup de dame imprudent ne laisse aucun coup aux Noirs. Trouve le mat.',
            fen: '7k/8/5K2/8/8/8/8/6Q1 w - - 0 1',
            solution: ['g1g7'],
            anyMate: true,
            hint: 'La dame doit donner échec, pas seulement bloquer.',
            success: 'Mat. Avec Dg6 ?? c’était pat.',
          },
        ],
      },
      {
        id: 'arabe',
        title: 'Le mat de l’arabe',
        summary: 'Tour et cavalier dans le coin.',
        steps: [
          {
            kind: 'move',
            text: 'Le cavalier f6 contrôle g8 et h7. Donne mat avec la tour.',
            fen: '7k/1R6/5N2/8/8/8/8/6K1 w - - 0 1',
            solution: ['b7h7'],
            anyMate: true,
            success: 'Le mat de l’arabe, connu depuis plus de mille ans.',
          },
        ],
      },
    ],
  },
  {
    id: 'ouvertures',
    title: 'Ouvertures',
    level: 'Intermédiaire',
    description: 'Les principes, puis quatre répertoires solides à jouer coup par coup.',
    glyph: '♗',
    hue: 45,
    lessons: [
      {
        id: 'principes',
        title: 'Les trois principes',
        summary: 'Centre, développement, roque.',
        steps: [
          {
            kind: 'info',
            title: '1. Le centre',
            text: 'Occupe ou contrôle les cases centrales e4, d4, e5 et d5. Les pièces y rayonnent dans toutes les directions.',
            fen: START,
            marks: ['d4', 'e4', 'd5', 'e5'],
          },
          {
            kind: 'info',
            title: '2. Le développement',
            text: 'Sors cavaliers et fous avant la dame et les tours. Évite de jouer deux fois la même pièce dans l’ouverture.',
            moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5',
            arrows: [['g1', 'f3'], ['f1', 'c4']],
          },
          {
            kind: 'info',
            title: '3. Le roque',
            text: 'Roque tôt pour mettre le roi à l’abri et relier les tours. Un roi resté au centre est une cible.',
            moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 O-O Nf6',
            marks: ['g1', 'f1'],
          },
        ],
      },
      {
        id: 'italienne',
        title: 'La partie italienne',
        summary: 'Avec les Blancs : un fou vers f7, un centre classique.',
        steps: [
          {
            kind: 'line',
            text: 'Joue les coups blancs de l’Italienne. Le coach répond pour les Noirs.',
            line: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4 exd4 cxd4 Bb4+ Nc3',
            userColor: 'white',
            success: 'Tu connais la ligne principale du Giuoco Piano, avec le centre e4-d4.',
          },
        ],
      },
      {
        id: 'gambit-dame',
        title: 'Le gambit dame',
        summary: 'Avec les Blancs : pression sur d5.',
        steps: [
          {
            kind: 'line',
            text: 'Joue les coups blancs du gambit dame refusé.',
            line: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3',
            userColor: 'white',
            success: 'Développement harmonieux et pression durable sur le centre noir.',
          },
        ],
      },
      {
        id: 'sicilienne',
        title: 'La sicilienne Najdorf',
        summary: 'Avec les Noirs : la défense de combat.',
        steps: [
          {
            kind: 'line',
            text: 'Tu as les Noirs. Joue la Najdorf face à 1.e4.',
            line: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
            userColor: 'black',
            success: '5...a6, le coup de Najdorf : il prépare ...e5 et ...b5.',
          },
        ],
      },
      {
        id: 'londres',
        title: 'Le système de Londres',
        summary: 'Avec les Blancs : un plan simple contre tout.',
        steps: [
          {
            kind: 'line',
            text: 'Installe le système de Londres.',
            line: 'd4 d5 Nf3 Nf6 Bf4 e6 e3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
            userColor: 'white',
            success: 'Structure c3-d4-e3, fou f4 sorti avant e3 : un système solide.',
          },
        ],
      },
    ],
  },
  {
    id: 'finales',
    title: 'Finales',
    level: 'Avancé',
    description: 'Opposition, règle du carré et pions passés.',
    glyph: '♔',
    hue: 260,
    lessons: [
      {
        id: 'carre',
        title: 'La règle du carré',
        summary: 'Le roi peut-il rattraper le pion ?',
        steps: [
          {
            kind: 'info',
            title: 'Trace le carré',
            text: 'Dessine un carré du pion jusqu’à sa case de promotion. Si le roi adverse peut entrer dans ce carré au trait, il rattrape le pion.',
            fen: '8/8/8/5k2/P7/8/8/K7 b - - 0 1',
            marks: ['a4', 'a8', 'e8', 'e4'],
          },
          {
            kind: 'move',
            text: 'Noirs au trait. Entre dans le carré pour arrêter le pion.',
            fen: '8/8/8/5k2/P7/8/8/K7 b - - 0 1',
            solution: ['f5e5'],
            alternatives: ['f5e4', 'f5e6'],
            orientation: 'black',
            hint: 'Le carré va de a4 à e8. Le roi doit atteindre la colonne e.',
            success: 'Le roi est dans le carré : il prendra le pion à temps.',
          },
        ],
      },
      {
        id: 'opposition',
        title: 'L’opposition',
        summary: 'Le duel des rois.',
        steps: [
          {
            kind: 'info',
            title: 'Face à face',
            text: 'Deux rois face à face séparés d’une case : celui qui n’a pas le trait « a l’opposition ». L’autre doit céder du terrain.',
            fen: '8/8/4k3/8/4K3/4P3/8/8 b - - 0 1',
            marks: ['e4', 'e6'],
          },
          {
            kind: 'move',
            text: 'Ton roi est devant son pion. Monte-le sur la sixième rangée pour prendre l’opposition.',
            fen: '4k3/8/8/4K3/4P3/8/8/8 w - - 0 1',
            solution: ['e5e6'],
            alternatives: ['e5d6', 'e5f6'],
            success: 'Roi sur la sixième rangée devant son pion : la finale est gagnée quel que soit le trait.',
          },
        ],
      },
    ],
  },
];

export function findLesson(courseId: string, lessonId: string) {
  const course = COURSES.find((c) => c.id === courseId);
  const index = course?.lessons.findIndex((l) => l.id === lessonId) ?? -1;
  if (!course || index < 0) return null;
  return { course, lesson: course.lessons[index], index, next: course.lessons[index + 1] ?? null };
}

export function lessonKey(courseId: string, lessonId: string) {
  return `${courseId}/${lessonId}`;
}
