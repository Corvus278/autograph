import { cx } from '@shared/lib/styles';
import type { FC } from 'react';

import { useGeneratorStore } from '../../../../model/useGeneratorStore';

import type { SpreadPageProps } from './SpreadPage.types';

/**
 * Страница разворота. Клик делает её текущей: сохраняется одна страница, и в
 * развороте видно, какая, — она обведена рамкой.
 */
export const SpreadPage: FC<SpreadPageProps> = (props) => {
  const { pageIndex, isCurrent, children } = props;
  const goToPage = useGeneratorStore((state) => {
    return state.goToPage;
  });

  const handlePageClick = () => {
    goToPage(pageIndex);
  };

  return (
    <button
      type="button"
      aria-label={`Страница ${String(pageIndex + 1)}`}
      aria-pressed={isCurrent}
      onClick={handlePageClick}
      className={cx(
        'block shrink-0 cursor-pointer outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus',
        isCurrent && 'ring-2 ring-accent'
      )}
    >
      {children}
    </button>
  );
};
