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
      <Link
        to="/"
        className="rounded-sm text-base font-semibold text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Autograph
      </Link>

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
