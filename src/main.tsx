import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// After a new deploy, a tab that's been open a while can still hold
// references to old hashed chunk filenames (e.g. Dashboard-<hash>.js) that
// no longer exist on the server — Vite fires this event when that dynamic
// import fails. Reloading picks up the current deployment's correct chunk
// names; the sessionStorage guard just stops a single reload from looping
// forever if the bundle is genuinely broken, and is cleared below once this
// load succeeds so a *future* deploy can still trigger one auto-recovery.
const CHUNK_RELOAD_KEY = 'ptr-chunk-reload';
window.addEventListener('vite:preloadError', () => {
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY)) return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
});
window.addEventListener('load', () => sessionStorage.removeItem(CHUNK_RELOAD_KEY));

// The service worker (src/sw.ts) claims every open tab as soon as a new
// deploy activates (see its `activate` handler), which fires this event on
// navigator.serviceWorker in every tab that was already open. Without this
// listener that new worker silently takes over in the background but the
// page keeps running the OLD JS until someone manually reloads — this is
// what makes changes (a newly assigned task, a bug fix, anything) only show
// up after a hard refresh. Reloading once here means it just works.
if ('serviceWorker' in navigator) {
  let reloadedForNewWorker = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadedForNewWorker) return;
    reloadedForNewWorker = true;
    window.location.reload();
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
