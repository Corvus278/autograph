import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { LINED_FAMILY_ID } from '../../config';
import { loadPaperFamilies } from '../../model/paperProfiles';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../model/useGeneratorStore';

import { Generator } from './Generator';

/**
 * Seed фиксирован: иначе каждый прогон давал бы другой почерк.
 */
const SEED = 42;

/**
 * Абзац письма: повторённый, он раскладывается на несколько страниц, и
 * разворот есть что показать.
 */
const PARAGRAPH =
  'Здравствуй, дорогой друг! Пишу тебе из деревни, где лето выдалось тёплым и долгим. ' +
  'По утрам туман стоит над рекой, а к обеду солнце прогревает сад так, что пчёлы гудят ' +
  'над каждой яблоней. Вечерами мы сидим на крыльце и слушаем, как стрекочут кузнечики.';

const LETTER_TEXT = Array.from({ length: 8 }, () => {
  return PARAGRAPH;
}).join('\n\n');

/**
 * Окно из требования к экрану генератора.
 */
const VIEWPORT_OPTIONS = {
  wide: {
    name: 'Окно 1440×900',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
};

/**
 * Группы экспертного режима — все раскрываются в проверке самого длинного
 * столбца настроек.
 */
const EXPERT_SECTIONS = ['Геометрия', 'Почерк', 'Бумага', 'Чернила', 'Сцена'];

/**
 * Главные действия, которые обязаны быть видны при любой прокрутке.
 */
const MAIN_ACTIONS = ['Перегенерировать', 'Сохранить страницу', 'Скачать все'];

/**
 * Насколько прокручиваются настройки в проверке: больше высоты окна.
 */
const SETTINGS_SCROLL = 1200;

const meta = {
  component: Generator,
  parameters: {
    layout: 'fullscreen',
    viewport: { options: VIEWPORT_OPTIONS },
  },
  globals: { viewport: { value: 'wide', isRotated: false } },
  decorators: [
    (Story) => {
      return (
        <MemoryRouter initialEntries={['/']}>
          <Story />
        </MemoryRouter>
      );
    },
  ],
  loaders: [
    async () => {
      const presetFamilies = await loadPaperFamilies();

      useGeneratorStore.setState({
        ...DEFAULT_GENERATOR_STATE,
        presetFamilies,
        familyId: LINED_FAMILY_ID,
        text: LETTER_TEXT,
        runSeed: SEED,
      });

      return {};
    },
  ],
} satisfies Meta<typeof Generator>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Проверяет, что узел целиком лежит в окне.
 *
 * @param element — проверяемый узел
 */
const expectInWindow = async (element: HTMLElement) => {
  const rect = element.getBoundingClientRect();

  await expect(rect.top).toBeGreaterThanOrEqual(0);
  await expect(rect.left).toBeGreaterThanOrEqual(0);
  await expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
  await expect(rect.right).toBeLessThanOrEqual(window.innerWidth);
};

/**
 * Ближайший прокручиваемый предок: колонка, в которой лежит узел.
 *
 * @param element — узел внутри колонки
 * @returns прокручиваемый предок
 */
const findScrollParent = (element: HTMLElement): HTMLElement => {
  let node = element.parentElement;

  while (node) {
    if (node.scrollHeight > node.clientHeight) {
      return node;
    }

    node = node.parentElement;
  }

  throw new Error('Колонка не прокручивается');
};

/**
 * Экран целиком в окне 1440×900: текст, лист и основной путь оформления видны
 * без прокрутки страницы, главные действия — в окне.
 */
export const Screen: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(window.innerWidth).toBe(1440);
    await expect(await canvas.findByTestId('page')).toBeVisible();
    await expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(
      window.innerHeight
    );

    await expectInWindow(canvas.getByRole('textbox', { name: 'Текст' }));
    await expectInWindow(canvas.getByRole('region', { name: 'Лист' }));

    for (const name of ['Семья листов', 'Цвет чернил', 'Реализм']) {
      await expect(canvas.getByRole('radiogroup', { name })).toBeVisible();
    }

    await expect(
      canvas
        .getByRole('button', { name: 'Экспертный режим' })
        .getAttribute('aria-expanded')
    ).toBe('false');

    for (const name of MAIN_ACTIONS) {
      await expectInWindow(canvas.getByRole('button', { name }));
    }
  },
};

/**
 * Экспертный режим раскрыт со всеми группами: столбец настроек выше окна и
 * прокручивается сам, лист при этом не двигается, а главные действия
 * остаются в окне.
 */
export const ExpertMode: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByTestId('page');
    await userEvent.click(canvas.getByRole('button', { name: 'Экспертный режим' }));

    for (const section of EXPERT_SECTIONS) {
      await userEvent.click(canvas.getByRole('button', { name: section }));
    }

    const resetButton = canvas.getByRole('button', { name: 'Сбросить поправку' });
    const settingsColumn = findScrollParent(resetButton);
    /**
     * Лист ищется по странице, а не по области «Лист»: так же называется и
     * раскрытая группа экспертного режима.
     */
    const sheet = canvas.getByTestId('page');
    const sheetTopBefore = sheet.getBoundingClientRect().top;

    await expect(settingsColumn.scrollHeight).toBeGreaterThan(
      settingsColumn.clientHeight
    );

    settingsColumn.scrollTop = SETTINGS_SCROLL;

    await expect(settingsColumn.scrollTop).toBeGreaterThan(0);
    await expect(sheet.getBoundingClientRect().top).toBe(sheetTopBefore);
    await expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(
      window.innerHeight
    );

    for (const name of MAIN_ACTIONS) {
      await expectInWindow(canvas.getByRole('button', { name }));
    }
  },
};

/**
 * Разворот на экране: пара страниц в области просмотра, вторая страница — та,
 * что идёт за первой.
 */
export const Spread: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await canvas.findByTestId('page');

    await waitFor(async () => {
      await expect(canvas.getByTestId('page-count').textContent).not.toBe('/ 1');
    });

    await userEvent.click(canvas.getByRole('radio', { name: 'Разворот' }));

    await expectInWindow(await canvas.findByRole('button', { name: 'Страница 1' }));
    await expectInWindow(canvas.getByRole('button', { name: 'Страница 2' }));
  },
};
