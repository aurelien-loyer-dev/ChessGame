import { HomeButton } from '../components/HomeButton';
import { navigate } from '../lib/router';
import { HOST, LEGAL_UPDATED, PUBLISHER } from '../data/legal';
import { useConsent } from '../store/consent';
import './legal.css';

const DOCS = [
  { id: 'mentions', label: 'Mentions légales' },
  { id: 'confidentialite', label: 'Confidentialité' },
  { id: 'cookies', label: 'Cookies' },
];

function Contact() {
  return PUBLISHER.email ? (
    <a href={`mailto:${PUBLISHER.email}`}>{PUBLISHER.email}</a>
  ) : (
    <>par courrier à l’adresse ci-dessus</>
  );
}

export function Legal({ doc = 'mentions' }: { doc?: string }) {
  const current = DOCS.some((d) => d.id === doc) ? doc : 'mentions';
  return (
    <div className="container legal">
      <nav className="page-nav">
        <HomeButton />
      </nav>
      <header className="page-head">
        <div>
          <p className="eyebrow">Informations légales</p>
          <h1>{DOCS.find((d) => d.id === current)!.label}</h1>
          <p>Dernière mise à jour : {LEGAL_UPDATED}</p>
        </div>
        <div className="segmented" role="tablist">
          {DOCS.map((d) => (
            <button key={d.id} role="tab" aria-pressed={current === d.id} onClick={() => navigate(`legal/${d.id}`)}>
              {d.label}
            </button>
          ))}
        </div>
      </header>
      <article className="legal-doc panel">
        {current === 'mentions' && <Mentions />}
        {current === 'confidentialite' && <Privacy />}
        {current === 'cookies' && <Cookies />}
      </article>
    </div>
  );
}

function Mentions() {
  return (
    <>
      <section>
        <h2>Éditeur du site</h2>
        <dl className="legal-facts">
          <dt>Nom</dt>
          <dd>{PUBLISHER.name}</dd>
          <dt>Forme juridique</dt>
          <dd>{PUBLISHER.form}</dd>
          <dt>SIREN</dt>
          <dd className="mono">{PUBLISHER.siren}</dd>
          <dt>SIRET (siège)</dt>
          <dd className="mono">{PUBLISHER.siret}</dd>
          <dt>N° de TVA intracommunautaire</dt>
          <dd className="mono">{PUBLISHER.vat}</dd>
          <dt>Activité</dt>
          <dd>{PUBLISHER.activity}</dd>
          <dt>Date de création</dt>
          <dd>{PUBLISHER.created}</dd>
          <dt>Adresse</dt>
          <dd>{PUBLISHER.address}</dd>
          <dt>Contact</dt>
          <dd>
            <Contact />
          </dd>
          <dt>Directeur de la publication</dt>
          <dd>{PUBLISHER.director}</dd>
        </dl>
      </section>
      <section>
        <h2>Hébergement</h2>
        <p>
          Le site est hébergé par {HOST.name}, {HOST.address} (<a href={HOST.site}>{HOST.site.replace('https://', '')}</a>).
        </p>
      </section>
      <section>
        <h2>Propriété intellectuelle</h2>
        <p>
          La conception, le code et les contenus pédagogiques de Chess Arena sont la propriété de {PUBLISHER.name}, sauf mention contraire. Le code
          source est diffusé sous licence MIT.
        </p>
        <p>
          Composants tiers : le moteur Stockfish (licence GPLv3) via stockfish.js, les pièces « cburnett » de Colin M. L. Burnett, et les
          bibliothèques open source listées dans le dépôt du projet.
        </p>
      </section>
      <section>
        <h2>Responsabilité</h2>
        <p>
          Chess Arena est un service gratuit fourni en l’état. L’éditeur s’efforce d’en assurer la disponibilité mais ne peut garantir l’absence
          d’interruption, notamment pour le jeu en ligne qui dépend d’un service tiers de mise en relation.
        </p>
      </section>
    </>
  );
}

