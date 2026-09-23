import type { SheetImageData, SheetOutline } from '@pages/Generator/lib/paper';
import { measureSheetPhoto } from '@pages/Generator/lib/paper';
import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import {
  isColourVetoEnabled,
  measureRedGreenP99,
} from '@pages/Generator/lib/paper/marginLineRedness';
import { describe, expect, it } from 'vitest';

import type {
  SyntheticCalibrationSheet,
  SyntheticMarginLineSheet,
} from './helpers/synthetic-sheet';
import {
  COLOUR_DEEP_COLUMN_SHEET,
  COLOUR_DRIFTING_MARGIN_LINE_SHEET,
  COLOUR_LINE_AND_DEEP_COLUMN_SHEET,
  COLOUR_SHADOW_SHEET,
  COLOUR_SPIRAL_MARGIN_LINE_SHEET,
  COLOUR_SPIRAL_SHEET,
  COLOUR_STRAIGHT_MARGIN_LINE_SHEET,
  computeSyntheticMarginLineX,
  createSyntheticSheet,
  GRAY_COLOUR,
  PALE_COLOUR_MARGIN_LINE_SHEET,
} from './helpers/synthetic-sheet';

/**
 * Наибольшее расстояние линии от самого внутреннего положения черты, в шагах.
 */
const INNERMOST_TOLERANCE_STEPS = 0.2;

/**
 * Тот же растр без канала `R − G` — яркостный путь.
 *
 * @param image — растр с каналом
 * @returns растр только с яркостью
 */
const toLuminanceOnly = ({
  width,
  height,
  luminance,
}: SheetImageData): SheetImageData => {
  return { width, height, luminance };
};

/**
 * Самое внутреннее положение черты у левой стороны: снос линейный, поэтому оно
 * на одном из концов области с линиями.
 *
 * @param sheet — лист с чертой слева
 * @returns столбец самого внутреннего положения
 */
const findLeftInnermostX = (sheet: SyntheticMarginLineSheet): number => {
  const { height, margins } = sheet;

  return Math.max(
    computeSyntheticMarginLineX(sheet, margins.top) || 0,
    computeSyntheticMarginLineX(sheet, height - margins.bottom) || 0
  );
};

describe('вето по цвету: нейтральная вертикаль у одной стороны, красная черта у другой', () => {
  it.each([
    ['глубокая вертикаль клетки', COLOUR_LINE_AND_DEEP_COLUMN_SHEET],
    ['спираль на линейке', COLOUR_SPIRAL_MARGIN_LINE_SHEET],
  ])('%s: линия у красной черты, а не у вертикали', (_name, sheet) => {
    const image = createSyntheticSheet(sheet);
    const coloured = detectRuling(image);
    const luminanceOnly = detectRuling(toLuminanceOnly(image));

    expect(luminanceOnly.marginLineSide).toBe('right');
    expect(coloured.marginLineSide).toBe('left');
    expect(
      Math.abs((coloured.marginLineX || 0) - findLeftInnermostX(sheet)) / sheet.step
    ).toBeLessThanOrEqual(INNERMOST_TOLERANCE_STEPS);
  });

  it('заданная сторона: у стороны вертикали линии нет, у стороны черты — черта', () => {
    const sheet = COLOUR_LINE_AND_DEEP_COLUMN_SHEET;
    const image = createSyntheticSheet(sheet);
    const right = detectRuling(image, { marginLineSide: 'right' });
    const left = detectRuling(image, { marginLineSide: 'left' });

    expect(
      detectRuling(toLuminanceOnly(image), { marginLineSide: 'right' }).marginLineX
    ).not.toBeNull();
    expect(right.marginLineX).toBeNull();
    expect(left.marginLineSide).toBe('left');
    expect(
      Math.abs((left.marginLineX || 0) - findLeftInnermostX(sheet)) / sheet.step
    ).toBeLessThanOrEqual(INNERMOST_TOLERANCE_STEPS);
  });

  it('измерение фотографии доносит канал до детектора', () => {
    const image = createSyntheticSheet(COLOUR_LINE_AND_DEEP_COLUMN_SHEET);

    const measure = (photo: SheetImageData) => {
      return measureSheetPhoto(photo, { kind: 'grid', outline: null }).source;
    };

    expect(measure(toLuminanceOnly(image)).marginLineSide).toBe('right');
    expect(measure(image).marginLineSide).toBe('left');
  });
});

describe('вето по цвету: только нейтральная вертикаль глубже барьера', () => {
  it.each([
    ['глубокая вертикаль на фазе (цветной DEEP_COLUMN_SHEET)', COLOUR_DEEP_COLUMN_SHEET],
    ['спираль на линейке', COLOUR_SPIRAL_SHEET],
    ['тень', COLOUR_SHADOW_SHEET],
  ])('%s: линии нет', (_name, sheet: SyntheticCalibrationSheet) => {
    const image = createSyntheticSheet(sheet);

    expect(detectRuling(toLuminanceOnly(image)).marginLineX).not.toBeNull();
    expect(detectRuling(image).marginLineX).toBeNull();
  });
});

