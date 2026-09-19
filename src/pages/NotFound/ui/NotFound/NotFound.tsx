import { AppHeader } from '@widgets/AppHeader';
import type { FC } from 'react';
import { Link } from 'react-router';

/**
 * Экран «не найдено» с дорогой обратно к генератору.
 */
export const NotFound: FC = () => {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />

      <main className="mx-auto flex w-3xl flex-col gap-4 p-6">
        <h1 className="text-2xl font-semibold">Страница не найдена</h1>

        <p className="text-fg-muted">Такого адреса на сайте нет.</p>

        <Link
          to="/"
          className="self-start rounded-sm text-sm text-fg-muted underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Открыть генератор
        </Link>
      </main>
    </div>
  );
};