function Privacy() {
  return (
    <>
      <section>
        <h2>En bref</h2>
        <p>
          Pour jouer avec toutes les fonctionnalités, tu crées un compte (e-mail et mot de passe, ou GitHub / Google). Ton profil (pseudo, emblème,
          niveau, classements, historique des parties, progression des cours et puzzles, réglages) est alors sauvegardé sur ton compte et dans ton
          navigateur. En mode invité, rien n’est envoyé : les réglages restent dans ton navigateur et les parties ne sont pas enregistrées.
        </p>
      </section>
      <section>
        <h2>Responsable du traitement</h2>
        <p>
          {PUBLISHER.name}, {PUBLISHER.form.toLowerCase()}, {PUBLISHER.address}. Contact : <Contact />.
        </p>
      </section>
      <section>
        <h2>Données traitées</h2>
        <table className="legal-table">
          <thead>
            <tr>
              <th>Donnée</th>
              <th>Où</th>
              <th>Finalité</th>
              <th>Base légale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Profil et progression</td>
              <td>Ton navigateur uniquement</td>
              <td>Faire fonctionner le jeu</td>
              <td>Exécution du service</td>
            </tr>
            <tr>
              <td>Compte : e-mail, mot de passe (stocké chiffré par Supabase, jamais visible par l’éditeur) ou identifiant, nom et photo fournis par GitHub / Google, et sauvegarde du profil</td>
              <td>Supabase (base de données hébergée dans l’Union européenne)</td>
              <td>Te connecter et synchroniser ton profil entre tes appareils</td>
              <td>Exécution du service, à ta demande</td>
            </tr>
            <tr>
              <td>Adresse IP et pseudo lors d’une partie en ligne</td>
              <td>Ton adversaire et le service de mise en relation PeerJS</td>
              <td>Établir la connexion directe entre les deux joueurs</td>
              <td>Exécution du service, à ta demande</td>
            </tr>
            <tr>
              <td>Journaux techniques (IP, navigateur, pages)</td>
              <td>Hébergeur ({HOST.name})</td>
              <td>Sécurité et diffusion du site</td>
              <td>Intérêt légitime</td>
            </tr>
            <tr>
              <td>Mesure d’audience anonyme</td>
              <td>Vercel Web Analytics</td>
              <td>Connaître la fréquentation des pages</td>
              <td>Consentement</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>Jeu en ligne</h2>
        <p>
          Les coups transitent directement entre les deux navigateurs (WebRTC). Pour se trouver, les navigateurs passent par le service public
          PeerJS (peerjs.com), qui voit les adresses IP le temps de la mise en relation. Ton adversaire voit ton pseudo et peut, techniquement,
          voir ton adresse IP. Aucune partie en ligne n’est conservée par l’éditeur.
        </p>
      </section>
      <section>
        <h2>Compte en ligne</h2>
        <p>
          Avec un e-mail et un mot de passe, le mot de passe est haché par Supabase : ni l’éditeur ni l’application n’y ont accès. Avec GitHub
          ou Google, Chess Arena ne voit jamais ton mot de passe et ne reçoit que les informations de base de ton compte (identifiant, e-mail,
          nom, photo). Des e-mails de service (confirmation d’adresse, réinitialisation du mot de passe) peuvent t’être envoyés. Les comptes et les sauvegardes sont gérés par Supabase Inc., sous-traitant de l’éditeur.
          Chaque sauvegarde n’est lisible que par son propriétaire. Tu peux supprimer ton compte en ligne à tout moment depuis la page Profil.
        </p>
      </section>
      <section>
        <h2>Transferts hors de l’Union européenne</h2>
        <p>
          L’hébergeur {HOST.name} et Supabase Inc. sont établis aux États-Unis. Les transferts sont encadrés par le Data Privacy Framework UE-États-Unis et les clauses
          contractuelles types de la Commission européenne.
        </p>
      </section>
      <section>
        <h2>Durée de conservation</h2>
        <p>
          Les données locales restent dans ton navigateur jusqu’à ce que tu les effaces (bouton « Supprimer toutes mes données » de la page Profil, ou effacement des
          données du site). Le compte et la sauvegarde en ligne sont conservés tant que tu ne les supprimes pas (bouton « Supprimer mon compte en
          ligne »). Les journaux de l’hébergeur sont conservés selon sa propre politique.
        </p>
      </section>
      <section>
        <h2>Tes droits</h2>
        <p>
          Tu disposes des droits d’accès, de rectification, d’effacement, d’opposition et de portabilité. Comme tes données sont dans ton navigateur,
          tu les exerces directement depuis la section « Compte et données personnelles » de la page Profil :
        </p>
        <ul className="legal-list">
          <li><b>Accès et portabilité</b> : « Télécharger mes données » produit un fichier JSON complet et lisible.</li>
          <li><b>Rectification</b> : modifie ton pseudo depuis le profil.</li>
          <li><b>Déconnexion</b> : « Se déconnecter » retire ton profil de cet appareil, avec la possibilité de l’exporter avant.</li>
          <li><b>Effacement</b> : « Supprimer toutes mes données » efface définitivement profil, parties, réglages et choix cookies de cet appareil, et « Supprimer mon compte en ligne » efface le compte et la sauvegarde en ligne.</li>
        </ul>
        <p>
          Pour toute autre demande, contacte l’éditeur : <Contact />. Tu peux aussi adresser une réclamation à la CNIL (cnil.fr).
        </p>
      </section>
    </>
  );
}

