import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { expect, userEvent, waitFor, within } from 'storybook/test';

import { LINED_FAMILY_ID } from '../../../config';
import type { Line } from '../../../lib/split/splitParagraphs.types';
import { loadPaperFamilies } from '../../../model/paperProfiles';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';
import { usePageRender } from '../../../model/usePageRender';
import { useRunRender } from '../../../model/useRunRender';

import { SheetViewport } from './SheetViewport';
import { getPartnerIndex } from './spreadPages';

/**
 * Seed фиксирован: иначе каждый прогон давал бы другой почерк.
 */
const SEED = 42;

const LINES: Line[] = [
  { text: 'Здравствуй, дорогой друг!', paragraphIndex: 0 },
  { text: 'Лист вписан в область просмотра.', paragraphIndex: 0 },
];

const SECOND_LINES: Line[] = [{ text: 'Вторая страница разворота.', paragraphIndex: 0 }];

/**
 * Две страницы: разворот есть что показать. Раскладка задана руками —
 * измерять в story нечего.
 */
const PAGES = [
  { lines: LINES, sheetId: '' },
  { lines: SECOND_LINES, sheetId: '' },
];

/**
 * Область просмотра story: примерно центральная колонка окна 1440×900.
 */
const VIEWPORT_BOX = { width: '760px', height: '720px' };

/**
 * Порог контраста края листа с фоном области — WCAG 1.4.11 для
 * нетекстовых элементов интерфейса.
 */
const MIN_EDGE_CONTRAST = 3;

/**
 * Полоса листа под профиль бумаги в долях высоты: ниже текста story и выше
 * края, где у фотографии бывают тени.
 */
const PROFILE_BAND = { top: 0.7, height: 0.2 };

/**
 * Источники текущей и второй страницы разворота и план отрисовки — из стора.
 */
const SheetViewportStory: FC = () => {
  const pageIndex = useGeneratorStore((state) => {
    return state.pageIndex;
  });
  const source = usePageRender(PAGES);
  const partnerSource = usePageRender(PAGES, getPartnerIndex(pageIndex));
  const plan = useRunRender(PAGES);

  return (
    <div className="flex flex-col" style={VIEWPORT_BOX}>
      <SheetViewport source={source} partnerSource={partnerSource} plan={plan} />
    </div>
  );
};

/**
 * Относительная яркость цвета по WCAG из байтов sRGB.
 *
 * @param rgb — красный, зелёный, синий от 0 до 255
 * @returns яркость от 0 до 1
 */
const getLuminance = (rgb: readonly number[]): number => {
  const [red = 0, green = 0, blue = 0] = rgb.map((channel) => {
    const value = channel / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

/**
 * Переводит css-цвет в байты sRGB через canvas: вычисленный стиль отдаёт
 * `oklch(...)`, разбирать который руками незачем.
 *
 * @param color — css-цвет
 * @returns красный, зелёный, синий от 0 до 255
 */
const toRgb = (color: string): number[] => {
  const context = document.createElement('canvas').getContext('2d');

  if (!context) {
    throw new Error('Браузер не дал контекст canvas');
  }

  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);

  return Array.from(context.getImageData(0, 0, 1, 1).data.slice(0, 3));
};

/**
 * Средний цвет полосы пикселей у края листа: им лист граничит с фоном.
 *
 * @param canvas — основной растр листа
 * @returns средние красный, зелёный, синий
 */
const getEdgeRgb = (canvas: HTMLCanvasElement): number[] => {
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Браузер не дал контекст canvas');
  }

  const { data } = context.getImageData(0, 0, canvas.width, 2);
  const sums = [0, 0, 0];
  let count = 0;

  for (let offset = 0; offset < data.length; offset += 4) {
    sums[0] = (sums[0] || 0) + (data[offset] || 0);
    sums[1] = (sums[1] || 0) + (data[offset + 1] || 0);
    sums[2] = (sums[2] || 0) + (data[offset + 2] || 0);
    count += 1;
  }

  return sums.map((sum) => {
    return sum / Math.max(1, count);
  });
};

/**
 * Лист дорисован: на основном растре есть непрозрачные пиксели.
 *
 * @param canvas — основной растр листа
 * @returns `true` — лист нарисован
 */
const isSheetDrawn = (canvas: HTMLCanvasElement): boolean => {
  const context = canvas.getContext('2d');

  if (!context || canvas.width === 0) {
    return false;
  }

  const [, , , alpha = 0] = context.getImageData(
    Math.floor(canvas.width / 2),
    Math.floor(canvas.height / 2),
    1,
    1
  ).data;

  return alpha > 0;
};

/**
 * Средняя яркость каждого столбца листа в нижней полосе, где текста нет:
 * профиль фотографии бумаги — линии поля, тени, свет.
 *
 * @param canvas — основной растр листа
 * @returns яркость по столбцам слева направо
 */
const getColumnProfile = (canvas: HTMLCanvasElement): number[] => {
  const context = canvas.getContext('2d');

  if (!context) {
    return [];
  }

  const top = Math.floor(canvas.height * PROFILE_BAND.top);
  const height = Math.floor(canvas.height * PROFILE_BAND.height);
  const { data } = context.getImageData(0, top, canvas.width, height);

  return Array.from({ length: canvas.width }, (_item, column) => {
    let sum = 0;

    for (let row = 0; row < height; row += 1) {
      const offset = (row * canvas.width + column) * 4;

      sum += getLuminance([
        data[offset] || 0,
        data[offset + 1] || 0,
        data[offset + 2] || 0,
      ]);
    }

    return sum / height;
  });
};

/**
 * Среднее расхождение двух профилей одной длины.
 *
 * @param left — первый профиль
 * @param right — второй профиль
 * @returns средний модуль разности
 */
const getProfileDistance = (left: number[], right: number[]): number => {
  const total = left.reduce((sum, value, index) => {
    return sum + Math.abs(value - (right[index] || 0));
  }, 0);

  return total / Math.max(left.length, 1);
};

const findSheetCanvas = async (
  root: HTMLElement,
  pageName?: string
): Promise<HTMLCanvasElement> => {
  const scope = pageName ? within(root).getByRole('button', { name: pageName }) : root;
  const canvas = await within(scope).findByTestId('page-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Лист рисуется не на canvas');
  }

  await waitFor(async () => {
    await expect(isSheetDrawn(canvas)).toBe(true);
  });

  return canvas;
};

