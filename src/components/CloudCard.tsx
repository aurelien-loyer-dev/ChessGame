import { useState } from 'react';
import { Cloud, CloudOff, RefreshCw, Trash2 } from 'lucide-react';
import { useCloud } from '../store/cloud';
import { CloudButtons } from './CloudButtons';
import { Modal } from './ui/Modal';
import { toast } from './Toasts';

const PROVIDER_LABEL: Record<string, string> = { github: 'GitHub', google: 'Google', apple: 'Apple' };

function ago(ts: number | null) {
  if (!ts) return 'jamais';
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return 'à l’instant';
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
}

/** Online account status on the profile page: connect, sync state, delete. */
export function CloudCard() {
  const cloud = useCloud();
  const [deleteOpen, setDeleteOpen] = useState(false);
  if (!cloud.enabled) return null;

  if (!cloud.user) {
    return (
      <div className="cloud-card">
        <div className="cloud-card-head">
          <CloudOff />
          <div>
            <b>Sauvegarde en ligne désactivée</b>
            <small>Connecte-toi pour retrouver ton profil sur tous tes appareils.</small>
          </div>
        </div>
        <CloudButtons compact />
      </div>
    );
  }

  const u = cloud.user;
  return (
    <div className="cloud-card on">
      <div className="cloud-card-head">
        {u.avatarUrl ? <img src={u.avatarUrl} alt="" className="cloud-avatar" /> : <Cloud />}
        <div>
          <b>
            Connecté avec {PROVIDER_LABEL[u.provider ?? ''] ?? 'ton compte'}
            {u.email ? ` · ${u.email}` : ''}
          </b>
          <small>
            {cloud.status === 'syncing'
              ? 'Synchronisation…'
              : cloud.status === 'error'
                ? `Erreur : ${cloud.error}`
                : `Sauvegardé ${ago(cloud.lastSyncedAt)}. Chaque changement est envoyé automatiquement.`}
          </small>
        </div>
      </div>
      <div className="controls-row">
        <button className="btn sm" onClick={() => cloud.syncNow()} disabled={cloud.status === 'syncing'}>
          <RefreshCw /> Synchroniser
        </button>
        <button className="btn ghost sm danger" onClick={() => setDeleteOpen(true)}>
          <Trash2 /> Supprimer mon compte en ligne
        </button>
      </div>
      <Modal open={deleteOpen} onClose={() => setDeleteOpen(false)} title="Supprimer ton compte en ligne ?" width={420}>
        <p className="dim">Ta sauvegarde en ligne et ton compte seront définitivement supprimés. Le profil reste sur cet appareil.</p>
        <div className="controls-row" style={{ marginTop: 18 }}>
          <button className="btn grow" onClick={() => setDeleteOpen(false)}>
            Annuler
          </button>
          <button
            className="btn danger grow"
            onClick={async () => {
              try {
                await cloud.deleteAccount();
                toast('Compte en ligne supprimé');
              } catch {
                toast('Suppression impossible, réessaie plus tard', 'bad');
              }
              setDeleteOpen(false);
            }}
          >
            <Trash2 /> Supprimer
          </button>
        </div>
      </Modal>
    </div>
  );
}
