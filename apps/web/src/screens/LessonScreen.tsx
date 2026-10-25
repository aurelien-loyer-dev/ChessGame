import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ArrowLeft, ArrowRight, CheckCircle2, Lightbulb, RotateCcw } from 'lucide-react';
import { Chess } from 'chess.js';
import type { Color } from '@chess/shared';
import { findLesson, lessonKey, type Course, type Lesson, type LessonStep } from '../data/lessons';
import { useProfile } from '../store/profile';
import { navigate } from '../lib/router';
import { Board, type Arrow, type Mark } from '../components/board/Board';
import { checkSquare, legalDests, sideToMove, START_FEN } from '../lib/chess';
import { useExercise, type ExerciseSpec } from '../game/useExercise';
import { play } from '../lib/sound';
import './learn.css';

function stepFen(step: LessonStep): string {
  if (step.kind === 'line') return START_FEN;
  if (step.moves) {
    const c = new Chess();
    for (const san of step.moves.split(' ')) c.move(san);
    return c.fen();
  }
  return step.fen ?? START_FEN;
}

function hasBothKings(fen: string) {
  const placement = fen.split(' ')[0];
  return placement.includes('k') && placement.includes('K');
}

export function LessonScreen({ courseId, lessonId }: { courseId: string; lessonId: string }) {
  const found = findLesson(courseId, lessonId);
  if (!found) {
    return (
      <div className="container">
        <p>Leçon introuvable.</p>
        <button className="btn" onClick={() => navigate('learn')}>
          Retour aux cours
        </button>
      </div>
    );
  }
  return <LessonRunner key={`${courseId}/${lessonId}`} course={found.course} lesson={found.lesson} next={found.next} />;
}

