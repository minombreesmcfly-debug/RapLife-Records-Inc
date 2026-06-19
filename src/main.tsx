import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global Safety Interceptors for Restricted Sandboxed / Offline environments
const originalConsoleError = console.error;
console.error = function (...args) {
  const msg = args.map(arg => {
    if (arg instanceof Error) {
      return arg.message + " " + arg.stack;
    }
    return typeof arg === 'object' ? JSON.stringify(arg) : String(arg);
  }).join(' ');

  if (
    msg.includes('the client is offline') || 
    msg.includes('Failed to get document') || 
    msg.includes('client is offline') ||
    msg.includes('IndexedDB transaction') ||
    msg.includes('IndexedDbTransactionError')
  ) {
    console.warn("[SANDBOX OFFLINE INTERCEPTED]", ...args);
    return;
  }
  originalConsoleError.apply(console, args);
};

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message = reason instanceof Error ? reason.message : String(reason);
  if (
    message.includes('the client is offline') || 
    message.includes('Failed to get document') || 
    message.includes('client is offline') ||
    message.includes('IndexedDbTransactionError')
  ) {
    console.warn("[UNHANDLED OFFLINE REJECTION]:", message);
    event.preventDefault(); // Prevent crash signature propagation
  }
});

window.addEventListener('error', (event) => {
  const message = event.error instanceof Error ? event.error.message : event.message;
  if (
    message.includes('the client is offline') || 
    message.includes('Failed to get document') || 
    message.includes('client is offline') ||
    message.includes('IndexedDbTransactionError')
  ) {
    console.warn("[UNHANDLED OFFLINE ERROR]:", message);
    event.preventDefault(); // Suppress runtime exception crash state
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
