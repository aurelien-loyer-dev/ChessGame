import { Modal } from '../components/ui/Modal';
import { BOARD_THEMES, useSettings, type BoardTheme } from '../store/settings';
import { play } from '../lib/sound';
import './settings.css';

const TOGGLES: { key: 'sound' | 'coordinates' | 'legalMoves' | 'animations' | 'autoQueen' | 'view3d'; label: string; desc: string }[] = [
  { key: 'sound', label: 'Sons', desc: 'Effets synthétisés pour les coups, échecs et fins de partie' },
  { key: 'coordinates', label: 'Coordonnées', desc: 'Lettres et chiffres sur le bord du plateau' },
  { key: 'legalMoves', label: 'Coups légaux', desc: 'Points sur les cases accessibles' },
  { key: 'animations', label: 'Animations', desc: 'Glissement des pièces et transitions 3D' },
  { key: 'autoQueen', label: 'Promotion automatique', desc: 'Promeut toujours en dame' },
  { key: 'view3d', label: 'Plateau 3D', desc: 'Scène 3D orbitale pendant les parties' },
];

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const s = useSettings();
  return (
    <Modal open={open} onClose={onClose} title="Réglages" width={520}>
      <div className="settings">
        <section>
          <span className="eyebrow">Plateau</span>
          <div className="theme-grid">
            {(Object.keys(BOARD_THEMES) as BoardTheme[]).map((k) => (
              <button key={k} className={`theme-swatch ${s.boardTheme === k ? 'active' : ''}`} onClick={() => s.set({ boardTheme: k })} aria-pressed={s.boardTheme === k}>
                <span
                  className="swatch-board"
                  style={{ background: `repeating-conic-gradient(${BOARD_THEMES[k].dark} 0 25%, ${BOARD_THEMES[k].light} 0 50%) 0 0 / 50% 50%` }}
                />
                <span>{BOARD_THEMES[k].label}</span>
              </button>
            ))}
          </div>
        </section>
        <section className="settings-toggles">
          {TOGGLES.map((t) => (
            <label key={t.key} className="toggle-row">
              <span>
                <b>{t.label}</b>
                <small>{t.desc}</small>
              </span>
              <button className="toggle" role="switch" aria-checked={s[t.key]} onClick={() => s.set({ [t.key]: !s[t.key] })} />
            </label>
          ))}
          <label className="volume-row">
            <span>Volume</span>
            <input
              id="volume"
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={s.volume}
              disabled={!s.sound}
              onChange={(e) => s.set({ volume: Number(e.target.value) })}
              onPointerUp={() => play('move')}
            />
          </label>
        </section>
        <p className="faint small">
          Raccourcis : <span className="kbd">←</span> <span className="kbd">→</span> naviguer, <span className="kbd">F</span> retourner, clic droit pour dessiner des flèches.
        </p>
      </div>
    </Modal>
  );
}
