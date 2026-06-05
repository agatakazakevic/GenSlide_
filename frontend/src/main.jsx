// ============================================
// FILE: frontend/src/main.jsx
// ============================================
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css'; // or black, simple, serif

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)