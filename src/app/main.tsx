import { startServiceWorkerRegistration } from '@widgets/ServiceWorkerBanner';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import './styles/app.css';

import { registerServiceWorker } from './model/serviceWorkerRegistration';
import { App } from './App';

/**
 * Service worker регистрируется только в собранном приложении. Проверка
 * `PROD` нужна вдобавок к выключенным `devOptions` плагина: `storybook build`
 * — тоже production-сборка Vite, и без неё статический Storybook кэшировал бы
 * себя, а правки переставали бы доходить до экрана.
 */
if (import.meta.env.PROD) {
  startServiceWorkerRegistration(registerServiceWorker);
}

const container = document.querySelector('#root');

if (!container) {
  throw new Error('Не найден контейнер #root для монтирования приложения');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>
);
