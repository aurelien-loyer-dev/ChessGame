import { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useCloud } from '../store/cloud';
import { authErrorMessage, updatePassword } from '../lib/cloud';
import { toast } from './Toasts';

/** Opens after a password-reset link: lets the player choose a new password. */
export function NewPasswordModal() {
  const { recovering, finishRecovery } = useCloud();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const weak = pw.length > 0 && (pw.length < 8 || !/[a-zA-Z]/.test(pw) || !/\d/.test(pw));

  return (
    <Modal open={recovering} dismissable={false} title="Nouveau mot de passe" width={420}>
      <form
        className="auth-form"
        onSubmit={async (e) => {
          e.preventDefault();
          if (weak || !pw) return;
          setBusy(true);
          setError(null);
          try {
            await updatePassword(pw);
            toast('Mot de passe mis à jour', 'good');
            finishRecovery();
          } catch (err) {
            setError(authErrorMessage(err));
          } finally {
            setBusy(false);
          }
        }}
      >
        <label className="field">
          <span>Choisis un nouveau mot de passe</span>
          <input id="new-password" className="input" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} autoFocus />
          {weak && <small className="hint error">Au moins 8 caractères, avec lettres et chiffres.</small>}
        </label>
        {error && <p className="field-error">{error}</p>}
        <button className="btn primary block" type="submit" disabled={!pw || weak || busy}>
          {busy ? <Loader2 className="spin" /> : <KeyRound />} Enregistrer
        </button>
      </form>
    </Modal>
  );
}
