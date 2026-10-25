import { useEffect } from 'react';
import { create } from 'zustand';
import { AnimatePresence, motion } from 'motion/react';
import { useOnline } from '../online/store';

interface Toast {
  id: number;
  text: string;
  tone: 'info' | 'good' | 'bad' | 'brass';
}

const useToasts = create<{ items: Toast[]; push: (t: Omit<Toast, 'id'>) => void; drop: (id: number) => void }>()((set, get) => ({
  items: [],
  push: (t) => {
    const id = Date.now() + Math.random();
    set({ items: [...get().items.slice(-3), { ...t, id }] });
    setTimeout(() => get().drop(id), 3200);
  },
  drop: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export function toast(text: string, tone: Toast['tone'] = 'info') {
  useToasts.getState().push({ text, tone });
}

export function Toasts() {
  const items = useToasts((s) => s.items);
  const notice = useOnline((s) => s.notice);

  useEffect(() => {
    if (notice) toast(notice.text);
  }, [notice]);

  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.tone}`}
            initial={{ opacity: 0, y: 16, rotateX: -40 }}
            animate={{ opacity: 1, y: 0, rotateX: 0 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            layout
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
