import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import { useGeneratorStore } from '../../../model/useGeneratorStore';

import type { PageNavProps } from './PageNav.types';

/**
 * Навигация по страницам. На одностраничном тексте не показывается — листать
 * нечего.
 */
export const PageNav: FC<PageNavProps> = (props) => {
  const { pageCount } = props;
  const pageIndex = useGeneratorStore((state) => {
    return state.pageIndex;
  });
  const goToPage = useGeneratorStore((state) => {
    return state.goToPage;
  });

  if (pageCount < 2) {
    return null;
  }

  return (
    <nav aria-label="Страницы" className="flex flex-wrap gap-1">
      {Array.from({ length: pageCount }, (_item, index) => {
        const isCurrent = index === pageIndex;

        const handlePageClick = () => {
          goToPage(index);
        };

        return (
          <button
            key={index}
            type="button"
            aria-current={isCurrent ? 'page' : undefined}
            onClick={handlePageClick}
            className={cx(
              'min-w-8 cursor-pointer rounded-md border border-zinc-700 px-2 py-1 text-sm text-zinc-300 hover:bg-zinc-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400',
              isCurrent && 'border-violet-500 bg-violet-600 text-white'
            )}
          >
            {index + 1}
          </button>
        );
      })}
    </nav>
  );
};
