import type { LightingField, TextureMap } from '@pages/Generator/lib/paper';
import {
  extractLighting,
  extractTexture,
  synthesizeLighting,
} from '@pages/Generator/lib/paper';
import { toTexturePixels } from '@pages/Generator/lib/paper/encodeTextureMap';
import { LIGHTING_USABLE_CONTRAST } from '@pages/Generator/lib/paper/extractLighting';
import { describe, expect, it } from 'vitest';

import { createSyntheticSheet } from './helpers/synthetic-lighting';

const WIDTH = 240;
const HEIGHT = 320;

/**
 * Средняя яркость поля по вертикальной полосе столбцов `[from, to)`.
 */
const meanOfColumns = (field: LightingField, from: number, to: number): number => {
  const { gridWidth, gridHeight, values } = field;

  let sum = 0;

  for (let row = 0; row < gridHeight; row += 1) {
    for (let column = from; column < to; column += 1) {
      sum += values[row * gridWidth + column] || 0;
    }
  }

  return sum / (gridHeight * (to - from));
};

/**
 * Среднее отклонение по карте текстуры: у подогнанного поля освещения оно
 * нулевое, а постоянная составляющая означала бы промах подгонки.
 */
const meanOfMap = (map: TextureMap): number => {
  let sum = 0;

  for (let index = 0; index < map.values.length; index += 1) {
    sum += map.values[index] || 0;
  }

  return map.values.length > 0 ? sum / map.values.length : 0;
};

describe('extractLighting', () => {
  it('неравномерно освещённый лист даёт пригодное поле', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.7,
      gradient: 0.3,
      grain: 0.02,
    });

    const field = extractLighting(sheet);

    expect(field.isUsable).toBe(true);
    expect(field.contrast).toBeGreaterThan(0.2);
  });

  it('поле повторяет градиент: тёмная половина листа темнее светлой', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.7,
      gradient: 0.3,
    });

    const field = extractLighting(sheet);
    const half = Math.floor(field.gridWidth / 2);
    const dark = meanOfColumns(field, 0, half);
    const bright = meanOfColumns(field, half, field.gridWidth);

    expect(dark).toBeLessThan(bright);
    expect(Math.max(...field.values)).toBeCloseTo(1, 10);
  });

  it('равномерно освещённый образец с зерном непригоден', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.78,
      grain: 0.02,
    });

    const field = extractLighting(sheet);

    expect(field.isUsable).toBe(false);
    expect(field.contrast).toBeLessThan(LIGHTING_USABLE_CONTRAST);
  });

  it('одно тёмное пятно на плоском скане не делает поле пригодным', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.78,
      grain: 0.02,
      spot: { left: 100, top: 140, size: 18, depth: 0.4 },
    });

    const field = extractLighting(sheet);

    expect(field.isUsable).toBe(false);
    expect(field.contrast).toBeLessThan(LIGHTING_USABLE_CONTRAST);
  });

  it('на вырожденном изображении не ломается', () => {
    const field = extractLighting({
      width: 0,
      height: 0,
      luminance: new Float32Array(0),
    });

    expect(field.isUsable).toBe(false);
    expect(field.values).toEqual([]);
  });

  it('на изображении в один пиксель даёт сетку из одного узла', () => {
    const field = extractLighting(createSyntheticSheet({ width: 1, height: 1 }));

    expect(field.gridWidth).toBe(1);
    expect(field.gridHeight).toBe(1);
    expect(field.isUsable).toBe(false);
  });

  it('полностью чёрное изображение непригодно и не даёт NaN', () => {
    const field = extractLighting({
      width: WIDTH,
      height: HEIGHT,
      luminance: new Float32Array(WIDTH * HEIGHT),
    });

    expect(field.isUsable).toBe(false);
    expect(field.contrast).toBe(0);
    expect(field.values.every(Number.isFinite)).toBe(true);
  });
});

