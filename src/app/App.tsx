import { CreateFont } from '@pages/CreateFont';
import { Generator } from '@pages/Generator';
import { NotFound } from '@pages/NotFound';
import type { FC } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router';

export const App: FC = () => {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<Generator />} />

        <Route path="/create-font" element={<CreateFont />} />

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};