function Cookies() {
  const { analytics, setAnalytics } = useConsent();
  return (
    <>
      <section>
        <h2>Ce que le site dépose</h2>
        <p>Chess Arena ne dépose aucun cookie publicitaire ni de réseau social. Il utilise le stockage local du navigateur pour :</p>
        <table className="legal-table">
          <thead>
            <tr>
              <th>Clé</th>
              <th>Rôle</th>
              <th>Consentement</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="mono">arena.profile</td>
              <td>Profil, classements, historique, progression</td>
              <td>Non requis (nécessaire au service)</td>
            </tr>
            <tr>
              <td className="mono">arena.settings</td>
              <td>Réglages du plateau et du son</td>
              <td>Non requis</td>
            </tr>
            <tr>
              <td className="mono">arena.session</td>
              <td>Dernière partie et choix de l’écran Jouer</td>
              <td>Non requis</td>
            </tr>
            <tr>
              <td className="mono">arena.cloud-auth, arena.cloud</td>
              <td>Session de connexion au compte en ligne et suivi de la synchronisation</td>
              <td>Non requis (uniquement si tu te connectes)</td>
            </tr>
            <tr>
              <td className="mono">arena.guest</td>
              <td>Mémorise le mode invité jusqu’à la fermeture de l’onglet</td>
              <td>Non requis</td>
            </tr>
            <tr>
              <td className="mono">arena.consent</td>
              <td>Mémorise ton choix ci-dessous</td>
              <td>Non requis</td>
            </tr>
            <tr>
              <td>Vercel Web Analytics</td>
              <td>Statistiques de fréquentation anonymes, sans cookie</td>
              <td>Oui</td>
            </tr>
          </tbody>
        </table>
      </section>
      <section>
        <h2>Ton choix</h2>
        <p>
          Mesure d’audience actuellement : <b>{analytics === true ? 'acceptée' : analytics === false ? 'refusée' : 'aucun choix enregistré'}</b>.
        </p>
        <div className="controls-row">
          <button className={`btn ${analytics === true ? 'primary' : ''}`} onClick={() => setAnalytics(true)}>
            Accepter la mesure d’audience
          </button>
          <button className={`btn ${analytics === false ? 'primary' : ''}`} onClick={() => setAnalytics(false)}>
            Refuser
          </button>
        </div>
      </section>
    </>
  );
}
