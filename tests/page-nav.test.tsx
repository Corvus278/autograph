/**
 * @vitest-environment jsdom
 */
import { resolveShownPageIndex } from '@pages/Generator/model/buildPageRenderParams';
import { clearLayoutCache } from '@pages/Generator/model/measureLayout';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageLayout } from '@pages/Generator/model/usePageLayout';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { useRunRender } from '@pages/Generator/model/useRunRender';
import {
  getPartnerIndex,
  SheetViewport,
} from '@pages/Generator/ui/Generator/SheetViewport';
import {
  getSpreadPair,
  stepPage,
} from '@pages/Generator/ui/Generator/SheetViewport/spreadPages';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { buildRenderFamily } from './helpers/paper-family';

const FAMILY = buildRenderFamily();

/**
 * Запас снизу, оставляющий на листе семьи-модели две строки: по два коротких
 * слова в строке — четыре слова на страницу.
 */
const TWO_LINE_BOTTOM_MARGIN = 7;

const WORDS_PER_PAGE = 4;

/**
 * Текст ровно на заданное число страниц.
 *
 * @param pageCount — сколько страниц нужно
 * @returns текст из коротких слов
 */
const buildText = (pageCount: number): string => {
  return Array.from({ length: pageCount * WORDS_PER_PAGE }, () => {
    return 'раз';
  }).join(' ');
};

/**
 * Экран вокруг области просмотра: поле текста рядом, как на экране генератора,
 * источник второй страницы разворота — из стора.
 */
const Harness: FC = () => {
  const pages = usePageLayout(createMonospaceMeasurerFactory({ charWidth: 0.2 }).create);
  const pageIndex = useGeneratorStore((state) => {
    return state.pageIndex;
  });
  const source = usePageRender(pages);
  const partnerSource = usePageRender(
    pages,
    getPartnerIndex(resolveShownPageIndex(pageIndex, pages.length))
  );
  const plan = useRunRender(pages);

  return (
    <>
      <textarea aria-label="Текст" />

      <SheetViewport source={source} partnerSource={partnerSource} plan={plan} />
    </>
  );
};

const getPageInput = (): HTMLInputElement => {
  const input = screen.getByRole('textbox', { name: 'Номер страницы' });

  if (!(input instanceof HTMLInputElement)) {
    throw new Error('Номер страницы — не поле ввода');
  }

  return input;
};

const isDisabled = (element: HTMLElement): boolean => {
  return element instanceof HTMLButtonElement && element.disabled;
};

const getPageIndex = (): number => {
  return useGeneratorStore.getState().pageIndex;
};

const renderWithPages = async (pageCount: number): Promise<void> => {
  useGeneratorStore.setState({ text: buildText(pageCount) });
  render(<Harness />);

  await waitFor(() => {
    expect(screen.getByTestId('page-count').textContent).toBe(`/ ${String(pageCount)}`);
  });
};

beforeEach(() => {
  clearLayoutCache();
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
    bottomMargin: TWO_LINE_BOTTOM_MARGIN,
  });
  useGeneratorStore.getState().selectRealismLevel('even');
});

afterEach(() => {
  cleanup();
});

describe('шаг по страницам', () => {
  it('по одной странице шагает на единицу и не выходит за края', () => {
    expect(stepPage(0, 1, 3, false)).toBe(1);
    expect(stepPage(2, 1, 3, false)).toBe(2);
    expect(stepPage(0, -1, 3, false)).toBe(0);
  });

  it('в развороте шагает на разворот и встаёт на его левую страницу', () => {
    expect(stepPage(0, 1, 4, true)).toBe(2);
    expect(stepPage(1, 1, 4, true)).toBe(2);
    expect(stepPage(3, -1, 4, true)).toBe(0);
    expect(stepPage(2, 1, 3, true)).toBe(2);
  });

  it('пара разворота — нечётная слева, чётная справа, последняя без пары одна', () => {
    expect(getSpreadPair(1, 4)).toEqual({ left: 0, right: 1 });
    expect(getSpreadPair(2, 3)).toEqual({ left: 2, right: null });
  });
});

describe('навигация по страницам', () => {
  it('показывает номер текущей страницы и их число', async () => {
    await renderWithPages(3);

    expect(getPageInput().value).toBe('1');
    expect(isDisabled(screen.getByRole('button', { name: 'Предыдущая страница' }))).toBe(
      true
    );
  });

  it('кнопки листают вперёд и назад, на последней «вперёд» недоступна', async () => {
    const user = userEvent.setup();

    await renderWithPages(3);
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));
    await user.click(screen.getByRole('button', { name: 'Следующая страница' }));

    expect(getPageIndex()).toBe(2);
    expect(getPageInput().value).toBe('3');
    expect(isDisabled(screen.getByRole('button', { name: 'Следующая страница' }))).toBe(
      true
    );

    await user.click(screen.getByRole('button', { name: 'Предыдущая страница' }));

    expect(getPageIndex()).toBe(1);
  });

  it('переходит на страницу по номеру, несуществующий номер отбрасывает', async () => {
    const user = userEvent.setup();

    await renderWithPages(3);
    await user.clear(getPageInput());
    await user.type(getPageInput(), '3{Enter}');

    expect(getPageIndex()).toBe(2);

    await user.clear(getPageInput());
    await user.type(getPageInput(), '9{Enter}');

    expect(getPageIndex()).toBe(2);
    expect(getPageInput().value).toBe('3');
  });

  it('стрелки вне полей ввода листают страницы', async () => {
    await renderWithPages(3);

    fireEvent.keyDown(document.body, { key: 'ArrowRight' });

    expect(getPageIndex()).toBe(1);

    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });

    expect(getPageIndex()).toBe(0);
  });

  it('стрелки в поле текста двигают курсор, а не страницу', async () => {
    await renderWithPages(3);

    const textArea = screen.getByRole('textbox', { name: 'Текст' });

    textArea.focus();

    const isNotCancelled = fireEvent.keyDown(textArea, { key: 'ArrowRight' });

    expect(getPageIndex()).toBe(0);
    expect(isNotCancelled).toBe(true);
  });

  it('стрелки в поле номера страницы не листают', async () => {
    await renderWithPages(3);

    fireEvent.keyDown(getPageInput(), { key: 'ArrowRight' });

    expect(getPageIndex()).toBe(0);
  });

  it('в развороте стрелка шагает на разворот и выравнивает на нечётную', async () => {
    await renderWithPages(4);

    act(() => {
      useGeneratorStore.setState({ isSpread: true });
      useGeneratorStore.getState().goToPage(1);
    });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });

    expect(getPageIndex()).toBe(2);
  });

  it('когда текст сократился, открывает последнюю существующую страницу', async () => {
    await renderWithPages(5);

    act(() => {
      useGeneratorStore.getState().goToPage(4);
    });
    act(() => {
      useGeneratorStore.getState().setText(buildText(3));
    });

    await waitFor(() => {
      expect(screen.getByTestId('page-count').textContent).toBe('/ 3');
    });

    expect(getPageIndex()).toBe(2);
    expect(getPageInput().value).toBe('3');
  });
});