describe('extractTexture', () => {
  it('зерно бумаги даёт ненулевой размах отклонений', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.7,
      gradient: 0.3,
      grain: 0.04,
      seed: 7,
    });

    const texture = extractTexture(sheet, extractLighting(sheet));

    expect(texture.amplitude).toBeGreaterThan(0.03);
    expect(texture.amplitude).toBeLessThan(0.04);
  });

  it('градиент без зерна поле объясняет целиком: размах и сдвиг около нуля', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.7,
      gradient: 0.3,
    });

    const texture = extractTexture(sheet, extractLighting(sheet));

    expect(texture.amplitude).toBeLessThan(0.001);
    expect(Math.abs(meanOfMap(texture))).toBeLessThan(0.001);
  });

  it('размер карты равен размеру фотографии, делённому на прореживание', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.7,
      gradient: 0.3,
      grain: 0.04,
    });

    const texture = extractTexture(sheet, extractLighting(sheet), { downscale: 4 });

    expect(texture.width).toBe(WIDTH / 4);
    expect(texture.height).toBe(HEIGHT / 4);
    expect(texture.values.length).toBe((WIDTH / 4) * (HEIGHT / 4));
  });

  it('прореживание крупнее листа ужимает карту до одной точки, а не до пустой', () => {
    const sheet = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      level: 0.7,
      gradient: 0.3,
    });

    const texture = extractTexture(sheet, extractLighting(sheet), { downscale: 1000 });

    expect(texture.width).toBe(1);
    expect(texture.height).toBe(1);
    expect(texture.values.length).toBe(1);
  });

  it('на чёрном листе и на листе в один пиксель не ломается', () => {
    const black = {
      width: WIDTH,
      height: HEIGHT,
      luminance: new Float32Array(WIDTH * HEIGHT),
    };
    const tiny = createSyntheticSheet({ width: 1, height: 1 });

    const blackTexture = extractTexture(black, extractLighting(black));
    const tinyTexture = extractTexture(tiny, extractLighting(tiny));

    expect(blackTexture.amplitude).toBe(0);
    expect(blackTexture.width).toBe(WIDTH);
    expect(tinyTexture.width).toBe(1);
    expect(tinyTexture.height).toBe(1);
    expect(tinyTexture.amplitude).toBe(0);
  });

  it('на пустой фотографии отдаёт карту нулевого размера', () => {
    const empty = { width: 0, height: 0, luminance: new Float32Array(0) };

    const texture = extractTexture(empty, extractLighting(empty));

    expect(texture.width).toBe(0);
    expect(texture.height).toBe(0);
  });
});

describe('toTexturePixels', () => {
  it('нулевое отклонение — середина шкалы, размах — её края, крупнее — срез', () => {
    const map: TextureMap = {
      width: 4,
      height: 1,
      values: Float32Array.from([0, 0.04, -0.04, 0.08]),
      amplitude: 0.04,
    };

    const pixels = toTexturePixels(map);

    expect([pixels[0], pixels[4], pixels[8], pixels[12]]).toEqual([128, 255, 0, 255]);
  });

  it('пишет отклонение во все три канала и оставляет пиксель непрозрачным', () => {
    const map: TextureMap = {
      width: 1,
      height: 1,
      values: Float32Array.from([0.02]),
      amplitude: 0.04,
    };

    const pixels = toTexturePixels(map);

    expect(pixels[0]).toBe(pixels[1]);
    expect(pixels[1]).toBe(pixels[2]);
    expect(pixels[3]).toBe(255);
  });

  it('на нулевом размахе вся карта — середина шкалы', () => {
    const map: TextureMap = {
      width: 2,
      height: 1,
      values: Float32Array.from([0, 0.5]),
      amplitude: 0,
    };

    const pixels = toTexturePixels(map);

    expect([pixels[0], pixels[4]]).toEqual([128, 128]);
  });
});

describe('synthesizeLighting', () => {
  it('на одном seed даёт одно и то же поле', () => {
    const first = synthesizeLighting(WIDTH, HEIGHT, 42);
    const second = synthesizeLighting(WIDTH, HEIGHT, 42);

    expect(second.values).toEqual(first.values);
    expect(second.contrast).toBe(first.contrast);
  });

  it('на разных seed даёт разный свет', () => {
    const first = synthesizeLighting(WIDTH, HEIGHT, 42);
    const second = synthesizeLighting(WIDTH, HEIGHT, 43);

    expect(second.values).not.toEqual(first.values);
  });

  it('синтетическое поле пригодно и нормировано', () => {
    const field = synthesizeLighting(WIDTH, HEIGHT, 3);

    expect(field.isUsable).toBe(true);
    expect(field.contrast).toBeGreaterThan(LIGHTING_USABLE_CONTRAST);
    expect(Math.max(...field.values)).toBeCloseTo(1, 10);
    expect(Math.min(...field.values)).toBeGreaterThan(0);
  });
});
