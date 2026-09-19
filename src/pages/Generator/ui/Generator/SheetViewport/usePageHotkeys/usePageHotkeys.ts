import { useEffect, useLayoutEffect, useRef } from 'react';

import { useGeneratorStore } from '../../../../model/useGeneratorStore';
import { stepPage } from '../spreadPages';
import type { PageDirection } from '../spreadPages.types';

import type { PageHotkeysInput } from './usePageHotkeys.types';

/**
 * Узлы, которым стрелки принадлежат сами: в поле ввода они двигают курсор, в
 * ползунке — значение, в панели инструментов и группе переключателей — фокус.
 */
const ARROW_OWNER_SELECTOR =
  'input, textarea, select, [contenteditable], [role="slider"], [role="toolbar"], [role="radiogroup"], [role="tablist"], [role="menu"], [role="listbox"]';

/**
 * Направление шага по клавише.
 *
 * @param key — клавиша события
 * @returns направление; `null` — клавиша не листает
 */
const getArrowDirection = (key: string): PageDirection | null => {
  switch (key) {
    case 'ArrowLeft': {
      return -1;
    }

    case 'ArrowRight': {
      return 1;
    }

    default: {
      return null;
    }
  }
};

/**
 * Забрал ли стрелку узел, в котором она уже что-то делает.
 *
 * @param target — узел, получивший клавишу
 * @returns `true` — стрелка не для навигации
 */
const isArrowOwner = (target: EventTarget | null): boolean => {
  return target instanceof Element && target.closest(ARROW_OWNER_SELECTOR) !== null;
};

/**
 * Стрелки влево и вправо листают страницы, пока фокус не в поле ввода и не в
 * контроле, который сам ходит по стрелкам.
 *
 * Слушатель висит на окне, а не на области просмотра: фокус после клика по
 * листу или по пустому месту уходит на `body`, и листать должно и оттуда.
 *
 * @param input — показанная страница, число страниц и режим разворота
 */
export const usePageHotkeys = (input: PageHotkeysInput): void => {
  /**
   * Значения берутся на момент нажатия: иначе слушатель переподписывался бы
   * на каждую смену страницы.
   */
  const latestRef = useRef(input);

  useLayoutEffect(() => {
    latestRef.current = input;
  });

  useEffect(() => {
    const handleWindowKeyDown = (event: KeyboardEvent) => {
      const direction = getArrowDirection(event.key);
      const hasModifier =
        event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

      if (
        direction === null ||
        hasModifier ||
        event.defaultPrevented ||
        isArrowOwner(event.target)
      ) {
        return;
      }

      const { pageIndex, pageCount, isSpread } = latestRef.current;
      const next = stepPage(pageIndex, direction, pageCount, isSpread);

      if (next === pageIndex) {
        return;
      }

      event.preventDefault();
      useGeneratorStore.getState().goToPage(next);
    };

    window.addEventListener('keydown', handleWindowKeyDown);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, []);
};
