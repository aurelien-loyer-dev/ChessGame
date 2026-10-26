import { CloudDownload, MonitorSmartphone } from 'lucide-react';
import { Modal } from './ui/Modal';
import { useCloud } from '../store/cloud';

/** Shown when both this device and the cloud changed since the last sync. */
export function CloudConflict() {
  const { conflict, resolveConflict } = useCloud();
  if (!conflict) return null;
  return (
    <Modal open dismissable={false} title="Deux versions de ton profil" width={460}>
      <p className="dim">
        Ton profil a changé sur cet appareil et dans ta sauvegarde en ligne (enregistrée le{' '}
        {new Date(conflict.updatedAt).toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' })}). Laquelle veux-tu garder ?
      </p>
      <div className="logout-actions">
        <button className="btn primary block" onClick={() => resolveConflict('cloud')}>
          <CloudDownload /> Garder la sauvegarde en ligne
        </button>
        <button className="btn block" onClick={() => resolveConflict('local')}>
          <MonitorSmartphone /> Garder la version de cet appareil
        </button>
      </div>
    </Modal>
  );
}
