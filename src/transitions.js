import { flushSync } from 'react-dom';

let activeTransition;
// Retain normal React behavior on older runtimes and for reduced-motion users.
export function animateChange(change) {
  if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) { change(); return; }
  activeTransition?.skipTransition();
  activeTransition = document.startViewTransition(() => flushSync(change));
  activeTransition.finished.catch(() => {});
}
