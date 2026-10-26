import {flushSync} from 'react-dom';
// The content panes own their animations; app chrome remains stationary.
export function animateChange(change){flushSync(change);}
