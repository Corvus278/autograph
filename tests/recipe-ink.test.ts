import type { RunRecipe } from '@pages/Generator/lib/recipe';
import { buildRunRecipe, INK_PALETTE } from '@pages/Generator/lib/recipe';
import { describe, expect, it } from 'vitest';

import { ALL_DISTORTION_FLAGS } from './helpers/distortion-flags';
import { buildFamily } from './helpers/paper-family';

const FAMILY = buildFamily(3);
const HEX_RADIX = 16;

/**
 * Допустимое отклонение от оттенка палитры — литералом, а не константой
 * модуля: тест сторожит именно правдоподобность цвета, поэтому расширение
 * разброса в коде обязано его уронить, а не подстроиться под него.
 */
const ALLOWED_JITTER = 10;

const toChannels = (color: string): number[] => {
  return [1, 3, 5].map((offset) => {
    return Number.parseInt(color.slice(offset, offset + 2), HEX_RADIX);
  });
};

/**
 * Цвет считается правдоподобным, если хотя бы один оттенок палитры отличается
 * от него не более чем на допустимое отклонение по каждому каналу.
 */
const isPaletteColor = (color: string): boolean => {
  const channels = toChannels(color);

  return INK_PALETTE.some((tone) => {
    return toChannels(tone.color).every((toneChannel, index) => {
      return Math.abs(toneChannel - (channels[index] || 0)) <= ALLOWED_JITTER;
    });
  });
};

const isExactPaletteColor = (color: string): boolean => {
  return INK_PALETTE.some((tone) => {
    return tone.color === color;
  });
};

const buildRecipe = (seed: number, inkColor: string | null): RunRecipe => {
  return buildRunRecipe({
    seed,
    family: FAMILY,
    pageCount: 3,
    flags: ALL_DISTORTION_FLAGS,
    inkColor,
  });
};

describe('цвет чернил рецепта', () => {
  it('случайный цвет берётся из палитры с отклонением в пределах разброса', () => {
    for (let seed = 0; seed < 200; seed += 1) {
      const { inkColor } = buildRecipe(seed, null);

      expect(isPaletteColor(inkColor)).toBe(true);
    }
  });

  it('сдвигает оттенок: большая часть цветов не равна точному цвету палитры', () => {
    const colors: string[] = [];

    for (let seed = 0; seed < 200; seed += 1) {
      colors.push(buildRecipe(seed, null).inkColor);
    }

    expect(
      colors.filter((color) => {
        return !isExactPaletteColor(color);
      }).length
    ).toBeGreaterThan(colors.length / 2);
  });

  it('перебирает разные оттенки палитры, а не держится одного', () => {
    const colors = new Set<string>();

    for (let seed = 0; seed < 50; seed += 1) {
      colors.add(buildRecipe(seed, null).inkColor);
    }

    expect(colors.size).toBeGreaterThan(1);
  });

  it('вручную заданный цвет не меняет', () => {
    const inkColor = '#7a1f1f';

    expect(buildRecipe(1, inkColor).inkColor).toBe(inkColor);
    expect(buildRecipe(999, inkColor).inkColor).toBe(inkColor);
  });

  it('приводит вручную заданный цвет к нижнему регистру', () => {
    expect(buildRecipe(1, '#7A1F1F').inkColor).toBe('#7a1f1f');
  });

  it('на пустой строке и невалидном цвете берёт оттенок палитры', () => {
    const palette = buildRecipe(1, null).inkColor;

    expect(buildRecipe(1, '').inkColor).toBe(palette);
    expect(buildRecipe(1, '#ABC').inkColor).toBe(palette);
    expect(buildRecipe(1, 'синий').inkColor).toBe(palette);
  });

  it('ручной цвет не сдвигает остальные слои рецепта', () => {
    const withPalette = buildRecipe(42, null);
    const withManual = buildRecipe(42, '#7a1f1f');

    expect(withManual.pages).toEqual(withPalette.pages);
    expect(withManual.handwriting).toEqual(withPalette.handwriting);
  });
});
