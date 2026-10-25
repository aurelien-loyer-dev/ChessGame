import { useState } from 'react';
import { motion } from 'motion/react';
import { NAME_MAX, sanitizeName } from '../lib/types';
import { Modal } from '../components/ui/Modal';
import { useProfile } from '../store/profile';

export function Onboarding() {
  const setName = useProfile((s) => s.setName);
  const [value, setValue] = useState('');
  const clean = sanitizeName(value);
  const submit = (name: string) => setName(name || `Joueur${Math.floor(1000 + Math.random() * 9000)}`);

  return (
    <Modal open dismissable={false} width={440}>
      <motion.div className="onboarding" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
        <p className="eyebrow">Bienvenue dans l’arène</p>
        <h2>Comment doit-on t’appeler ?</h2>
        <p className="dim">Ton pseudo s’affiche en partie et dans le classement en ligne. Tu pourras le changer depuis ton profil.</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit(clean);
          }}
        >
          <input
            id="onboarding-name"
            className="input"
            placeholder="Pseudo"
            maxLength={NAME_MAX}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <button className="btn primary lg block" type="submit" disabled={!clean}>
            Entrer
          </button>
          <button className="btn ghost block" type="button" onClick={() => submit('')}>
            Continuer sans pseudo
          </button>
        </form>
      </motion.div>
    </Modal>
  );
}
