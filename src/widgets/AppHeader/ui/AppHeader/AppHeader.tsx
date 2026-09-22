import { APP_VERSION } from '@shared/config';
import type { FC } from 'react';
import { Link, NavLink } from 'react-router';

import type { AppHeaderProps } from './AppHeader.types';

/**
 * Шапка живёт в `widgets`, а не в `pages`: её рисуют три экрана, и
 * cross-импорт между страницами FSD запрещает.
 */
export const AppHeader: FC<AppHeaderProps> = (props) => {
  const { actions } = props;

  return (
    <header className="flex h-header shrink-0 items-center gap-6 border-b border-border bg-surface px-4">
      <div className="flex items-baseline gap-2">
        <Link
          to="/"
          className="rounded-sm text-base font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Autograph
        </Link>

        {/**
         * Версия — подпись рядом с названием, а не часть ссылки: в имя ссылки
         * она добавила бы читалке номер, который никуда не ведёт. Пустая
         * версия (dev-сервер, тесты) не рисуется вовсе.
         *
         * Пометка `beta` держится, пока мажор нулевой: основной функционал не
         * доделан, и пользователь должен видеть это рядом с номером.
         */}
        {APP_VERSION ? (
          <span data-testid="app-version" className="text-xs text-fg-muted tabular-nums">
            v{APP_VERSION} beta
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 items-center justify-center">{actions}</div>

      <nav aria-label="Разделы">
        <NavLink
          to="/create-font"
          className="rounded-sm text-sm text-fg-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus aria-[current=page]:text-fg"
        >
          Свой шрифт
        </NavLink>
      </nav>
    </header>
  );
};
