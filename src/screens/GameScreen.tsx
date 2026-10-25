import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Box, Flag, Handshake, Lightbulb, RefreshCw, Square, Undo2 } from 'lucide-react';
import type { Color } from '../lib/types';
import { useSession, type OfflineSession } from '../store/session';
import { useProfile } from '../store/profile';
import { useSettings } from '../store/settings';
import { getBot } from '../lib/engine/bots';
import { navigate } from '../lib/router';
import { useOfflineGame } from '../game/useOfflineGame';
import { useLiveEval } from '../game/useLiveEval';
import { useBoardKeys } from '../game/useBoardKeys';
import { capturedPieces } from '../lib/chess';
import { detectOpening } from '../data/openings';
import { BoardView } from '../components/game/BoardView';
import { NavButtons } from '../components/game/NavButtons';
import { GameOverModal } from '../components/game/GameOverModal';
import { EvalBar } from '../components/EvalBar';
import { MoveList } from '../components/MoveList';
import { CapturedRow, PlayerStrip } from '../components/PlayerStrip';
import { BotAvatar, ProfileAvatar, UserAvatar, hueFromName } from '../components/BotAvatar';
import { Modal } from '../components/ui/Modal';
import { toast } from '../components/Toasts';
import type { Arrow } from '../components/board/Board';
import './game.css';

export function GameScreen() {
  const session = useSession((s) => s.offline);
  useEffect(() => {
    if (!session) navigate('play');
  }, [session]);
  if (!session) return null;
  // Remount on rematch so every hook starts from a clean slate.
  return <OfflineGameView key={session.key} session={session} />;
}

