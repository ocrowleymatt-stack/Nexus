import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App';
import './index.css';
import { IntelErrorBoundary } from './components/IntelErrorBoundary';

// Nexus Intel System Boot - v1.2.1
createRoot(document.getElementById('root')!).render(
  <IntelErrorBoundary>
    <StrictMode>
      <App />
    </StrictMode>
  </IntelErrorBoundary>,
);
