/** EpiChess logotype: solid "EPI", outlined glowing "CHESS", same treatment as the home hero. */
export function Wordmark({ className = '', stacked = true }: { className?: string; stacked?: boolean }) {
  return (
    <span className={`wordmark ${stacked ? 'stacked' : ''} ${className}`} role="img" aria-label="EpiChess">
      <span aria-hidden>Epi</span>
      <span aria-hidden className="wm-outline">
        Chess
      </span>
    </span>
  );
}
