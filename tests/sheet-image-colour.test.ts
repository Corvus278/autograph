import type { SheetImageData, SheetOutline } from '@pages/Generator/lib/paper';
import { cropSheet } from '@pages/Generator/lib/paper/measureSheetPhoto';
import { rectifySheetImage } from '@pages/Generator/lib/paper/measureSheetPhotoRectify';
import { mulberry32 } from '@shared/lib/random';
import { describe, expect, it } from 'vitest';

/**
 * Размер синтетического кадра: вырезка и копия у него заметно меньше кадра, а
 * проход по пикселям в тесте остаётся мгновенным.
 */
const WIDTH = 120;
const HEIGHT = 90;

/**
 * Наибольший уровень 8-битного канала.
 */
const MAX_LEVEL = 255;

/**
 * Связь канала `R − G` с яркостью в каждом пикселе: линейная, чтобы выборка с
 * долями у выпрямленной копии её сохраняла с точностью до округления уровня.
 *
 * @param luminance — яркость пикселя от 0 до 1
 * @returns `R − G` в уровнях
 */
const toRedMinusGreen = (luminance: number): number => {
  return 2 * MAX_LEVEL * luminance - MAX_LEVEL;
};

/**
 * Кадр со случайной яркостью в каждом пикселе: пиксель, взятый не из того
 * столбца или строки, почти наверняка ломает связь с каналом на десятки уровней.
 *
 * @param withColour — заполнять ли канал `R − G`
 * @returns кадр
 */
const createFrame = (withColour: boolean): SheetImageData => {
  const random = mulberry32(7);
  const luminance = new Float32Array(WIDTH * HEIGHT);
  const redMinusGreen = new Int16Array(WIDTH * HEIGHT);

  for (let index = 0; index < luminance.length; index += 1) {
    const level = Math.floor(random() * (MAX_LEVEL + 1));

    luminance[index] = level / MAX_LEVEL;
    redMinusGreen[index] = 2 * level - MAX_LEVEL;
  }

  return withColour
    ? { width: WIDTH, height: HEIGHT, luminance, redMinusGreen }
    : { width: WIDTH, height: HEIGHT, luminance };
};

/**
 * Контур листа внутри кадра: вписанный прямоугольник меньше кадра со всех
 * сторон, поэтому вырезка — копия, а не сам кадр.
 */
const OUTLINE: SheetOutline = {
  topLeft: { x: 11, y: 7 },
  topRight: { x: 104, y: 7 },
  bottomRight: { x: 104, y: 81 },
  bottomLeft: { x: 11, y: 81 },
};

/**
 * Наклон и перспектива, при которых копия выбирается с дробными долями почти в
 * каждой точке.
 */
const PROJECTION = {
  skewAngle: 0.7,
  perspective: { originX: 40, originY: 30, convergenceX: 0.0009, convergenceY: 0.0013 },
};

/**
 * Наибольшее отклонение канала от связи с яркостью по всем пикселям.
 *
 * @param image — изображение с каналом
 * @returns отклонение в уровнях
 */
const measureColourDeviation = (image: SheetImageData): number => {
  const { luminance, redMinusGreen } = image;

  if (!redMinusGreen) {
    throw new Error('Канала R − G нет');
  }

  return luminance.reduce((worst, value, index) => {
    return Math.max(
      worst,
      Math.abs((redMinusGreen[index] || 0) - toRedMinusGreen(value))
    );
  }, 0);
};

describe('канал R − G в вырезке и выпрямленной копии', () => {
  it('вырезка переносит канал тем же прямоугольником, что и яркость', () => {
    const crop = cropSheet(createFrame(true), OUTLINE);

    expect(crop.image.width).toBeLessThan(WIDTH);
    expect(crop.image.height).toBeLessThan(HEIGHT);
    expect(crop.image.redMinusGreen).toHaveLength(crop.image.luminance.length);
    expect(measureColourDeviation(crop.image)).toBeLessThan(1e-3);
  });

  it('выпрямленная копия выбирает канал в тех же точках, округляя до уровня', () => {
    const crop = cropSheet(createFrame(true), OUTLINE);
    const rectified = rectifySheetImage(crop.image, PROJECTION);

    expect(rectified.image.height).toBeGreaterThan(0);
    expect(rectified.image.redMinusGreen).toHaveLength(rectified.image.luminance.length);
    expect(measureColourDeviation(rectified.image)).toBeLessThanOrEqual(0.5 + 1e-3);
  });

  it('копия нулевой высоты у снимка с каналом несёт пустой канал', () => {
    const rectified = rectifySheetImage(createFrame(true), {
      skewAngle: 0,
      perspective: null,
    });

    expect(rectified.image.redMinusGreen).toHaveLength(0);
  });

  it('без канала на входе его нет ни в вырезке, ни в копии', () => {
    const crop = cropSheet(createFrame(false), OUTLINE);
    const rectified = rectifySheetImage(crop.image, PROJECTION);
    const flat = rectifySheetImage(crop.image, { skewAngle: 0, perspective: null });

    expect('redMinusGreen' in crop.image).toBe(false);
    expect('redMinusGreen' in rectified.image).toBe(false);
    expect('redMinusGreen' in flat.image).toBe(false);
  });
});
