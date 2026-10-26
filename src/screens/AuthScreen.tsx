import { lazy, Suspense, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn, Mail, UserPlus, UserRound } from 'lucide-react';
import { authErrorMessage, sendPasswordReset, signInWithEmail, signUpWithEmail } from '../lib/cloud';
import { useCloud } from '../store/cloud';
import { CloudButtons } from '../components/CloudButtons';
import './register.css';

const RegisterScene = lazy(() => import('../three/RegisterScene'));

type View = 'login' | 'register' | 'forgot' | 'check-email' | 'reset-sent';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function passwordIssue(pw: string): string | null {
  if (pw.length < 8) return 'Au moins 8 caractères.';
  if (!/[a-zA-Z]/.test(pw) || !/\d/.test(pw)) return 'Mélange lettres et chiffres.';
  return null;
}

/** Sign-in gate: e-mail/password or GitHub/Google, with a limited guest mode as the way out. */
export function AuthScreen() {
  const setGuest = useCloud((s) => s.setGuest);
  const [view, setView] = useState<View>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (v: View) => {
    setView(v);
    setError(null);
  };

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const emailOk = EMAIL_RE.test(email.trim());
  const pwIssue = view === 'register' && password ? passwordIssue(password) : null;
  const confirmIssue = view === 'register' && confirm && confirm !== password ? 'Les mots de passe ne correspondent pas.' : null;

  const submit = () => {
    const mail = email.trim().toLowerCase();
    if (view === 'login') return run(() => signInWithEmail(mail, password));
    if (view === 'register') {
      if (passwordIssue(password) || password !== confirm) return;
      return run(async () => {
        const mustConfirm = await signUpWithEmail(mail, password);
        if (mustConfirm) go('check-email');
      });
    }
    if (view === 'forgot') return run(async () => {
      await sendPasswordReset(mail);
      go('reset-sent');
    });
  };

  const canSubmit =
    emailOk &&
    !busy &&
    (view === 'forgot' || (view === 'login' && password.length > 0) || (view === 'register' && !passwordIssue(password) && password === confirm));

  return (
    <motion.div className="register auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="register-visual" aria-hidden>
        <Suspense fallback={null}>
          <RegisterScene glyph="♔" hue={200} />
        </Suspense>
        <div className="auth-brand">
          <p className="eyebrow">EpiChess</p>
          <h2>Ton échiquier, sur tous tes appareils.</h2>
        </div>
      </div>

      <section className="register-panel">
        <AnimatePresence mode="wait">
          {view === 'check-email' || view === 'reset-sent' ? (
            <motion.div key={view} className="register-step auth-done" initial={{ opacity: 0, rotateY: -25 }} animate={{ opacity: 1, rotateY: 0 }} exit={{ opacity: 0 }}>
              <Mail className="auth-mail" />
              <h1>{view === 'check-email' ? 'Vérifie ta boîte mail' : 'E-mail envoyé'}</h1>
              <p className="dim">
                {view === 'check-email'
                  ? `Un lien de confirmation a été envoyé à ${email.trim()}. Clique dessus pour activer ton compte : tu seras connecté automatiquement.`
                  : `Si un compte existe pour ${email.trim()}, tu vas recevoir un lien pour choisir un nouveau mot de passe.`}
              </p>
              <p className="faint small">Rien reçu ? Regarde dans les spams, ou réessaie dans quelques minutes.</p>
              <button className="btn" onClick={() => go('login')}>
                <ArrowLeft /> Retour à la connexion
              </button>
            </motion.div>
          ) : (
            <motion.div key="form" className="auth-body" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {view === 'forgot' ? (
                <button className="btn ghost sm home-btn" onClick={() => go('login')}>
                  <ArrowLeft /> Connexion
                </button>
              ) : (
                <div className="segmented auth-tabs" role="tablist">
                  <button role="tab" aria-pressed={view === 'login'} onClick={() => go('login')}>
                    Connexion
                  </button>
                  <button role="tab" aria-pressed={view === 'register'} onClick={() => go('register')}>
                    Inscription
                  </button>
                </div>
              )}

              <h1>{view === 'login' ? 'Bon retour' : view === 'register' ? 'Créer un compte' : 'Mot de passe oublié'}</h1>
              <p className="dim">
                {view === 'login'
                  ? 'Retrouve ton profil, ton Elo et tes parties.'
                  : view === 'register'
                    ? 'Ton profil, tes cours et tes puzzles seront sauvegardés sur ton compte.'
                    : 'Indique ton e-mail : on t’envoie un lien pour en choisir un nouveau.'}
              </p>

              {view !== 'forgot' && (
                <>
                  <CloudButtons />
                  <div className="or-sep">
                    <span>ou avec ton e-mail</span>
                  </div>
                </>
              )}

              <form
                className="auth-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canSubmit) void submit();
                }}
              >
                <label className="field">
                  <span>E-mail</span>
                  <input
                    id="auth-email"
                    className="input"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="toi@exemple.fr"
                    required
                  />
                </label>
                {view !== 'forgot' && (
                  <label className="field">
                    <span className="field-row">
                      Mot de passe
                      {view === 'login' && (
                        <button type="button" className="link-btn" onClick={() => go('forgot')}>
                          Mot de passe oublié ?
                        </button>
                      )}
                    </span>
                    <span className="pw-wrap">
                      <input
                        id="auth-password"
                        className="input"
                        type={showPw ? 'text' : 'password'}
                        autoComplete={view === 'login' ? 'current-password' : 'new-password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button type="button" className="pw-toggle" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>
                        {showPw ? <EyeOff /> : <Eye />}
                      </button>
                    </span>
                    {pwIssue && <small className="hint error">{pwIssue}</small>}
                  </label>
                )}
                {view === 'register' && (
                  <label className="field">
                    <span>Confirmer le mot de passe</span>
                    <input
                      id="auth-confirm"
                      className="input"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                    />
                    {confirmIssue && <small className="hint error">{confirmIssue}</small>}
                  </label>
                )}
                {error && <p className="field-error">{error}</p>}
                <button className="btn primary lg block" type="submit" disabled={!canSubmit}>
                  {busy ? <Loader2 className="spin" /> : view === 'login' ? <LogIn /> : view === 'register' ? <UserPlus /> : <Mail />}
                  {view === 'login' ? 'Se connecter' : view === 'register' ? 'Créer mon compte' : 'Envoyer le lien'}
                </button>
                {view === 'register' && (
                  <p className="faint small">
                    En créant un compte, tu acceptes la{' '}
                    <a href="#/legal/confidentialite" target="_blank" rel="noreferrer">
                      politique de confidentialité
                    </a>
                    .
                  </p>
                )}
              </form>

              <div className="guest-box">
                <button className="btn ghost block" onClick={() => setGuest(true)}>
                  <UserRound /> Jouer en invité
                </button>
                <p className="faint small">Contre l’IA, en local et analyse. Sans compte : pas de cours, puzzles, jeu en ligne ni sauvegarde.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </motion.div>
  );
}