describe('вето по цвету: красная черта проходит', () => {
  it.each([
    ['прямая черта — первая ступень', COLOUR_STRAIGHT_MARGIN_LINE_SHEET, 'profile'],
    ['черта со сносом — вторая ступень', COLOUR_DRIFTING_MARGIN_LINE_SHEET, 'banded'],
    ['бледная черта со сносом', PALE_COLOUR_MARGIN_LINE_SHEET, 'banded'],
  ])('%s: x и сторона те же, что без канала, до бита', (_name, sheet, stage) => {
    const image = createSyntheticSheet(sheet);
    const coloured = detectRuling(image);
    const luminanceOnly = detectRuling(toLuminanceOnly(image));

    expect(coloured.marginLineReport.stage).toBe(stage);
    expect(coloured.marginLineX).not.toBeNull();
    expect(coloured.marginLineX).toBe(luminanceOnly.marginLineX);
    expect(coloured.marginLineSide).toBe(luminanceOnly.marginLineSide);
  });
});

describe('вето по цвету: серый снимок и снимок без канала', () => {
  it.each([
    ['черта со сносом', { ...COLOUR_DRIFTING_MARGIN_LINE_SHEET, colour: GRAY_COLOUR }],
    ['глубокая вертикаль на фазе', { ...COLOUR_DEEP_COLUMN_SHEET, colour: GRAY_COLOUR }],
  ])('%s: результат равен яркостному пути', (_name, sheet) => {
    const image = createSyntheticSheet(sheet);

    expect(isColourVetoEnabled(measureRedGreenP99(image))).toBe(false);
    expect(detectRuling(image)).toStrictEqual(detectRuling(toLuminanceOnly(image)));
  });

  it('без канала результат не зависит от цвета, который мог бы быть', () => {
    const plain = createSyntheticSheet({ ...COLOUR_DEEP_COLUMN_SHEET, colour: null });

    expect('redMinusGreen' in plain).toBe(false);
    expect(detectRuling(plain)).toStrictEqual(
      detectRuling(toLuminanceOnly(createSyntheticSheet(COLOUR_DEEP_COLUMN_SHEET)))
    );
  });
});

/**
 * Ширина стола вокруг листа в пикселях: полоса такой ширины занимает больше
 * сотой доли кадра, и 99-й процентиль кадра берёт цвет стола.
 */
const TABLE_BORDER = 60;

/**
 * Яркость стола: темнее бумаги, контур листа всё равно задан явно.
 */
const TABLE_LUMINANCE = 0.3;

/**
 * Кадр с листом на столе.
 */
type TablePhoto = {
  /**
   * Кадр целиком.
   */
  photo: SheetImageData;

  /**
   * Границы листа в кадре.
   */
  outline: SheetOutline;
};

/**
 * Кладёт лист на стол: вокруг — полоса стола с заданным `R − G`, контур —
 * границы листа.
 *
 * @param sheet — растр листа с каналом
 * @param tableTint — `R − G` стола в уровнях
 * @returns кадр и контур листа в нём
 */
const placeOnTable = (sheet: SheetImageData, tableTint: number): TablePhoto => {
  const width = sheet.width + 2 * TABLE_BORDER;
  const height = sheet.height + 2 * TABLE_BORDER;
  const luminance = new Float32Array(width * height).fill(TABLE_LUMINANCE);
  const redMinusGreen = new Int16Array(width * height).fill(tableTint);

  for (let y = 0; y < sheet.height; y += 1) {
    const from = y * sheet.width;
    const to = (y + TABLE_BORDER) * width + TABLE_BORDER;

    luminance.set(sheet.luminance.subarray(from, from + sheet.width), to);
    redMinusGreen.set(
      (sheet.redMinusGreen || new Int16Array(0)).subarray(from, from + sheet.width),
      to
    );
  }

  const left = TABLE_BORDER;
  const top = TABLE_BORDER;
  const right = TABLE_BORDER + sheet.width;
  const bottom = TABLE_BORDER + sheet.height;

  return {
    photo: { width, height, luminance, redMinusGreen },
    outline: {
      topLeft: { x: left, y: top },
      topRight: { x: right, y: top },
      bottomRight: { x: right, y: bottom },
      bottomLeft: { x: left, y: bottom },
    },
  };
};

describe('гейт серого снимка решается по кадру, а не по вырезке', () => {
  /**
   * Серый лист с нейтральной вертикалью на фазе: по яркости она — линия поля,
   * по цвету — нет, поэтому исход решает только гейт.
   */
  const sheet = createSyntheticSheet({
    ...COLOUR_DEEP_COLUMN_SHEET,
    colour: GRAY_COLOUR,
  });

  const measure = (photo: SheetImageData, outline: SheetOutline) => {
    return measureSheetPhoto(photo, { kind: 'grid', outline }).source.marginLineX;
  };

  it('серая вырезка на цветном столе: вето по цвету включено', () => {
    const { photo, outline } = placeOnTable(sheet, 40);

    expect(isColourVetoEnabled(measureRedGreenP99(sheet))).toBe(false);
    expect(isColourVetoEnabled(measureRedGreenP99(photo))).toBe(true);
    expect(measure(toLuminanceOnly(photo), outline)).not.toBeNull();
    expect(measure(photo, outline)).toBeNull();
  });

  it('серая вырезка на сером столе: яркостный путь', () => {
    const { photo, outline } = placeOnTable(sheet, 0);

    expect(isColourVetoEnabled(measureRedGreenP99(photo))).toBe(false);
    expect(measure(photo, outline)).toBe(measure(toLuminanceOnly(photo), outline));
    expect(measure(photo, outline)).not.toBeNull();
  });
});
