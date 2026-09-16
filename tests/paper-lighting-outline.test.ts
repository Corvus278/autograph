import type {
  LightingField,
  PaperMargins,
  SheetImageData,
  SheetOutline,
  TextureMap,
} from '@pages/Generator/lib/paper';
import {
  extractLighting,
  extractTexture,
  resolveSheetBounds,
} from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

import {
  createSyntheticSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

const FNV_OFFSET_BASIS = 0x81_1c_9d_c5;

const FNV_PRIME = 0x01_00_01_93;

/**
 * FNV-1a по байтам буфера: свёртка нужна затем, чтобы эталон «до правки»
 * держался в тесте числом, а не двумя сотнями литералов, и при этом ловил
 * расхождение в последнем бите любого узла.
 *
 * @param bytes — байты значений
 * @returns свёртка шестнадцатеричной строкой
 */
const hashBytes = (bytes: Uint8Array): string => {
  let hash = FNV_OFFSET_BASIS;

  for (let index = 0; index < bytes.length; index += 1) {
    hash = Math.imul(hash ^ (bytes[index] || 0), FNV_PRIME) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
};

/**
 * Свёртка узлов поля освещения по их битам.
 *
 * @param field — поле освещения
 * @returns свёртка шестнадцатеричной строкой
 */
const hashField = (field: LightingField): string => {
  return hashBytes(new Uint8Array(Float64Array.from(field.values).buffer));
};

/**
 * Свёртка карты текстуры по битам её значений.
 *
 * @param map — карта текстуры
 * @returns свёртка шестнадцатеричной строкой
 */
const hashMap = (map: TextureMap): string => {
  return hashBytes(new Uint8Array(map.values.buffer));
};

/**
 * Прореживание карты текстуры в эталонных прогонах: задано явно, иначе оно
 * зависело бы от размера листа и эталон пришлось бы пересчитывать при любой
 * правке фикстуры.
 */
const TEXTURE_DOWNSCALE = 4;

/**
 * Эталон «до правки»: свёртки и числа сняты на базе прогона, до того как
 * `extractLighting` и `extractTexture` научились контуру. Без контура выход
 * обязан совпадать с ними побитово.
 */
const BASELINE_SHEETS = [
  {
    title: 'линейка с линией поля',
    params: {
      width: 480,
      height: 640,
      step: 32,
      phase: 11,
      angle: 0.6,
      kind: 'lined',
      margins: { top: 64, right: 40, bottom: 56, left: 72 },
      marginLineX: 96,
      lineWidth: 3,
      noise: 0.05,
      lighting: 0.35,
      seed: 3,
    } satisfies SyntheticSheetParams,
    fieldHash: '8834df00',
    contrast: 0.25393971199966636,
    mapHash: 'cf8e3e80',
    amplitude: 0.12029388993978504,
  },
  {
    title: 'клетка',
    params: {
      width: 520,
      height: 400,
      step: 26,
      phase: 7,
      angle: -0.8,
      kind: 'grid',
      margins: { top: 40, right: 30, bottom: 36, left: 44 },
      lineWidth: 2.6,
      lineDarkness: 0.3,
      noise: 0.04,
      lighting: 0.2,
      seed: 11,
    } satisfies SyntheticSheetParams,
    fieldHash: '38a24062',
    contrast: 0.1448100266014789,
    mapHash: '55f12a42',
    amplitude: 0.14328759610652925,
  },
  {
    title: 'лист без линий',
    params: {
      width: 400,
      height: 560,
      kind: 'blank',
      noise: 0.06,
      lighting: 0.5,
      seed: 5,
    } satisfies SyntheticSheetParams,
    fieldHash: '2c8fe54a',
    contrast: 0.3688882130036223,
    mapHash: '9e250987',
    amplitude: 0.007895679026842118,
  },
];

describe('extractLighting и extractTexture без контура', () => {
  it.each(BASELINE_SHEETS)(
    'выход совпадает с эталоном до правки: $title',
    ({ params, fieldHash, contrast, mapHash, amplitude }) => {
      const image = createSyntheticSheet(params);
      const field = extractLighting(image);
      const texture = extractTexture(image, field, { downscale: TEXTURE_DOWNSCALE });

      expect(hashField(field)).toBe(fieldHash);
      expect(field.contrast).toBe(contrast);
      expect(hashMap(texture)).toBe(mapHash);
      expect(texture.amplitude).toBe(amplitude);
    }
  );

  it('пустой контур считается его отсутствием', () => {
    const image = createSyntheticSheet(BASELINE_SHEETS[0]?.params);
    const field = extractLighting(image, { outline: null });

    expect(hashField(field)).toBe(BASELINE_SHEETS[0]?.fieldHash);
  });
});

const BAND_WIDTH = 900;

const BAND_HEIGHT = 1200;

/**
 * Равномерно освещённый лист, у которого сверху видна полоса стола: контур
 * начинается ниже края кадра, остальные стороны — сам кадр.
 */
const BAND_OUTLINE: SheetOutline = {
  topLeft: { x: 0, y: 210 },
  topRight: { x: BAND_WIDTH, y: 210 },
  bottomRight: { x: BAND_WIDTH, y: BAND_HEIGHT },
  bottomLeft: { x: 0, y: BAND_HEIGHT },
};

const BAND_SHEET: SyntheticSheetParams = {
  width: BAND_WIDTH,
  height: BAND_HEIGHT,
  step: 60,
  phase: 17,
  kind: 'lined',
  margins: { top: 300, right: 60, bottom: 90, left: 90 },
  lineWidth: 3,
  noise: 0.01,
  seed: 4,
  surface: { outline: BAND_OUTLINE, brightness: 0.3 },
};

/**
 * Строка сетки, целиком лежащая на бумаге: клетка 75 px, край листа на 210.
 */
const FIRST_PAPER_ROW = 3;

/**
 * Наибольшее расхождение узлов у края листа с серединой листа.
 */
const EDGE_TOLERANCE = 0.01;

/**
 * Среднее значение узлов строки сетки.
 *
 * @param field — поле освещения
 * @param row — строка сетки
 * @returns среднее узлов строки
 */
const meanOfRow = (field: LightingField, row: number): number => {
  const { gridWidth, values } = field;

  let sum = 0;

  for (let column = 0; column < gridWidth; column += 1) {
    sum += values[row * gridWidth + column] || 0;
  }

  return sum / gridWidth;
};

/**
 * Наибольшее отклонение узлов от начала сетки до строки `row` включительно от
 * значения `expected`.
 *
 * @param field — поле освещения
 * @param row — последняя проверяемая строка сетки
 * @param expected — значение, с которым сравниваются узлы
 * @returns наибольшее отклонение
 */
const measureTopRowsDeviation = (
  field: LightingField,
  row: number,
  expected: number
): number => {
  const { gridWidth, values } = field;

  let deviation = 0;

  for (let index = 0; index < (row + 1) * gridWidth; index += 1) {
    deviation = Math.max(deviation, Math.abs((values[index] || 0) - expected));
  }

  return deviation;
};

describe('extractLighting с контуром: полоса стола у края', () => {
  it('узлы над краем листа держатся яркости бумаги, поле непригодно', () => {
    const image = createSyntheticSheet(BAND_SHEET);
    const field = extractLighting(image, { outline: BAND_OUTLINE });
    const middle = meanOfRow(field, Math.floor(field.gridHeight / 2));

    expect(field.isUsable).toBe(false);
    expect(measureTopRowsDeviation(field, FIRST_PAPER_ROW, middle)).toBeLessThanOrEqual(
      EDGE_TOLERANCE
    );
  });

  it('без контура стол утягивает узлы у края и делает поле пригодным', () => {
    const image = createSyntheticSheet(BAND_SHEET);
    const field = extractLighting(image);
    const middle = meanOfRow(field, Math.floor(field.gridHeight / 2));

    expect(field.isUsable).toBe(true);
    expect(measureTopRowsDeviation(field, FIRST_PAPER_ROW, middle)).toBeGreaterThan(
      EDGE_TOLERANCE
    );
  });
});

const LIT_WIDTH = 900;

const LIT_HEIGHT = 1200;

/**
 * Контур листа на столе: стороны чуть наклонены, лист занимает большую часть
 * кадра.
 */
const LIT_OUTLINE: SheetOutline = {
  topLeft: { x: 80, y: 110 },
  topRight: { x: 820, y: 95 },
  bottomRight: { x: 830, y: 1100 },
  bottomLeft: { x: 90, y: 1115 },
};

/**
 * Лист с боковым светом на тёмном столе: свет садится по диагонали кадра, и
 * поле обязано повторить именно его, а не ступень на краю листа.
 */
const LIT_SHEET: SyntheticSheetParams = {
  width: LIT_WIDTH,
  height: LIT_HEIGHT,
  step: 58,
  phase: 13,
  angle: 0.5,
  kind: 'lined',
  margins: { top: 260, right: 140, bottom: 200, left: 170 },
  lineWidth: 3,
  noise: 0.05,
  lighting: 0.3,
  seed: 9,
  surface: { outline: LIT_OUTLINE, cornerRadius: 24, brightness: 0.3 },
};

/**
 * Вырезка фотографии по вписанному в контур прямоугольнику — та самая
 * фотография, «обрезанная по краям листа», с которой сверяются поле и текстура.
 *
 * @param image — фотография кадра
 * @param bounds — отступы вписанного прямоугольника от краёв кадра
 * @returns вырезка
 */
const cropSheetImage = (image: SheetImageData, bounds: PaperMargins): SheetImageData => {
  const left = Math.round(bounds.left);
  const top = Math.round(bounds.top);
  const width = image.width - left - Math.round(bounds.right);
  const height = image.height - top - Math.round(bounds.bottom);
  const luminance = new Float32Array(width * height);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      luminance[y * width + x] =
        image.luminance[(y + top) * image.width + (x + left)] || 0;
    }
  }

  return { width, height, luminance };
};