function LessonRunner({ course, lesson, next }: { course: Course; lesson: Lesson; next: Lesson | null }) {
  const completeLesson = useProfile((s) => s.completeLesson);
  const [stepIndex, setStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  const step = lesson.steps[stepIndex];

  const advance = () => {
    if (stepIndex + 1 < lesson.steps.length) setStepIndex(stepIndex + 1);
    else {
      completeLesson(lessonKey(course.id, lesson.id));
      setFinished(true);
      play('success');
    }
  };

  const header = (
    <>
      <button className="btn ghost sm back" onClick={() => navigate('learn')}>
        <ArrowLeft /> {course.title}
      </button>
      <h1 className="lesson-title">{lesson.title}</h1>
      <div className="step-dots" aria-label={`Étape ${stepIndex + 1} sur ${lesson.steps.length}`}>
        {lesson.steps.map((_, i) => (
          <i key={i} className={i < stepIndex || finished ? 'done' : i === stepIndex ? 'current' : ''} />
        ))}
      </div>
    </>
  );

  return (
    <div className="lesson-layout" style={{ ['--hue' as string]: course.hue }}>
      <StepView key={stepIndex} step={step} header={header} finished={finished} onNext={advance}>
        {finished && (
          <motion.div className="lesson-done" initial={{ opacity: 0, rotateY: -30 }} animate={{ opacity: 1, rotateY: 0 }}>
            <CheckCircle2 className="done-icon" />
            <h2>Leçon validée</h2>
            <p className="dim">{lesson.summary}</p>
            <div className="controls-row">
              <button className="btn primary grow" onClick={() => navigate(next ? `learn/${course.id}/${next.id}` : 'learn')}>
                {next ? next.title : 'Tous les cours'} <ArrowRight />
              </button>
              <button
                className="btn"
                onClick={() => {
                  setStepIndex(0);
                  setFinished(false);
                }}
              >
                <RotateCcw /> Revoir
              </button>
            </div>
          </motion.div>
        )}
      </StepView>
    </div>
  );
}

function StepView({
  step,
  header,
  finished,
  onNext,
  children,
}: {
  step: LessonStep;
  header: React.ReactNode;
  finished: boolean;
  onNext: () => void;
  children?: React.ReactNode;
}) {
  const initialFen = useMemo(() => stepFen(step), [step]);
  const spec = useMemo<ExerciseSpec | null>(() => {
    if (step.kind === 'move') {
      return { fen: initialFen, script: step.solution, anyMate: step.anyMate, alternatives: step.alternatives, successText: step.success };
    }
    if (step.kind === 'line') {
      const c = new Chess();
      const script = step.line.split(' ').map((san) => {
        const m = c.move(san);
        return m.from + m.to + (m.promotion ?? '');
      });
      return { fen: START_FEN, script, opponentFirst: step.userColor === 'black', successText: step.success };
    }
    return null;
  }, [step, initialFen]);
  const ex = useExercise(spec);

  const fen = spec ? ex.fen || initialFen : initialFen;
  const kings = hasBothKings(fen);
  const chess = useMemo(() => (kings ? new Chess(fen) : null), [fen, kings]);
  const interactive = !!spec && !ex.solved && !ex.busy && !!chess;
  const orientation: Color =
    step.kind === 'line' ? step.userColor : step.kind === 'move' ? step.orientation ?? sideToMove(initialFen) : step.orientation ?? 'white';

  const infoArrows: Arrow[] = step.kind === 'info' ? (step.arrows ?? []).map(([from, to]) => ({ from, to, tone: 'engine' })) : [];
  const infoMarks: Mark[] = step.kind === 'info' ? (step.marks ?? []).map((square) => ({ square, tone: 'focus' })) : [];

  const title = step.kind === 'info' ? step.title : step.kind === 'line' ? `Joue les ${step.userColor === 'white' ? 'Blancs' : 'Noirs'}` : 'Exercice';
  const solved = !spec || ex.solved;

  return (
    <>
      <div className="lesson-board">
        <Board
          fen={fen}
          orientation={orientation}
          movable={interactive ? sideToMove(fen) : null}
          dests={interactive && chess ? legalDests(chess) : undefined}
          lastMove={ex.lastMove}
          check={chess ? checkSquare(chess) : null}
          arrows={[...infoArrows, ...ex.arrows]}
          marks={[...infoMarks, ...ex.marks]}
          onMove={ex.onMove}
        />
      </div>
      <aside className="lesson-side panel">
        {header}
        <AnimatePresence mode="wait">
          {finished ? (
            <div key="finished">{children}</div>
          ) : (
            <motion.div
              key="step"
              className="step-panel"
              initial={{ opacity: 0, x: 24, rotateY: -12 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.28 }}
            >
              {title && <h2>{title}</h2>}
              <p className="step-text">{step.text}</p>
              {spec && !solved && ex.learner && (
                <span className="chip accent">{ex.learner === 'white' ? 'Les Blancs jouent' : 'Les Noirs jouent'}</span>
              )}
              {step.kind === 'line' && spec && (
                <div className="progress-track" aria-label="Progression de la ligne">
                  <i style={{ width: `${(Math.min(ex.cursor, spec.script.length) / spec.script.length) * 100}%` }} />
                </div>
              )}
              <AnimatePresence mode="wait">
                {ex.feedback && (
                  <motion.p key={ex.feedback.text} className={`feedback ${ex.feedback.tone}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                    {ex.feedback.text}
                  </motion.p>
                )}
              </AnimatePresence>
              {step.kind === 'move' && step.hint && ex.misses > 0 && !solved && <p className="faint small">{step.hint}</p>}
              <div className="controls-row step-actions">
                {!solved && (
                  <>
                    <button className="btn" onClick={ex.hint}>
                      <Lightbulb /> Indice
                    </button>
                    <button className="btn ghost" onClick={ex.restart}>
                      <RotateCcw /> Recommencer
                    </button>
                  </>
                )}
                {solved && (
                  <button className="btn primary grow" onClick={onNext}>
                    Continuer <ArrowRight />
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </aside>
    </>
  );
}
