import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './shared/styles/theme.css';
import './styles/global.css';
function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.theme = theme;
}

const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;

if (savedTheme) {
  applyTheme(savedTheme);
} else {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(prefersDark ? 'dark' : 'light');
}

// 🔄 следим за сменой темы системы
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
  const saved = localStorage.getItem('theme');
  if (saved) return; // пользователь сам выбрал, не трогаем
  applyTheme(e.matches ? 'dark' : 'light');
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