/**
 * Билинейная выборка поля освещения в точке изображения: узлы сетки лежат в
 * центрах клеток, за крайними узлами поле продолжается константой.
 *
 * @param field — поле освещения
 * @param width — ширина изображения, по которому снято поле
 * @param height — высота изображения, по которому снято поле
 * @param x — столбец изображения
 * @param y — строка изображения
 * @returns яркость поля
 */
const sampleField = (
  field: LightingField,
  width: number,
  height: number,
  x: number,
  y: number
): number => {
  const { gridWidth, gridHeight, values } = field;
  const gridX = ((x + 0.5) * gridWidth) / width - 0.5;
  const gridY = ((y + 0.5) * gridHeight) / height - 0.5;
  const baseX = Math.floor(gridX);
  const baseY = Math.floor(gridY);
  const fractionX = Math.min(1, Math.max(0, gridX - baseX));
  const fractionY = Math.min(1, Math.max(0, gridY - baseY));
  const leftColumn = Math.min(gridWidth - 1, Math.max(0, baseX));
  const rightColumn = Math.min(gridWidth - 1, Math.max(0, baseX + 1));
  const topRow = Math.min(gridHeight - 1, Math.max(0, baseY));
  const bottomRow = Math.min(gridHeight - 1, Math.max(0, baseY + 1));
  const topLeft = values[topRow * gridWidth + leftColumn] || 0;
  const topRight = values[topRow * gridWidth + rightColumn] || 0;
  const bottomLeft = values[bottomRow * gridWidth + leftColumn] || 0;
  const bottomRight = values[bottomRow * gridWidth + rightColumn] || 0;
  const top = topLeft + (topRight - topLeft) * fractionX;
  const bottom = bottomLeft + (bottomRight - bottomLeft) * fractionX;

  return top + (bottom - top) * fractionY;
};

