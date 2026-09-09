import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/app.css';

import { App } from './App';

const container = document.querySelector('#root');

if (!container) {
  throw new Error('Не найден контейнер #root для монтирования приложения');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
