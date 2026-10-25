import { lazy, Suspense, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, GraduationCap, Sparkles, Swords } from 'lucide-react';
import { NAME_MAX, sanitizeName } from '../lib/types';
import { LEVELS, useProfile, type PlayerLevel } from '../store/profile';
import { getBot } from '../lib/engine/bots';
import { BotAvatar } from '../components/BotAvatar';
import { AVATAR_GLYPHS, AVATAR_HUES } from '../three/avatarPiece';
import { navigate } from '../lib/router';
import { play } from '../lib/sound';
import './register.css';

const RegisterScene = lazy(() => import('../three/RegisterScene'));
const WelcomeScene = lazy(() => import('../three/WelcomeScene'));

const STEPS = ['Pseudo', 'Avatar', 'Niveau', 'Validation'] as const;

/** Full-screen sign-up: four steps beside a live 3D preview of the avatar, then a 3D welcome sequence. */
export function Register() {
  const profile = useProfile();
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);
  const [name, setName] = useState(profile.name);
  const [glyph, setGlyph] = useState(profile.avatar.glyph);
  const [hue, setHue] = useState(profile.avatar.hue);
  const [level, setLevel] = useState<PlayerLevel | null>(profile.level);
  const [accepted, setAccepted] = useState(false);
  const [welcome, setWelcome] = useState(false);

  const clean = sanitizeName(name);
  const nameError = name && clean.length < 3 ? 'Au moins 3 caractères (lettres, chiffres, espace, - ou _).' : null;
  const canNext = [clean.length >= 3, true, !!level, accepted][step];

  const go = (delta: number) => {
    setDir(delta);
    setStep((s) => Math.max(0, Math.min(STEPS.length - 1, s + delta)));
  };

  const submit = () => {
    if (!level || clean.length < 3 || !accepted) return;
    setWelcome(true);
    play('success');
  };

  if (welcome && level) {
    return <Welcome name={clean} glyph={glyph} hue={hue} level={level} onDone={() => profile.register({ name: clean, avatar: { glyph, hue }, level })} />;
  }

  return (
    <motion.div className="register" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="register-visual" aria-hidden>
        <Suspense fallback={null}>
          <RegisterScene glyph={glyph} hue={hue} />
        </Suspense>
        <div className="register-tag">
          <span className="bot-avatar" style={{ width: 40, height: 40, fontSize: 20, ['--hue' as string]: hue }}>
            {glyph}
          </span>
          <div>
            <b>{clean || 'Ton pseudo'}</b>
            <small className="mono">{level ? `${LEVELS[level].rating} Elo de départ` : 'Niveau à choisir'}</small>
          </div>
        </div>
      </div>

      <section className="register-panel">
        <header>
          <p className="eyebrow">Créer ton profil</p>
          <ol className="register-steps">
            {STEPS.map((s, i) => (
              <li key={s} className={i < step ? 'done' : i === step ? 'current' : ''}>
                <span className="mono">{i < step ? <Check /> : i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
        </header>

        <form
          className="register-body"
          onSubmit={(e) => {
            e.preventDefault();
            if (!canNext) return;
            if (step < STEPS.length - 1) go(1);
            else submit();
          }}
        >
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              className="register-step"
              initial={{ opacity: 0, rotateY: dir * -35, x: dir * 40 }}
              animate={{ opacity: 1, rotateY: 0, x: 0 }}
              exit={{ opacity: 0, rotateY: dir * 35, x: dir * -40 }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
            >
              {step === 0 && (
                <>
                  <h1>Comment doit-on t’appeler ?</h1>
                  <p className="dim">Ton pseudo s’affiche en partie, dans tes parties en ligne et sur ton profil.</p>
                  <label className="field">
                    <span>Pseudo</span>
                    <input
                      id="register-name"
                      className="input lg-input"
                      value={name}
                      maxLength={NAME_MAX}
                      autoFocus
                      autoComplete="nickname"
                      placeholder="Magnus"
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <p className={`hint ${nameError ? 'error' : ''}`}>{nameError ?? `${clean.length}/${NAME_MAX} caractères`}</p>
                </>
              )}

              {step === 1 && (
                <>
                  <h1>Choisis ton emblème</h1>
                  <p className="dim">Il te représente sur le plateau et dans ton profil.</p>
                  <div className="glyph-grid" role="radiogroup" aria-label="Pièce">
                    {AVATAR_GLYPHS.map((g) => (
                      <button key={g} type="button" role="radio" aria-checked={glyph === g} className={glyph === g ? 'active' : ''} onClick={() => setGlyph(g)}>
                        {g}
                      </button>
                    ))}
                  </div>
                  <div className="hue-row" role="radiogroup" aria-label="Couleur">
                    {AVATAR_HUES.map((h) => (
                      <button
                        key={h}
                        type="button"
                        role="radio"
                        aria-checked={hue === h}
                        aria-label={`Teinte ${h}`}
                        className={hue === h ? 'active' : ''}
                        style={{ ['--hue' as string]: h }}
                        onClick={() => setHue(h)}
                      />
                    ))}
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <h1>Quel est ton niveau ?</h1>
                  <p className="dim">On fixe ton Elo de départ et on te propose un adversaire et un cours adaptés.</p>
                  <div className="level-grid" role="radiogroup">
                    {(Object.keys(LEVELS) as PlayerLevel[]).map((l) => {
                      const bot = getBot(LEVELS[l].botId);
                      return (
                        <button key={l} type="button" role="radio" aria-checked={level === l} className={`level-card ${level === l ? 'active' : ''}`} onClick={() => setLevel(l)}>
                          <span className="level-head">
                            <b>{LEVELS[l].label}</b>
                            <span className="mono brass">{LEVELS[l].rating}</span>
                          </span>
                          <small>{LEVELS[l].desc}</small>
                          <span className="level-bot">
                            <BotAvatar bot={bot} size={22} /> {bot.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {step === 3 && level && (
                <>
                  <h1>Tout est prêt</h1>
                  <dl className="recap">
                    <div>
                      <dt>Pseudo</dt>
                      <dd>{clean}</dd>
                    </div>
                    <div>
                      <dt>Emblème</dt>
                      <dd>
                        <span className="bot-avatar" style={{ width: 28, height: 28, fontSize: 15, ['--hue' as string]: hue }}>
                          {glyph}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Elo de départ</dt>
                      <dd className="mono brass">{LEVELS[level].rating}</dd>
                    </div>
                    <div>
                      <dt>Premier adversaire</dt>
                      <dd>{getBot(LEVELS[level].botId).name}</dd>
                    </div>
                  </dl>
                  <p className="faint small">
                    Ton profil est enregistré dans ce navigateur, sans mot de passe ni e-mail. Tu peux l’exporter depuis ta page Profil pour le
                    retrouver sur un autre appareil.
                  </p>
                  <label className="consent">
                    <input id="register-consent" type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
                    <span>
                      J’ai lu la{' '}
                      <a href="#/legal/confidentialite" target="_blank" rel="noreferrer">
                        politique de confidentialité
                      </a>{' '}
                      et les{' '}
                      <a href="#/legal/mentions" target="_blank" rel="noreferrer">
                        mentions légales
                      </a>
                      .
                    </span>
                  </label>
                </>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="register-actions">
            {step > 0 ? (
              <button type="button" className="btn ghost" onClick={() => go(-1)}>
                <ArrowLeft /> Retour
              </button>
            ) : (
              <span />
            )}
            <button type="submit" className="btn primary lg" disabled={!canNext}>
              {step < STEPS.length - 1 ? (
                <>
                  Continuer <ArrowRight />
                </>
              ) : (
                <>
                  <Sparkles /> Créer mon profil
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </motion.div>
  );
}

function Welcome({ name, glyph, hue, level, onDone }: { name: string; glyph: string; hue: number; level: PlayerLevel; onDone: () => void }) {
  const info = LEVELS[level];
  const bot = getBot(info.botId);
  const letters = useMemo(() => Array.from(`Bienvenue, ${name}`), [name]);

  const finish = (path: string) => {
    onDone();
    navigate(path);
  };

  return (
    <motion.div className="welcome" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="welcome-scene" aria-hidden>
        <Suspense fallback={null}>
          <WelcomeScene glyph={glyph} hue={hue} />
        </Suspense>
      </div>
      <div className="welcome-copy">
        <motion.p className="eyebrow" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.4 }}>
          Profil créé
        </motion.p>
        <h1 aria-label={`Bienvenue, ${name}`}>
          {letters.map((ch, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={{ opacity: 0, y: 30, rotateX: -90 }}
              animate={{ opacity: 1, y: 0, rotateX: 0 }}
              transition={{ delay: 2.5 + i * 0.035, type: 'spring', stiffness: 260, damping: 18 }}
            >
              {ch === ' ' ? ' ' : ch}
            </motion.span>
          ))}
        </h1>
        <motion.div className="welcome-chips" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 3.2 }}>
          <span className="chip brass mono">{info.rating} Elo</span>
          <span className="chip accent">{info.label}</span>
        </motion.div>
        <motion.div className="welcome-actions" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 3.5 }}>
          <button className="btn primary lg" onClick={() => finish('play/bot')}>
            <Swords /> Défier {bot.name}
          </button>
          <button className="btn lg" onClick={() => finish(`learn/${info.course}`)}>
            <GraduationCap /> Premier cours
          </button>
          <button className="btn ghost lg" onClick={() => finish('')}>
            Explorer
          </button>
        </motion.div>
      </div>
    </motion.div>
  );
}
