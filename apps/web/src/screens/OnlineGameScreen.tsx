import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, Box, Flag, Handshake, RefreshCw, Square, WifiOff } from 'lucide-react';
import { EMOTES, type Color } from '@chess/shared';
import { liveClocks, useOnline } from '../online/store';
import { navigate } from '../lib/router';
import { useSettings } from '../store/settings';
import { positionAt } from '../game/line';
import { useBoardKeys } from '../game/useBoardKeys';
import { capturedPieces, START_FEN } from '../lib/chess';
import { detectOpening } from '../data/openings';
import { BoardView } from '../components/game/BoardView';
import { NavButtons } from '../components/game/NavButtons';
import { GameOverModal } from '../components/game/GameOverModal';
import { MoveList } from '../components/MoveList';
import { CapturedRow, PlayerStrip } from '../components/PlayerStrip';
import { UserAvatar, hueFromName } from '../components/BotAvatar';
import { Modal } from '../components/ui/Modal';
import './game.css';

export function OnlineGameScreen() {
  const online = useOnline();
  const game = online.game;
  const { view3d, set: setSettings } = useSettings();
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [orientation, setOrientation] = useState<Color>(game?.you ?? 'white');
  const [endOpen, setEndOpen] = useState(false);
  const [confirmResign, setConfirmResign] = useState(false);
  const [, tick] = useState(0);

  useEffect(() => {
    if (!game) navigate('play/online');
  }, [game]);

  useEffect(() => {
    if (game) setOrientation(game.you);
    setViewPly(null);
    setEndOpen(false);
  }, [game?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (game?.result) {
      const t = setTimeout(() => setEndOpen(true), 500);
      return () => clearTimeout(t);
    }
  }, [game?.result]);

  useEffect(() => {
    if (!game?.running) return;
    const id = setInterval(() => tick((n) => n + 1), 100);
    return () => clearInterval(id);
  }, [game?.running]);

  const moves = game?.moves ?? [];
  const livePly = moves.length;
  const ply = viewPly ?? livePly;
  const pos = useMemo(() => positionAt(START_FEN, moves, Math.min(ply, livePly)), [moves, ply, livePly]);
  const opening = useMemo(() => detectOpening(moves.map((m) => m.fen)), [moves]);
  const setPly = useCallback((p: number | null) => setViewPly(p === null || p >= livePly ? null : Math.max(0, p)), [livePly]);
  const flip = useCallback(() => setOrientation((o) => (o === 'white' ? 'black' : 'white')), []);
  useBoardKeys({ ply, max: livePly, setPly, flip });

  if (!game) return null;

  const turn: Color = livePly % 2 === 0 ? 'white' : 'black';
  const clocks = liveClocks(game);
  const captured = capturedPieces(pos.fen);
  const canMove = !game.result && ply === livePly && turn === game.you;
  const timed = game.tc.initial > 0;
  const opp: Color = game.you === 'white' ? 'black' : 'white';

  const strip = (color: Color) => {
    const p = game[color];
    const caps = color === 'white' ? captured.byWhite : captured.byBlack;
    const adv = color === 'white' ? captured.diff : -captured.diff;
    const isOpp = color === opp;
    return (
      <div className="strip-wrap">
        <PlayerStrip
          avatar={<UserAvatar name={p.name} hue={hueFromName(p.name)} />}
          name={p.name}
          rating={p.rating}
          badge={isOpp && !game.opponentConnected && !game.result ? <WifiOff className="conn-icon" aria-label="Déconnecté" /> : undefined}
          captured={<CapturedRow pieces={caps} color={color === 'white' ? 'b' : 'w'} advantage={adv} />}
          clock={timed ? { ms: clocks[color] } : null}
          active={!game.result && turn === color}
        />
        <AnimatePresence>
          {online.emote && online.emote.by === color && Date.now() - online.emote.at < 2500 && (
            <motion.span
              key={online.emote.at}
              className="emote-float"
              initial={{ opacity: 0, y: 10, scale: 0.6 }}
              animate={{ opacity: 1, y: -18, scale: 1 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ duration: 0.5 }}
              style={{ right: timed ? 120 : 20, top: 0 }}
            >
              {online.emote.emote}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const top: Color = orientation === 'white' ? 'black' : 'white';
  const names = { white: game.white.name, black: game.black.name };
  const myRating = game.ratings?.[game.you];

  return (
    <div className="game-layout">
      <div className="board-column">
        {strip(top)}
        <div className="board-row">
          <BoardView
            fen={pos.fen}
            orientation={orientation}
            movable={canMove ? game.you : null}
            dests={canMove ? pos.dests : undefined}
            lastMove={pos.lastMove}
            check={pos.check}
            onMove={(from, to, promotion) => online.move(from + to + (promotion ?? ''))}
          />
        </div>
        {strip(orientation)}
      </div>

      <aside className="side-panel">
        <div className="panel game-head">
          <button
            className="btn ghost sm"
            onClick={() => {
              if (game.result) online.leaveGame();
              navigate('play/online');
            }}
          >
            <ArrowLeft /> Lobby
          </button>
          <span className="chip mono">{timed ? `${game.tc.initial / 60}+${game.tc.increment}` : '∞'}</span>
          <span className="chip accent">En ligne</span>
        </div>

        {game.drawOfferBy && game.drawOfferBy !== game.you && !game.result && (
          <div className="draw-offer">
            <span>{game[opp].name} propose la nulle</span>
            <button className="btn sm" onClick={() => online.answerDraw(true)}>
              Accepter
            </button>
            <button className="btn ghost sm" onClick={() => online.answerDraw(false)}>
              Refuser
            </button>
          </div>
        )}
        {!game.opponentConnected && !game.result && (
          <p className="conn-warn">L’adversaire s’est déconnecté. Victoire automatique s’il ne revient pas dans la minute.</p>
        )}

        <div className="panel moves-panel">
          <div className="opening-tag">
            {opening ? (
              <>
                <span className="mono faint">{opening.eco}</span> <b>{opening.name}</b>
              </>
            ) : (
              <span className="faint">{moves.length ? 'Hors théorie' : 'Position initiale'}</span>
            )}
          </div>
          <MoveList moves={moves} ply={ply} onSelect={setPly} />
          <NavButtons ply={ply} max={livePly} setPly={setPly} />
        </div>

        <div className="panel game-actions">
          <div className="emote-bar" aria-label="Réactions">
            {EMOTES.map((e) => (
              <button key={e} className="btn sm" onClick={() => online.sendEmote(e)}>
                {e}
              </button>
            ))}
          </div>
          {!game.result ? (
            <div className="controls-row">
              <button className="btn grow" onClick={online.offerDraw} disabled={game.drawOfferBy === game.you || livePly < 2}>
                <Handshake /> {game.drawOfferBy === game.you ? 'Proposée' : 'Nulle'}
              </button>
              <button className="btn danger grow" onClick={() => setConfirmResign(true)}>
                <Flag /> Abandon
              </button>
            </div>
          ) : (
            <div className="controls-row">
              <button className="btn grow" onClick={online.rematch} disabled={game.rematchBy === game.you}>
                <RefreshCw /> {game.rematchBy && game.rematchBy !== game.you ? 'Accepter la revanche' : game.rematchBy ? 'Revanche proposée' : 'Revanche'}
              </button>
            </div>
          )}
          <div className="controls-row view-row">
            <button className="btn ghost sm" onClick={flip}>
              <RefreshCw /> Retourner
            </button>
            <button className="btn ghost sm" onClick={() => setSettings({ view3d: !view3d })}>
              {view3d ? <Square /> : <Box />} {view3d ? 'Vue 2D' : 'Vue 3D'}
            </button>
          </div>
        </div>
      </aside>

      <Modal open={confirmResign} onClose={() => setConfirmResign(false)} title="Abandonner la partie ?" width={380}>
        <p className="dim">Ton classement en ligne sera mis à jour.</p>
        <div className="controls-row" style={{ marginTop: 18 }}>
          <button className="btn grow" onClick={() => setConfirmResign(false)}>
            Continuer
          </button>
          <button
            className="btn danger grow"
            onClick={() => {
              setConfirmResign(false);
              online.resign();
            }}
          >
            <Flag /> Abandonner
          </button>
        </div>
      </Modal>

      {game.result && game.reason && (
        <GameOverModal
          open={endOpen}
          onClose={() => setEndOpen(false)}
          result={game.result}
          reason={game.reason}
          you={game.you}
          names={names}
          rating={myRating}
          onRematch={online.rematch}
          rematchLabel={game.rematchBy && game.rematchBy !== game.you ? 'Accepter la revanche' : 'Revanche'}
          rematchPending={game.rematchBy === game.you}
          onAnalyse={() => navigate(`analysis/${game.id}`)}
          onNew={() => {
            online.leaveGame();
            navigate('play/online');
          }}
        />
      )}
    </div>
  );
}