/**
 * Наибольшее расхождение поля кадра с полем вырезки и размаха с размахом
 * вырезки.
 */
const FIELD_TOLERANCE = 0.02;

/**
 * Наибольшее расхождение размаха текстуры с размахом вырезки, доля.
 */
const AMPLITUDE_TOLERANCE_SHARE = 0.05;

describe('extractLighting и extractTexture с контуром: лист на столе', () => {
  it('поле внутри контура и его размах совпадают с полем вырезки', () => {
    const image = createSyntheticSheet(LIT_SHEET);
    const bounds = resolveSheetBounds(LIT_OUTLINE, LIT_WIDTH, LIT_HEIGHT);
    const crop = cropSheetImage(image, bounds);
    const field = extractLighting(image, { outline: LIT_OUTLINE });
    const cropField = extractLighting(crop);

    let deviation = 0;

    for (let row = 0; row < field.gridHeight; row += 1) {
      for (let column = 0; column < field.gridWidth; column += 1) {
        const x = ((column + 0.5) * LIT_WIDTH) / field.gridWidth;
        const y = ((row + 0.5) * LIT_HEIGHT) / field.gridHeight;
        const isInsideCrop =
          x >= bounds.left &&
          x <= LIT_WIDTH - bounds.right &&
          y >= bounds.top &&
          y <= LIT_HEIGHT - bounds.bottom;

        if (isInsideCrop) {
          deviation = Math.max(
            deviation,
            Math.abs(
              (field.values[row * field.gridWidth + column] || 0) -
                sampleField(
                  cropField,
                  crop.width,
                  crop.height,
                  x - Math.round(bounds.left),
                  y - Math.round(bounds.top)
                )
            )
          );
        }
      }
    }

    expect(deviation).toBeLessThanOrEqual(FIELD_TOLERANCE);
    expect(Math.abs(field.contrast - cropField.contrast)).toBeLessThanOrEqual(
      FIELD_TOLERANCE
    );
  });

  it('размах текстуры совпадает с размахом вырезки', () => {
    const image = createSyntheticSheet(LIT_SHEET);
    const bounds = resolveSheetBounds(LIT_OUTLINE, LIT_WIDTH, LIT_HEIGHT);
    const crop = cropSheetImage(image, bounds);
    const field = extractLighting(image, { outline: LIT_OUTLINE });
    const cropField = extractLighting(crop);
    const texture = extractTexture(image, field, {
      outline: LIT_OUTLINE,
      downscale: 2,
    });
    const cropTexture = extractTexture(crop, cropField, { downscale: 2 });

    expect(
      Math.abs(texture.amplitude - cropTexture.amplitude) / cropTexture.amplitude
    ).toBeLessThanOrEqual(AMPLITUDE_TOLERANCE_SHARE);
  });
});
