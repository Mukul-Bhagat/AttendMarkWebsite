// 🛡️ TIME GUARDS - MUST BE FIRST IMPORT
// Enables runtime monitoring of Date usage to prevent time bugs during migration
// See TIME_ARCHITECTURE.md for details
import './utils/timeGuards';

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext' // Import the provider
import './index.css'

// Set default theme to light mode on initial load
const storedTheme = localStorage.getItem('theme');
if (!storedTheme || storedTheme === 'light') {
  document.documentElement.classList.remove('dark');
} else if (storedTheme === 'dark') {
  document.documentElement.classList.add('dark');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider> {/* Wrap the App in the provider */}
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
)

