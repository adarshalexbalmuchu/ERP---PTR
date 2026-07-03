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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
