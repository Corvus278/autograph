import type { SheetImageData } from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

import type {
  HeldOutSheetParams,
  SyntheticCalibrationSheet,
  SyntheticMarginLineSheet,
  SyntheticSheetParams,
} from './helpers/synthetic-sheet';
import {
  BLOTTED_MARGIN_LINE_SHEET,
  COLOUR_DEEP_COLUMN_SHEET,
  COLOUR_DRIFTING_MARGIN_LINE_SHEET,
  COLOUR_SHADOW_SHEET,
  COLOUR_SPIRAL_SHEET,
  COLOUR_STRAIGHT_MARGIN_LINE_SHEET,
  CONVERGING_GRID_SHEET,
  createHeldOutSheet,
  createSyntheticSheet,
  DEEP_COLUMN_SHEET,
  DRIFTING_MARGIN_LINE_SHEET,
  NEUTRAL_COLOUR,
  PALE_RED_MARGIN_LINE_COLOUR,
  RED_MARGIN_LINE_COLOUR,
} from './helpers/synthetic-sheet';

/**
 * FNV-1a по байтам растра яркости: растр листа до бита сводится к одному
 * числу, которое записывается эталоном.
 *
 * @param image — растр
 * @returns хэш
 */
const hashLuminance = (image: SheetImageData): number => {
  const bytes = new Uint8Array(
    image.luminance.buffer,
    image.luminance.byteOffset,
    image.luminance.byteLength
  );

  return bytes.reduce((hash, byte) => {
    return Math.imul(hash ^ byte, 16_777_619) >>> 0;
  }, 2_166_136_261);
};

/**
 * Листы, растр которых без полей цвета обязан остаться прежним: калибровка,
 * схождение, пятно, спираль с поверхностью и удержанная выборка.
 */
const LEGACY_SHEETS: Record<string, SyntheticSheetParams> = {
  default: {},
  drifting: DRIFTING_MARGIN_LINE_SHEET,
  deepColumn: DEEP_COLUMN_SHEET,
  converging: CONVERGING_GRID_SHEET,
  blotted: BLOTTED_MARGIN_LINE_SHEET,
  spiralSurface: {
    width: 320,
    height: 420,
    step: 22,
    angle: 0.5,
    noise: 0.02,
    seed: 11,
    spiral: { x: 12, period: 31, radius: 4 },
    surface: {
      outline: {
        topLeft: { x: 8, y: 10 },
        topRight: { x: 312, y: 6 },
        bottomRight: { x: 316, y: 412 },
        bottomLeft: { x: 4, y: 416 },
      },
      cornerRadius: 6,
      brightness: 0.28,
      grain: 0.05,
    },
  },
  heldOut: createHeldOutSheet({
    marginLineSide: 'left',
    marginLineDrift: 1.2,
    convergence: 0.2,
    vanishingShare: 0.62,
    falseColumn: { side: 'right', ratio: 1.8, offset: 0.4, isOnPhase: false },
    widthLighting: 0.3,
    blot: { top: 0.3, bottom: 0.45 },
    seed: 7,
  }).params,
};

/**
 * Хэши растров `LEGACY_SHEETS`, снятые генератором до появления цвета и тени.
 */
const LEGACY_HASHES: Record<string, number> = {
  default: 3_275_944_061,
  drifting: 2_291_538_484,
  deepColumn: 2_770_634_259,
  converging: 1_835_098_402,
  blotted: 4_122_558_223,
  spiralSurface: 2_898_273_027,
  heldOut: 193_020_303,
};

/**
 * Параметры удержанного листа без цвета.
 */
const HELD_OUT_PARAMS: HeldOutSheetParams = {
  marginLineSide: 'right',
  marginLineDrift: 0.8,
  convergence: 0,
  vanishingShare: 0.5,
  falseColumn: { side: 'left', ratio: 2, offset: 1, isOnPhase: false },
  widthLighting: 0,
  blot: null,
  seed: 5,
};

/**
 * Средний по строкам области с линиями избыток `R − G` в столбце `x` над
 * бумагой в `offset` пикселей по обе стороны от него.
 *
 * @param image — растр с каналом
 * @param sheet — описание листа
 * @param x — столбец
 * @param offset — отступ до бумаги
 * @returns избыток в уровнях
 */
