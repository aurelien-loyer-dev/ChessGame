import { motion } from 'motion/react';
import { Activity, RotateCcw, Swords } from 'lucide-react';
import type { Color, EndReason, GameResult } from '@chess/shared';
import { Modal } from '../ui/Modal';
import { REASON_LABEL } from '../../game/line';

export function GameOverModal({
  open,
  onClose,
  result,
  reason,
  you,
  names,
  rating,
  onRematch,
  rematchLabel = 'Revanche',
  rematchPending,
  onAnalyse,
  onNew,
}: {
  open: boolean;
  onClose: () => void;
  result: GameResult;
  reason: EndReason;
  you: Color | null;
  names: { white: string; black: string };
  rating?: { before: number; after: number } | null;
  onRematch?: () => void;
  rematchLabel?: string;
  rematchPending?: boolean;
  onAnalyse: () => void;
  onNew: () => void;
}) {
  const winner: Color | null = result === '1-0' ? 'white' : result === '0-1' ? 'black' : null;
  let title = 'Nulle';
  let tone = 'draw';
  if (winner && you) {
    title = winner === you ? 'Victoire' : 'Défaite';
    tone = winner === you ? 'win' : 'loss';
  } else if (winner) {
    title = `${names[winner]} gagne`;
    tone = 'win';
  }
  const delta = rating ? rating.after - rating.before : 0;

  return (
    <Modal open={open} onClose={onClose} width={420}>
      <div className={`gameover ${tone}`}>
        <motion.div
          className="gameover-mark"
          initial={{ rotateY: 180, scale: 0.4, opacity: 0 }}
          animate={{ rotateY: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 140, damping: 14, delay: 0.1 }}
        >
          {result === '1-0' ? '1–0' : result === '0-1' ? '0–1' : '½–½'}
        </motion.div>
        <h2>{title}</h2>
        <p className="dim">{REASON_LABEL[reason]}</p>
        {rating && (
          <motion.p className="gameover-rating mono" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            {rating.after} <span className={delta >= 0 ? 'up' : 'down'}>{delta >= 0 ? `+${delta}` : delta}</span>
          </motion.p>
        )}
        <div className="gameover-actions">
          <button className="btn primary block" onClick={onAnalyse}>
            <Activity /> Analyser la partie
          </button>
          <div className="controls-row">
            {onRematch && (
              <button className="btn grow" onClick={onRematch} disabled={rematchPending}>
                <RotateCcw /> {rematchPending ? 'En attente…' : rematchLabel}
              </button>
            )}
            <button className="btn grow" onClick={onNew}>
              <Swords /> Nouvelle partie
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
