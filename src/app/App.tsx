import { CreateFont } from '@pages/CreateFont';
import { Generator } from '@pages/Generator';
import { NotFound } from '@pages/NotFound';
import { ServiceWorkerBanner } from '@widgets/ServiceWorkerBanner';
import type { FC } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';

/**
 * Плашка service worker рисуется рядом с маршрутами, а не в шапке
 * (`AppHeader`): шапка — общий виджет трёх экранов со своим контрактом, и
 * состояние service worker связало бы её с инфраструктурой приложения. Место
 * в разметке ни на один экран не влияет — плашка позиционируется фиксированно.
 */
export const App: FC = () => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Generator />} />

        <Route path="/create-font" element={<CreateFont />} />

        <Route path="*" element={<NotFound />} />
      </Routes>

      <ServiceWorkerBanner />
    </BrowserRouter>
  );
};