function OfflineGameView({ session }: { session: OfflineSession }) {
  const rematch = useSession((s) => s.rematch);
  const rating = useProfile((s) => s.rating);
  const avatar = useProfile((s) => s.avatar);
  const { view3d, set: setSettings } = useSettings();
  const bot = session.mode === 'bot' ? getBot(session.botId) : undefined;
  const config = useMemo(
    () => ({ mode: session.mode, bot, color: session.color, tc: session.tc, startFen: session.startFen }),
    // the session object is immutable for the lifetime of this view
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const game = useOfflineGame(config);
  const [orientation, setOrientation] = useState<Color>(session.mode === 'bot' ? session.color : 'white');
  const [endOpen, setEndOpen] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);

  useEffect(() => {
    if (game.outcome) {
      const t = setTimeout(() => setEndOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, [game.outcome]);

  useEffect(() => {
    if (game.drawDeclined) toast(`${bot?.name ?? 'L’adversaire'} refuse la nulle`);
  }, [game.drawDeclined, bot?.name]);

  const flip = useCallback(() => setOrientation((o) => (o === 'white' ? 'black' : 'white')), []);
  useBoardKeys({ ply: game.ply, max: game.livePly, setPly: game.setViewPly, flip });

  const evalOn = session.assists.evalBar || !!game.outcome;
  const live = useLiveEval(game.pos.fen, evalOn, { depth: 16 });

  const opening = useMemo(() => detectOpening(game.moves.map((m) => m.fen)), [game.moves]);
  const captured = capturedPieces(game.pos.fen);

  const top: Color = orientation === 'white' ? 'black' : 'white';
  const bottom: Color = orientation;

  const strip = (color: Color) => {
    const isBot = bot && color !== session.color;
    const name = game.names[color];
    const caps = color === 'white' ? captured.byWhite : captured.byBlack;
    const adv = color === 'white' ? captured.diff : -captured.diff;
    return (
      <PlayerStrip
        avatar={isBot ? <BotAvatar bot={bot} /> : session.mode === 'bot' ? <ProfileAvatar glyph={avatar.glyph} hue={avatar.hue} /> : <UserAvatar name={color === 'white' ? 'B' : 'N'} hue={hueFromName(name)} />}
        name={name}
        rating={isBot ? bot.elo : session.mode === 'bot' ? rating : undefined}
        captured={<CapturedRow pieces={caps} color={color === 'white' ? 'b' : 'w'} advantage={adv} />}
        clock={game.timed ? { ms: game.clocks[color] } : null}
        active={!game.outcome && game.turn === color}
        thinking={isBot && game.thinking}
      />
    );
  };

  const arrows: Arrow[] = [];
  if (game.hint && game.ply === game.livePly) arrows.push({ from: game.hint[0], to: game.hint[1], tone: 'hint' });

  const canTakeback = session.mode === 'local' || session.assists.takebacks;

  return (
    <div className="game-layout">
      <div className="board-column">
        {strip(top)}
        <div className="board-row">
          {evalOn && <EvalBar line={live.best} orientation={orientation} />}
          <BoardView
            fen={game.pos.fen}
            orientation={orientation}
            movable={game.canMove ? game.userColor : null}
            dests={game.canMove ? game.pos.dests : undefined}
            lastMove={game.pos.lastMove}
            check={game.pos.check}
            arrows={arrows}
            onMove={game.move}
          />
        </div>
        {strip(bottom)}
      </div>

      <aside className="side-panel">
        <div className="panel game-head">
          <button className="btn ghost sm" onClick={() => navigate('play')}>
            <ArrowLeft /> Menu
          </button>
          <span className="chip mono">{session.tc.initial ? `${session.tc.initial / 60}+${session.tc.increment}` : '∞'}</span>
          <span className="chip">{session.mode === 'bot' ? 'vs IA' : 'Local'}</span>
        </div>

        <div className="panel moves-panel">
          <div className="opening-tag">
            {opening ? (
              <>
                <span className="mono faint">{opening.eco}</span> <b>{opening.name}</b>
              </>
            ) : (
              <span className="faint">{game.moves.length ? 'Hors théorie' : 'Position initiale'}</span>
            )}
          </div>
          <MoveList moves={game.moves} ply={game.ply} onSelect={(p) => game.setViewPly(p)} startPly={startPlyOf(game.startFen)} />
          <NavButtons ply={game.ply} max={game.livePly} setPly={(p) => game.setViewPly(p)} />
        </div>

        <div className="panel game-actions">
          {!game.outcome ? (
            <div className="controls-row">
              {session.mode === 'bot' && session.assists.hints && (
                <button className="btn grow" onClick={game.askHint} disabled={!game.canMove}>
                  <Lightbulb /> Indice
                </button>
              )}
              {canTakeback && (
                <button className="btn grow" onClick={game.takeback} disabled={game.livePly === 0 || game.thinking}>
                  <Undo2 /> Reprendre
                </button>
              )}
              <button className="btn grow" onClick={game.offerDraw} disabled={game.livePly < 2}>
                <Handshake /> Nulle
              </button>
              <button className="btn danger grow" onClick={() => setConfirmResign(true)}>
                <Flag /> Abandon
              </button>
            </div>
          ) : (
            <div className="controls-row">
              <button className="btn primary grow" onClick={() => navigate(`analysis/${game.outcome!.gameId}`)}>
                Analyser
              </button>
              <button className="btn grow" onClick={rematch}>
                <RefreshCw /> Revanche
              </button>
            </div>
          )}
          <div className="controls-row view-row">
            <button className="btn ghost sm" onClick={flip} title="Retourner (F)">
              <RefreshCw /> Retourner
            </button>
            <button className="btn ghost sm" onClick={() => setSettings({ view3d: !view3d })} aria-pressed={view3d}>
              {view3d ? <Square /> : <Box />} {view3d ? 'Vue 2D' : 'Vue 3D'}
            </button>
          </div>
        </div>
      </aside>

      <Modal open={confirmResign} onClose={() => setConfirmResign(false)} title="Abandonner la partie ?" width={380}>
        <p className="dim">La partie sera comptée comme une défaite.</p>
        <div className="controls-row" style={{ marginTop: 18 }}>
          <button className="btn grow" onClick={() => setConfirmResign(false)}>
            Continuer à jouer
          </button>
          <button
            className="btn danger grow"
            onClick={() => {
              setConfirmResign(false);
              game.resign();
            }}
          >
            <Flag /> Abandonner
          </button>
        </div>
      </Modal>

      {game.outcome && (
        <GameOverModal
          open={endOpen}
          onClose={() => setEndOpen(false)}
          result={game.outcome.result}
          reason={game.outcome.reason}
          you={session.mode === 'bot' ? session.color : null}
          names={game.names}
          rating={game.outcome.ratingChange}
          onRematch={rematch}
          onAnalyse={() => navigate(`analysis/${game.outcome!.gameId}`)}
          onNew={() => navigate(session.mode === 'bot' ? 'play/bot' : 'play/local')}
        />
      )}
    </div>
  );
}

function startPlyOf(fen: string) {
  const parts = fen.split(' ');
  return (Number(parts[5] ?? 1) - 1) * 2 + (parts[1] === 'b' ? 1 : 0);
}
