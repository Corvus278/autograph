import { IconButton } from '@shared/ui/IconButton';
import type { ChangeEvent, FC, KeyboardEvent } from 'react';
import { useState } from 'react';

import { useGeneratorStore } from '../../../../model/useGeneratorStore';
import { stepPage } from '../spreadPages';

import type { PageSwitcherProps } from './PageSwitcher.types';

/**
 * Номер страницы из поля ввода, если такая страница есть.
 *
 * @param draft — набранный текст
 * @param pageCount — число страниц прогона
 * @returns номер страницы, считая с нуля; `null` — такой страницы нет
 */
const parsePageNumber = (draft: string, pageCount: number): number | null => {
  const pageNumber = Number(draft.trim());

  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
    return null;
  }

  return pageNumber - 1;
};

/**
 * Навигация «‹ N / M ›»: шаг кнопками и переход по номеру.
 *
 * Номер правится в поле и применяется по Enter или уходу фокуса; номер вне
 * прогона отбрасывается и поле возвращается к текущей странице — пустая
 * страница на экране ничего бы не объяснила.
 */
export const PageSwitcher: FC<PageSwitcherProps> = (props) => {
  const { pageIndex, pageCount, isSpread } = props;
  const goToPage = useGeneratorStore((state) => {
    return state.goToPage;
  });
  /**
   * Набранный, но ещё не применённый номер. `null` — поле показывает текущую
   * страницу.
   */
  const [draft, setDraft] = useState<string | null>(null);
  const previousIndex = stepPage(pageIndex, -1, pageCount, isSpread);
  const nextIndex = stepPage(pageIndex, 1, pageCount, isSpread);

  const commitDraft = () => {
    const target = draft === null ? null : parsePageNumber(draft, pageCount);

    if (target !== null) {
      goToPage(target);
    }

    setDraft(null);
  };

  const handlePreviousClick = () => {
    goToPage(previousIndex);
  };

  const handleNextClick = () => {
    goToPage(nextIndex);
  };

  const handlePageInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    setDraft(event.currentTarget.value);
  };

  const handlePageInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case 'Enter': {
        commitDraft();
        break;
      }

      case 'Escape': {
        setDraft(null);
        break;
      }

      default: {
        break;
      }
    }
  };

  const handlePageInputBlur = () => {
    commitDraft();
  };

  return (
    <nav aria-label="Страницы" className="flex items-center gap-1">
      <IconButton
        label="Предыдущая страница"
        isDisabled={previousIndex === pageIndex}
        onClick={handlePreviousClick}
      >
        <svg aria-hidden viewBox="0 0 16 16">
          <path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </IconButton>

      {/**
       * `??`, а не `||`: стёртое поле — пустая строка, и `||` вернул бы в него
       * номер посреди набора.
       */}
      <input
        aria-label="Номер страницы"
        inputMode="numeric"
        value={draft ?? String(pageIndex + 1)}
        onChange={handlePageInputChange}
        onKeyDown={handlePageInputKeyDown}
        onBlur={handlePageInputBlur}
        className="h-8 w-10 rounded-md border border-border bg-surface text-center text-sm text-fg tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      />

      <span data-testid="page-count" className="text-sm text-fg-muted tabular-nums">
        / {pageCount}
      </span>

      <IconButton
        label="Следующая страница"
        isDisabled={nextIndex === pageIndex}
        onClick={handleNextClick}
      >
        <svg aria-hidden viewBox="0 0 16 16">
          <path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </IconButton>
    </nav>
  );
};
