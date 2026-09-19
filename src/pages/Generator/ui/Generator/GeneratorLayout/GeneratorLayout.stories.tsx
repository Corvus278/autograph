import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppHeader } from '@widgets/AppHeader';
import { MemoryRouter } from 'react-router';
import { expect, within } from 'storybook/test';

import { GeneratorLayout } from './GeneratorLayout';

/**
 * Число заглушек-контролов в колонке настроек: вместе они заметно выше окна,
 * как раскрытый экспертный режим.
 */
const SETTINGS_ITEM_COUNT = 60;

const SETTINGS_ITEMS = Array.from({ length: SETTINGS_ITEM_COUNT }, (_item, index) => {
  return `Настройка ${index + 1}`;
});

/**
 * Насколько прокручиваются настройки в проверке: больше высоты окна.
 */
const SETTINGS_SCROLL = 1200;

/**
 * Окна проверок: размер из требования и узкое, уже порога 1280.
 */
const VIEWPORT_OPTIONS = {
  wide: {
    name: 'Окно 1440×900',
    styles: { width: '1440px', height: '900px' },
    type: 'desktop',
  },
  narrow: {
    name: 'Окно 1024×768',
    styles: { width: '1024px', height: '768px' },
    type: 'desktop',
  },
};

/**
 * Размер заглушки листа: влезает в область просмотра окна 1440×900.
 */
const SHEET_SIZE = { width: 420, height: 600 };

/**
 * Минимальная ширина экрана из требования к настольным окнам.
 */
const DESKTOP_MIN_WIDTH = 1280;

const meta = {
  component: GeneratorLayout,
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
  args: {
    header: <AppHeader />,
    text: <textarea aria-label="Текст" className="h-full w-full" />,
    viewport: (
      <div
        role="img"
        aria-label="Лист"
        className="mx-auto my-6 bg-fg shadow-sheet"
        style={SHEET_SIZE}
      />
    ),
    settings: (
      <div className="flex flex-col gap-4 p-4">
        {SETTINGS_ITEMS.map((label) => {
          return (
            <button key={label} type="button" className="h-12 text-fg">
              {label}
            </button>
          );
        })}
      </div>
    ),
    actions: (
      <div className="flex w-full justify-between">
        <button type="button" className="text-fg">
          Перегенерировать
        </button>

        <button type="button" className="text-fg">
          Сохранить страницу
        </button>
      </div>
    ),
  },
} satisfies Meta<typeof GeneratorLayout>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Узел колонки, который прокручивается: ближайший предок с прокруткой.
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

export const Desktop: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(window.innerWidth).toBe(1440);

    const sheet = canvas.getByRole('img', { name: 'Лист' });
    const settingsItem = canvas.getByRole('button', { name: 'Настройка 1' });
    const settingsColumn = findScrollParent(settingsItem);
    const sheetTopBefore = sheet.getBoundingClientRect().top;

    await expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(
      window.innerHeight
    );

    settingsColumn.scrollTop = SETTINGS_SCROLL;

    await expect(settingsColumn.scrollTop).toBeGreaterThan(0);
    await expect(sheet.getBoundingClientRect().top).toBe(sheetTopBefore);

    for (const name of ['Перегенерировать', 'Сохранить страницу']) {
      const rect = canvas.getByRole('button', { name }).getBoundingClientRect();

      await expect(rect.top).toBeGreaterThanOrEqual(0);
      await expect(rect.bottom).toBeLessThanOrEqual(window.innerHeight);
    }

    await expect(canvas.getByRole('textbox', { name: 'Текст' })).toBeVisible();
    await expect(canvas.getByRole('banner')).toBeVisible();
  },
};

export const NarrowWindow: Story = {
  globals: { viewport: { value: 'narrow', isRotated: false } },
  play: async () => {
    await expect(window.innerWidth).toBe(1024);
    await expect(document.documentElement.scrollWidth).toBeGreaterThanOrEqual(
      DESKTOP_MIN_WIDTH
    );
  },
};
