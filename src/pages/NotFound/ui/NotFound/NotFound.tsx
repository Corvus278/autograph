import type { FC } from 'react';
import { Link } from 'react-router';

/**
 * Экран «не найдено» с дорогой обратно к генератору.
 */
export const NotFound: FC = () => {
  return (
    <main className="mx-auto flex w-3xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>

      <p className="text-zinc-400">Такого адреса на сайте нет.</p>

      <Link to="/" className="text-sm text-violet-300 hover:text-violet-200">
        Открыть генератор
      </Link>
    </main>
  );
};