const meta = {
  component: SheetViewportStory,
  parameters: { layout: 'fullscreen' },
  loaders: [
    async () => {
      const presetFamilies = await loadPaperFamilies();

      useGeneratorStore.setState({
        ...DEFAULT_GENERATOR_STATE,
        presetFamilies,
        familyId: LINED_FAMILY_ID,
        sheetId: `${LINED_FAMILY_ID}-1`,
        isSheetPinned: true,
        runSeed: SEED,
      });

      return {};
    },
  ],
} satisfies Meta<typeof SheetViewportStory>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * По умолчанию лист вписан целиком, а край светлой бумаги читается на фоне
 * области: контраст полосы у края с фоном не ниже 3:1, и вокруг листа есть
 * тень.
 */
export const Fit: Story = {
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);
    const canvas = await findSheetCanvas(canvasElement);
    const region = root.getByRole('region', { name: 'Лист' });
    const sheet = root.getByTestId('page');

    await expect(region.scrollHeight).toBeLessThanOrEqual(region.clientHeight);
    await expect(region.scrollWidth).toBeLessThanOrEqual(region.clientWidth);

    const background = getLuminance(toRgb(getComputedStyle(region).backgroundColor));
    const edge = getLuminance(getEdgeRgb(canvas));
    const contrast =
      (Math.max(background, edge) + 0.05) / (Math.min(background, edge) + 0.05);

    await expect(contrast).toBeGreaterThanOrEqual(MIN_EDGE_CONTRAST);
    await expect(getComputedStyle(sheet).boxShadow).not.toBe('none');
  },
};

/**
 * Увеличение делает лист прокручиваемым, «Вписать» возвращает его целиком.
 */
export const ZoomAndFit: Story = {
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);

    await findSheetCanvas(canvasElement);

    const region = root.getByRole('region', { name: 'Лист' });
    const zoomIn = root.getByRole('button', { name: 'Увеличить' });

    await userEvent.click(zoomIn);
    await userEvent.click(zoomIn);
    await userEvent.click(zoomIn);

    await waitFor(async () => {
      await expect(region.scrollHeight).toBeGreaterThan(region.clientHeight);
    });

    await userEvent.click(root.getByRole('button', { name: 'Вписать' }));

    await waitFor(async () => {
      await expect(region.scrollHeight).toBeLessThanOrEqual(region.clientHeight);
    });
    await expect(useGeneratorStore.getState().zoom).toBe('fit');
  },
};

/**
 * Разворот: слева первая страница, справа вторая, и вторая зеркальна — профиль
 * бумаги справа совпадает с отражённым профилем слева лучше, чем с прямым.
 * Текущая страница обведена, клик по второй делает текущей её.
 */
export const Spread: Story = {
  play: async ({ canvasElement }) => {
    const root = within(canvasElement);

    await userEvent.click(root.getByRole('radio', { name: 'Разворот' }));

    const left = await findSheetCanvas(canvasElement, 'Страница 1');
    const right = await findSheetCanvas(canvasElement, 'Страница 2');
    const leftProfile = getColumnProfile(left);
    const rightProfile = getColumnProfile(right);

    await expect(right.width).toBe(left.width);
    await expect(
      getProfileDistance(leftProfile, [...rightProfile].reverse())
    ).toBeLessThan(getProfileDistance(leftProfile, rightProfile));

    await userEvent.click(root.getByRole('button', { name: 'Страница 2' }));

    await expect(useGeneratorStore.getState().pageIndex).toBe(1);
    await expect(
      root.getByRole('button', { name: 'Страница 2' }).getAttribute('aria-pressed')
    ).toBe('true');
  },
};
