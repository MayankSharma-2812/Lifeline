/**
 * @module main.tsx
 * @description Application entry point. Bootstraps the React application and mounts it to the DOM.
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('#root element not found');

// Mount the React application within a StrictMode boundary for additional development checks
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
