import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';

// Apply saved colors immediately before React mounts to prevent flash of default colors
const applyInitialColors = () => {
  try {
    const savedColors = localStorage.getItem('uiColors');
    if (savedColors) {
      const colors = JSON.parse(savedColors);
      const root = document.documentElement;
      
      Object.entries(colors).forEach(([key, value]) => {
        root.style.setProperty(key, value as string);
      });
      
      console.log('Applied saved colors from localStorage');
    }
  } catch (e) {
    console.error('Error applying saved colors:', e);
  }
};

// Run immediately before any React code
applyInitialColors();

import App from './App';
import './index.css';

// Safely get root element
const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Failed to find the root element');
}

// Create root with error boundary
const root = createRoot(rootElement);

// Render app with error boundary and toast notifications
root.render(
  <StrictMode>
    <App />
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 4000,
        style: {
          background: '#1a0b2e',
          color: '#ffffff',
          border: '1px solid #9d00ff',
        },
        success: {
          iconTheme: {
            primary: '#ff00ff',
            secondary: '#ffffff',
          },
        },
        error: {
          iconTheme: {
            primary: '#ff3333',
            secondary: '#ffffff',
          },
          style: {
            border: '1px solid #ff3333',
          },
          duration: 5000,
        },
      }}
    />
  </StrictMode>
);