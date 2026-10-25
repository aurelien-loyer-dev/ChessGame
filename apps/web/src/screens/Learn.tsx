import { motion } from 'motion/react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { COURSES, lessonKey } from '../data/lessons';
import { useProfile } from '../store/profile';
import { navigate } from '../lib/router';
import './learn.css';

export function Learn() {
  const done = useProfile((s) => s.lessonsDone);
  const total = COURSES.reduce((n, c) => n + c.lessons.length, 0);

  return (
    <div className="container">
      <header className="page-head">
        <div>
          <p className="eyebrow">Apprendre</p>
          <h1>Cours interactifs</h1>
          <p>Chaque leçon alterne explications et exercices sur l’échiquier. Les positions sont vérifiées par Stockfish.</p>
        </div>
        <div className="learn-meter">
          <span className="mono">
            {done.length}/{total}
          </span>
          <small>leçons validées</small>
        </div>
      </header>

      <div className="course-list">
        {COURSES.map((course, ci) => {
          const finished = course.lessons.filter((l) => done.includes(lessonKey(course.id, l.id))).length;
          return (
            <motion.section
              key={course.id}
              className="course panel"
              style={{ ['--hue' as string]: course.hue }}
              initial={{ opacity: 0, rotateX: -14, y: 20 }}
              animate={{ opacity: 1, rotateX: 0, y: 0 }}
              transition={{ delay: ci * 0.06, type: 'spring', stiffness: 180, damping: 22 }}
            >
              <header className="course-head">
                <span className="course-glyph" aria-hidden>
                  {course.glyph}
                </span>
                <div>
                  <h2>{course.title}</h2>
                  <p className="dim">{course.description}</p>
                </div>
                <div className="course-meta">
                  <span className="chip">{course.level}</span>
                  <span className="mono faint">
                    {finished}/{course.lessons.length}
                  </span>
                </div>
              </header>
              <div className="lesson-row">
                {course.lessons.map((lesson, i) => {
                  const isDone = done.includes(lessonKey(course.id, lesson.id));
                  return (
                    <button key={lesson.id} className={`lesson-chip ${isDone ? 'done' : ''}`} onClick={() => navigate(`learn/${course.id}/${lesson.id}`)}>
                      <span className="lesson-index mono">{isDone ? <CheckCircle2 /> : String(i + 1).padStart(2, '0')}</span>
                      <span className="lesson-text">
                        <b>{lesson.title}</b>
                        <small>{lesson.summary}</small>
                      </span>
                      <ChevronRight className="chev" />
                    </button>
                  );
                })}
              </div>
            </motion.section>
          );
        })}
      </div>
    </div>
  );
}
