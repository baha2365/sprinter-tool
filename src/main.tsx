import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element not found');
}

// Note: intentionally not wrapped in <React.StrictMode> — strict mode
// double-invokes effects in development, which would fire duplicate
// getUserMedia/AudioContext requests and complicate the camera + audio
// lifecycle. Safe to add back if you refactor those hooks to be
// idempotent under double-invocation.
ReactDOM.createRoot(rootEl).render(<App />);
