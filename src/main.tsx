import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/press-start-2p/400.css';
import { App } from './app/App';
import { ErrorBoundary } from './app/ErrorBoundary';
import { applyMotionSetting, loadMotionSetting } from './storage/displaySettings';
import './styles/global.css';

applyMotionSetting(loadMotionSetting());

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
