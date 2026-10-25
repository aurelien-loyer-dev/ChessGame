import { AnimatePresence, motion } from 'motion/react';
import { Cookie } from 'lucide-react';
import { useConsent } from '../store/consent';

/** Asks once for the only optional tracker: anonymous audience measurement. */
export function ConsentBanner() {
  const { analytics, setAnalytics } = useConsent();
  return (
    <AnimatePresence>
      {analytics === null && (
        <motion.div
          className="consent-banner panel"
          role="dialog"
          aria-label="Cookies et mesure d’audience"
          initial={{ opacity: 0, y: 40, rotateX: -30 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24, delay: 0.6 }}
        >
          <Cookie className="consent-icon" />
          <p>
            Pas de publicité ni de pistage. On aimerait juste compter les visites de façon anonyme, sans cookie.{' '}
            <a href="#/legal/cookies">En savoir plus</a>
          </p>
          <div className="controls-row">
            <button className="btn sm" onClick={() => setAnalytics(false)}>
              Refuser
            </button>
            <button className="btn primary sm" onClick={() => setAnalytics(true)}>
              Accepter
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
