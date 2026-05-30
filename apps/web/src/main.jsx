// Validate all required environment variables before React mounts.
// If any required VITE_ variable is missing or malformed, this import
// will throw and prevent the app from loading with bad configuration.
import './lib/env.js'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