const measureColumnExcess = (
  image: SheetImageData,
  sheet: SyntheticCalibrationSheet,
  x: number,
  offset: number
): number => {
  const { redMinusGreen, width } = image;

  if (!redMinusGreen) {
    throw new Error('Канала R − G нет');
  }

  const rows = Array.from(
    { length: sheet.height - sheet.margins.top - sheet.margins.bottom },
    (_item, index) => {
      return sheet.margins.top + index;
    }
  );
  const total = rows.reduce((sum, y) => {
    const at = (column: number): number => {
      return redMinusGreen[y * width + column] || 0;
    };

    return sum + at(x) - (at(x - offset) + at(x + offset)) / 2;
  }, 0);

  return total / rows.length;
};

describe('синтетика с цветом', () => {
  it('без полей цвета растр прежний до бита и канала нет', () => {
    const hashes = Object.fromEntries(
      Object.entries(LEGACY_SHEETS).map(([name, params]) => {
        const image = createSyntheticSheet(params);

        expect('redMinusGreen' in image).toBe(false);

        return [name, hashLuminance(image)];
      })
    );

    expect(hashes).toStrictEqual(LEGACY_HASHES);
  });

  it('цвет не трогает яркость: растр тот же, что у листа без цвета', () => {
    const coloured = createSyntheticSheet(COLOUR_DRIFTING_MARGIN_LINE_SHEET);
    const heldOut = createHeldOutSheet({
      ...HELD_OUT_PARAMS,
      colour: { ...NEUTRAL_COLOUR, falseColumnExcess: 25 },
    });

    expect(hashLuminance(coloured)).toBe(LEGACY_HASHES.drifting);
    expect(coloured.redMinusGreen).toHaveLength(coloured.luminance.length);
    expect(hashLuminance(heldOut.image)).toBe(
      hashLuminance(createHeldOutSheet(HELD_OUT_PARAMS).image)
    );
  });

  it.each([
    ['красная', RED_MARGIN_LINE_COLOUR],
    ['бледная красная', PALE_RED_MARGIN_LINE_COLOUR],
  ])(
    '%s черта: избыток над бумагой рядом равен заданному с точностью 5 %%',
    (_name, colour) => {
      const sheet: SyntheticMarginLineSheet = {
        ...COLOUR_STRAIGHT_MARGIN_LINE_SHEET,
        colour,
      };
      const excess = measureColumnExcess(
        createSyntheticSheet(sheet),
        sheet,
        sheet.marginLineX,
        sheet.step / 2
      );

      expect(Math.abs(excess - colour.marginLineExcess)).toBeLessThanOrEqual(
        0.05 * colour.marginLineExcess
      );
    }
  );

  it('нейтральная вертикаль, спираль и тень по цвету не видны', () => {
    const deep = createSyntheticSheet(COLOUR_DEEP_COLUMN_SHEET);
    const deepX = COLOUR_DEEP_COLUMN_SHEET.deepColumn.x;
    const spiral = createSyntheticSheet(COLOUR_SPIRAL_SHEET);
    const shadow = createSyntheticSheet(COLOUR_SHADOW_SHEET);

    expect(
      Math.abs(measureColumnExcess(deep, COLOUR_DEEP_COLUMN_SHEET, deepX, 10))
    ).toBeLessThan(1);
    expect(
      Math.abs(measureColumnExcess(spiral, COLOUR_SPIRAL_SHEET, 545, 10))
    ).toBeLessThan(1);
    expect(
      Math.abs(measureColumnExcess(shadow, COLOUR_SHADOW_SHEET, 520, 10))
    ).toBeLessThan(1);
  });

  it('удержанный лист: цвет вставной вертикали задан, класс по построению тот же', () => {
    const plain = createHeldOutSheet(HELD_OUT_PARAMS);
    const red = createHeldOutSheet({
      ...HELD_OUT_PARAMS,
      colour: { ...RED_MARGIN_LINE_COLOUR, falseColumnExcess: 25 },
    });
    const neutral = createHeldOutSheet({
      ...HELD_OUT_PARAMS,
      colour: { ...RED_MARGIN_LINE_COLOUR, falseColumnExcess: 0 },
    });
    const falseX = Math.round(red.falseColumnX || 0);

    expect(red.hasMarginLine).toBe(plain.hasMarginLine);
    expect(red.marginLineSide).toBe(plain.marginLineSide);
    expect(red.innermostX).toBe(plain.innermostX);
    expect(measureColumnExcess(red.image, red.params, falseX, 10)).toBeGreaterThan(20);
    expect(
      Math.abs(measureColumnExcess(neutral.image, neutral.params, falseX, 10))
    ).toBeLessThan(1);
  });
});
