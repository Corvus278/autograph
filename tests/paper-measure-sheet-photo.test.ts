import {
  buildSheetRuling,
  detectRuling,
  extractLighting,
  extractTexture,
  lineCoordinateAt,
  lineHeightAt,
  measureSheetPhoto,
  type PaperMargins,
  resolveSheetBounds,
  type RulingBend,
  sampleRulingBend,
  type SheetImageData,
  type SheetOutline,
  type SheetPhotoMeasurement,
  type SheetRuling,
} from '@pages/Generator/lib/paper';
import type {
  DetectedRuling,
  RulingDetectionOptions,
} from '@pages/Generator/lib/paper/detectRuling';
import type * as RectifyModule from '@pages/Generator/lib/paper/measureSheetPhotoRectify';
import { rectifySheetImage } from '@pages/Generator/lib/paper/measureSheetPhotoRectify';
import { describe, expect, it, vi } from 'vitest';

import {
  computeSyntheticLineY,
  computeSyntheticOutline,
  createSyntheticSheet,
  type SyntheticField,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

vi.mock('@pages/Generator/lib/paper/measureSheetPhotoRectify', async (importOriginal) => {
  const actual = await importOriginal<typeof RectifyModule>();

  return { ...actual, rectifySheetImage: vi.fn(actual.rectifySheetImage) };
});

const WIDTH = 900;

const HEIGHT = 1200;

const FRAME = { width: WIDTH, height: HEIGHT };

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Лист на столе: стороны чуть наклонены к краям кадра, углы скруглены.
 */
const TABLE_OUTLINE: SheetOutline = {
  topLeft: { x: 130, y: 120 },
  topRight: { x: 790, y: 110 },
  bottomRight: { x: 800, y: 1110 },
  bottomLeft: { x: 140, y: 1120 },
};

/**
 * Стол темнее бумаги и с крупным зерном: по всему кадру его ступени и шум
 * забивают разлиновку, и детектор, которому достался кадр целиком, шага не
 * находит.
 */
const TABLE_SURFACE = {
  outline: TABLE_OUTLINE,
  cornerRadius: 20,
  brightness: 0.3,
  grain: 0.3,
};

const GRID_STEP = 30;

/**
 * Клетка внутри листа на столе, со всех сторон — поля.
 */
const GRID_SHEET: SyntheticSheetParams = {
  width: WIDTH,
  height: HEIGHT,
  step: GRID_STEP,
  phase: 7,
  angle: 1,
  kind: 'grid',
  margins: { top: 200, right: 160, bottom: 180, left: 170 },
  lineWidth: 2,
  lineDarkness: 0.3,
  noise: 0.04,
  lighting: 0.2,
  seed: 5,
  surface: TABLE_SURFACE,
};

/**
 * Середина кадра по ширине в долях от −1 до 1.
 *
 * @param x — столбец кадра
 * @returns доля
 */
const toWidthShare = (x: number): number => {
  return (2 * x) / WIDTH - 1;
};

/**
 * Прогиб по ширине: середина линии ниже концов на заданную долю шага.
 *
 * @param depth — глубина прогиба в пикселях
 * @returns поле сдвига линий
 */
const toSag = (depth: number): SyntheticField => {
  return (x) => {
    return depth * (1 - toWidthShare(x) ** 2);
  };
};

/**
 * Прогиб, меняющий знак по высоте листа: у верхних линий середина выше концов,
 * у нижних — ниже. Ширина прогиба — ширина области с линиями, иначе его почти
 * целиком забрала бы ровная гребёнка.
 */
const TWISTED_SAG: SyntheticField = (x, y) => {
  return 0.3 * GRID_STEP * (1 - ((x - 455) / 255) ** 2) * ((2 * y) / HEIGHT - 1);
};

/**
 * Изогнутая клетка на листе, верх которого далеко от верха кадра. Строки узлов
 * изгиба лежат по координате вдоль линий, и сетка, не сдвинутая вместе с
 * вырезкой, взяла бы смещения строк на десяток шагов выше — на таком прогибе
 * это больше двадцатой шага.
 */
const BENT_GRID_SHEET: SyntheticSheetParams = {
  ...GRID_SHEET,
  margins: { top: 440, right: 160, bottom: 180, left: 170 },
  surface: {
    ...TABLE_SURFACE,
    outline: {
      topLeft: { x: 130, y: 330 },
      topRight: { x: 790, y: 320 },
      bottomRight: { x: 800, y: 1110 },
      bottomLeft: { x: 140, y: 1120 },
    },
  },
  bend: TWISTED_SAG,
};

/**
 * Клетка доходит до левой стороны листа: левое поле не находится, и отступ с
 * этой стороны берётся фолбэком от стороны листа.
 */
const EDGE_GRID_SHEET: SyntheticSheetParams = {
  ...GRID_SHEET,
  margins: { top: 200, right: 160, bottom: 180, left: 0 },
};

/**
 * Та же клетка без поверхности: фотография обрезана по краям листа.
 */
const CROPPED_GRID_SHEET: SyntheticSheetParams = {
  ...GRID_SHEET,
  surface: null,
};

const BLANK_TABLE_SHEET: SyntheticSheetParams = {
  ...GRID_SHEET,
  kind: 'blank',
};

/**
 * Вырезка кадра со своим местом в нём.
 */
type TestCrop = {
  /**
   * Полутоновая выжимка вырезки.
   */
  image: SheetImageData;

  /**
   * Отступ вырезки от левого края кадра.
   */
  left: number;

  /**
   * Отступ вырезки от верхнего края кадра.
   */
  top: number;
};

/**
 * Вырезает прямоугольник, вписанный в контур, целыми пикселями внутрь.
 *
 * @param image — кадр
 * @param outline — контур листа
 * @returns вырезка
 */
const cutSheet = (image: SheetImageData, outline: SheetOutline | null): TestCrop => {
  const bounds = resolveSheetBounds(outline, image.width, image.height);
  const left = Math.ceil(bounds.left);
  const top = Math.ceil(bounds.top);
  const width = Math.floor(image.width - bounds.right) - left;
  const height = Math.floor(image.height - bounds.bottom) - top;
  const luminance = new Float32Array(width * height);

  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      luminance[row * width + column] =
        image.luminance[(top + row) * image.width + left + column] || 0;
    }
  }

  return { image: { width, height, luminance }, left, top };
};

/**
 * Поля ровного прохода по вырезке, переведённые в кадр: по высоте поля — это
 * координаты вдоль линий у левого края, и сдвигаются они на `T − L·tgθ`, по
 * ширине — на отступ вырезки. Ненайденная сторона остаётся нулём.
 *
 * @param detection — проход по вырезке
 * @param crop — вырезка
 * @returns поля в пикселях кадра
 */
const toFrameMargins = (detection: DetectedRuling, crop: TestCrop): PaperMargins => {
  const { margins, skewAngle } = detection;
  const shift = crop.top - crop.left * Math.tan(skewAngle / DEGREES_IN_RADIAN);
  const cropRight = WIDTH - crop.left - crop.image.width;
  const cropBottom = HEIGHT - crop.top - crop.image.height;

  return {
    top: margins.top && margins.top + shift,
    right: margins.right && margins.right + cropRight,
    bottom: margins.bottom && margins.bottom + cropBottom + crop.top - shift,
    left: margins.left && margins.left + crop.left,
  };
};

/**
 * Вырезка вместе с проходом детектора по ней.
 */
type CropDetection = {
  /**
   * Вырезка кадра.
   */
  crop: TestCrop;

  /**
   * Проход детектора по вырезке.
   */
  detection: DetectedRuling;
};

/**
 * Прогон детектора по вырезке кадра, заданной контуром.
 *
 * @param params — описание листа
 * @param outline — контур вырезки
 * @param options — настройки детектора
 * @returns вырезка и проход по ней
 */
const detectInCrop = (
  params: SyntheticSheetParams,
  outline: SheetOutline | null,
  options?: RulingDetectionOptions
): CropDetection => {
  const crop = cutSheet(createSyntheticSheet(params), outline);

  return { crop, detection: detectRuling(crop.image, options) };
};

/**
 * Координата вдоль линий найденной линии, ближайшей к эталонной линии `index`.
 *
 * @param ruling — разлиновка листа
 * @param params — описание листа
 * @param index — номер эталонной линии
 * @returns координата найденной линии
 */
const toNearestLine = (
  ruling: SheetRuling,
  params: SyntheticSheetParams,
  index: number
): number => {
  const { step = 0, phase = 0 } = params;
  const reference = phase + index * step;

  return (
    ruling.firstLinePhase +
    Math.round((reference - ruling.firstLinePhase) / ruling.step) * ruling.step
  );
};

/**
 * Способ найти координату вдоль линий найденной линии, отвечающей эталонной.
 */
type NearestLineResolver = (
  ruling: SheetRuling,
  params: SyntheticSheetParams,
  index: number
) => number;

/**
 * Высота линии разлиновки в столбце: прямая гребёнка с перспективой плюс изгиб.
 *
 * @param ruling — разлиновка листа
 * @param x — столбец кадра
 * @param coordinate — координата линии вдоль линий
 * @returns строка линии
 */
const restoreLineY = (ruling: SheetRuling, x: number, coordinate: number): number => {
  const straight = lineHeightAt(ruling, x, coordinate);
  const bend: RulingBend | null = ruling.bend;

  return straight + (bend ? sampleRulingBend(bend, ruling, x, straight) : 0);
};

/**
 * Ближайшая линия по высоте в столбце `column`, а не по координате вдоль
 * линий: у листа, сдвинутого от середины кадра, начало перспективы детектора
 * (середина вырезки) и синтетики (середина кадра) расходятся, и
 * `phase + k·step` синтетики указывает на соседнюю найденную линию.
 *
 * @param column — столбец сверки
 * @returns способ найти линию
 */
const toNearestLineInColumn = (column: number): NearestLineResolver => {
  return (ruling, params, index) => {
    const reference = computeSyntheticLineY(params, index, column);
    const guess = Math.round(
      (lineCoordinateAt(ruling, column, reference) - ruling.firstLinePhase) / ruling.step
    );

    return [guess - 1, guess, guess + 1].reduce(
      (best, candidate) => {
        const coordinate = ruling.firstLinePhase + candidate * ruling.step;
        const distance = Math.abs(restoreLineY(ruling, column, coordinate) - reference);
        const bestDistance = Math.abs(restoreLineY(ruling, column, best) - reference);

        return distance < bestDistance ? coordinate : best;
      },
      ruling.firstLinePhase + guess * ruling.step
    );
  };
};

/**
 * Наибольшее расхождение линий, восстановленных по разлиновке с перспективой и
 * изгибом, с эталоном синтетики — в каждом столбце области с линиями, а не
 * только в узлах изгиба.
 *
 * @param ruling — разлиновка листа
 * @param params — описание листа
 * @param lines — номера эталонных линий
 * @param columns — столбцы проверки
 * @param toLine — способ найти линию, отвечающую эталонной
 * @returns расхождение в пикселях
 */
const measureRestoreError = (
  ruling: SheetRuling,
  params: SyntheticSheetParams,
  lines: number[],
  columns: number[],
  toLine: NearestLineResolver = toNearestLine
): number => {
  return lines.reduce((limit, line) => {
    const coordinate = toLine(ruling, params, line);

    return columns.reduce((columnLimit, x) => {
      const restored = restoreLineY(ruling, x, coordinate);

      return Math.max(
        columnLimit,
        Math.abs(restored - computeSyntheticLineY(params, line, x))
      );
    }, limit);
  }, 0);
};

/**
 * Номера линий, нарисованных между верхним и нижним полями листа.
 *
 * @param params — описание листа
 * @returns номера линий
 */
const toDrawnLines = (params: SyntheticSheetParams): number[] => {
  const {
    step = 0,
    phase = 0,
    height = 0,
    margins = { top: 0, right: 0, bottom: 0, left: 0 },
  } = params;
  const first = Math.ceil((margins.top - phase) / step);
  const last = Math.floor((height - margins.bottom - phase) / step);

  return Array.from({ length: last - first + 1 }, (_item, index) => {
    return first + index;
  });
};

/**
 * Столбцы области с линиями через каждые три пикселя: и в узлах изгиба, и между
 * ними, и у краёв области.
 *
 * @param left — левая граница области
 * @param right — правая граница области
 * @returns столбцы
 */
const toColumns = (left: number, right: number): number[] => {
  return Array.from({ length: Math.floor((right - left) / 3) + 1 }, (_item, index) => {
    return left + index * 3;
  });
};

/**
 * Измеряет синтетический лист как клетку.
 *
 * @param params — описание листа
 * @returns измерения
 */
const measure = (params: SyntheticSheetParams): SheetPhotoMeasurement => {
  return measureSheetPhoto(createSyntheticSheet(params), { kind: 'grid' });
};

describe('measureSheetPhoto: лист на столе', () => {
  it('по всему кадру детектор шага не находит — отрицательный контроль', () => {
    expect(detectRuling(createSyntheticSheet(GRID_SHEET)).isDetected).toBe(false);
  });

  it('шаг — как у прогона по вырезке, поля — переведённые поля вырезки', () => {
    const result = measure(GRID_SHEET);
    const { crop, detection } = detectInCrop(
      GRID_SHEET,
      computeSyntheticOutline(GRID_SHEET)
    );
    const expected = toFrameMargins(detection, crop);

    expect(detection.isDetected).toBe(true);
    expect(result.diagnostics.isRulingDetected).toBe(true);
    expect(Math.abs(result.source.step - detection.step)).toBeLessThanOrEqual(
      GRID_STEP / 100
    );
    expect(result.source.margins).toBeDefined();

    const margins = result.source.margins || expected;

    (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
      expect(expected[side]).toBeGreaterThan(0);
      expect(Math.abs(margins[side] - expected[side])).toBeLessThanOrEqual(1);
    });
  });

  it('верхнее поле стоит на линии: без поправки фазы на отступ вырезки было бы ниже', () => {
    const ruling = buildSheetRuling(measure(GRID_SHEET).source, FRAME);
    const [firstLine = 0] = toDrawnLines(GRID_SHEET);

    expect(
      Math.abs(ruling.margins.top - computeSyntheticLineY(GRID_SHEET, firstLine, 0))
    ).toBeLessThanOrEqual(GRID_STEP / 20);
  });

  it('контур и изгиб в кадре: восстановленные линии не дальше двадцатой шага', () => {
    const result = measure(BENT_GRID_SHEET);
    const ruling = buildSheetRuling(result.source, FRAME);
    const { margins = GRID_SHEET.margins } = BENT_GRID_SHEET;

    expect(result.outline).not.toBeNull();
    expect(ruling.bend).not.toBeNull();
    expect(
      measureRestoreError(
        ruling,
        BENT_GRID_SHEET,
        toDrawnLines(BENT_GRID_SHEET),
        toColumns(
          (margins?.left || 0) + GRID_STEP,
          WIDTH - (margins?.right || 0) - GRID_STEP
        )
      )
    ).toBeLessThanOrEqual(GRID_STEP / 20);
  });

  it('ненайденная сторона поля отступает полтора шага от стороны листа, а не кадра', () => {
    const result = measure(EDGE_GRID_SHEET);
    const ruling = buildSheetRuling(result.source, FRAME);
    const reference = resolveSheetBounds(TABLE_OUTLINE, WIDTH, HEIGHT);

    expect(result.source.margins?.left).toBe(0);
    expect(
      Math.abs(ruling.margins.left - (reference.left + 1.5 * ruling.step))
    ).toBeLessThanOrEqual(2);
  });

  it('неудача разлиновки отдаёт контур, свет и текстуру, а разлиновку — ненайденной', () => {
    const image = createSyntheticSheet(BLANK_TABLE_SHEET);
    const result = measureSheetPhoto(image, { kind: 'grid' });
    const lighting = extractLighting(image, { outline: result.outline });

    expect(result.source.step).toBe(0);
    expect(result.diagnostics.isRulingDetected).toBe(false);
    expect(result.outline).not.toBeNull();
    expect(result.source.outline).toEqual(result.outline);
    expect(result.lighting).toEqual(lighting);
    expect(result.textureMap).toEqual(
      extractTexture(image, lighting, { outline: result.outline })
    );
  });

  it('у чистого листа разлиновка не ищется', () => {
    const result = measureSheetPhoto(createSyntheticSheet(GRID_SHEET), { kind: 'blank' });

    expect(result.source.step).toBe(0);
    expect(result.diagnostics.confidence).toBe(0);
    expect(result.outline).not.toBeNull();
  });

  it('ручной контур не ищется заново', () => {
    const outline: SheetOutline = {
      topLeft: { x: 150, y: 140 },
      topRight: { x: 780, y: 140 },
      bottomRight: { x: 780, y: 1100 },
      bottomLeft: { x: 150, y: 1100 },
    };
    const result = measureSheetPhoto(createSyntheticSheet(GRID_SHEET), {
      kind: 'grid',
      outline,
    });

    expect(result.outline).toBe(outline);
    expect(result.source.outline).toBe(outline);
  });
});

describe('measureSheetPhoto: лист без поверхности', () => {
  it('результат совпадает с детектором по кадру и нынешним светом', () => {
    const image = createSyntheticSheet(CROPPED_GRID_SHEET);
    const result = measureSheetPhoto(image, { kind: 'grid' });
    const detection = detectRuling(image);
    const lighting = extractLighting(image);

    expect(result.outline).toBeNull();
    expect(result.source).toEqual({
      step: detection.step,
      firstLinePhase: detection.firstLinePhase,
      skewAngle: detection.skewAngle,
      margins: detection.margins,
      marginLineX: detection.marginLineX,
      marginLineSide: detection.marginLineSide,
      bend: detection.bend,
      perspective: null,
      outline: null,
    });
    expect(result.lighting).toEqual(lighting);
    expect(result.textureMap).toEqual(extractTexture(image, lighting));
  });
});

const LINED_STEP = 24;

/**
 * Высота области с линиями у листа в линейку с перспективой.
 */
const LINED_TOP = 180;

const LINED_BOTTOM = 160;

const LINED_RULED_HEIGHT = HEIGHT - LINED_TOP - LINED_BOTTOM;

/**
 * Коэффициент изменения шага по высоте, при котором шаг между крайними линиями
 * области растёт на заданную долю: местный шаг меняется как `1/(1 − a·q)²`.
 *
 * @param drift — во сколько раз шаг у нижней линии больше, чем у верхней, минус 1
 * @param ruledHeight — высота области с линиями
 * @returns коэффициент `convergenceY` модели
 */
const toConvergenceY = (drift: number, ruledHeight = LINED_RULED_HEIGHT): number => {
  const ratio = Math.sqrt(1 + drift);

  return (2 * (ratio - 1)) / (ruledHeight * (ratio + 1));
};

/**
 * Дрейф шага 4 % и схождение линий на полградуса по высоте области.
 */
const DRIFT_4 = {
  convergenceX: 0.5 / DEGREES_IN_RADIAN / LINED_RULED_HEIGHT,
  convergenceY: toConvergenceY(0.04),
};

const LINED_DRIFT_SHEET: SyntheticSheetParams = {
  width: WIDTH,
  height: HEIGHT,
  step: LINED_STEP,
  phase: 5,
  angle: 1,
  kind: 'lined',
  margins: { top: LINED_TOP, right: 0, bottom: LINED_BOTTOM, left: 0 },
  lineWidth: 2,
  lineDarkness: 0.35,
  noise: 0.04,
  lighting: 0.2,
  seed: 11,
  surface: TABLE_SURFACE,
  rulingPerspective: DRIFT_4,
};

const BENT_LINED_DRIFT_SHEET: SyntheticSheetParams = {
  ...LINED_DRIFT_SHEET,
  bend: toSag(0.2 * LINED_STEP),
};

const SHIFTED_TOP = 360;

const SHIFTED_BOTTOM = 40;

const SHIFTED_RULED_HEIGHT = HEIGHT - SHIFTED_TOP - SHIFTED_BOTTOM;

/**
 * Лист, сдвинутый вправо-вниз: середина вырезки далеко от середины кадра, и
 * перспектива, переведённая в кадр без отступа вырезки, уводит линии дальше
 * двадцатой шага. На листе по центру кадра такая ошибка не видна.
 */
const SHIFTED_OUTLINE: SheetOutline = {
  topLeft: { x: 250, y: 305 },
  topRight: { x: 880, y: 295 },
  bottomRight: { x: 890, y: 1180 },
  bottomLeft: { x: 260, y: 1190 },
};

/**
 * Схождение 2° и дрейф 6 % — с запасом внутри гарантий, чтобы ошибка перевода
 * перспективы была видна далеко за порогом, а не у него.
 */
const SHIFTED_BENT_LINED_SHEET: SyntheticSheetParams = {
  ...LINED_DRIFT_SHEET,
  margins: { top: SHIFTED_TOP, right: 0, bottom: SHIFTED_BOTTOM, left: 0 },
  surface: { ...TABLE_SURFACE, outline: SHIFTED_OUTLINE },
  rulingPerspective: {
    convergenceX: 2 / DEGREES_IN_RADIAN / SHIFTED_RULED_HEIGHT,
    convergenceY: toConvergenceY(0.06, SHIFTED_RULED_HEIGHT),
  },
  bend: toSag(0.3 * LINED_STEP),
};

const GRID_DRIFT_SHEET: SyntheticSheetParams = {
  ...GRID_SHEET,
  step: LINED_STEP,
  margins: { top: LINED_TOP, right: 170, bottom: LINED_BOTTOM, left: 180 },
  rulingPerspective: DRIFT_4,
};

describe('measureSheetPhoto: перспектива', () => {
  it('линейка с дрейфом 4 % на столе: верхнее поле на первой линии, у ровного прохода — мимо', () => {
    const result = measure(LINED_DRIFT_SHEET);
    const ruling = buildSheetRuling(result.source, FRAME);
    const [firstLine = 0] = toDrawnLines(LINED_DRIFT_SHEET);
    const firstLineY = computeSyntheticLineY(LINED_DRIFT_SHEET, firstLine, 0);
    const { crop, detection } = detectInCrop(LINED_DRIFT_SHEET, result.outline);

    expect(ruling.perspective).not.toBeNull();
    expect(Math.abs(ruling.margins.top - firstLineY)).toBeLessThanOrEqual(
      LINED_STEP / 10
    );
    /**
     * Ровная гребёнка на этом листе ставит первую линию выше настоящей: шаг у
     * верха мельче среднего. Знак зависит от того, успела ли гребёнка
     * соскочить на соседнюю линию, поэтому контроль — по модулю.
     */
    expect(Math.abs(toFrameMargins(detection, crop).top - firstLineY)).toBeGreaterThan(
      LINED_STEP / 10
    );
  });

  it('линейка с дрейфом и изгибом: линии не дальше двадцатой шага в любой точке области', () => {
    const result = measure(BENT_LINED_DRIFT_SHEET);
    const ruling = buildSheetRuling(result.source, FRAME);
    const bounds = resolveSheetBounds(TABLE_OUTLINE, WIDTH, HEIGHT);

    expect(ruling.perspective).not.toBeNull();
    expect(ruling.bend).not.toBeNull();
    expect(
      measureRestoreError(
        ruling,
        BENT_LINED_DRIFT_SHEET,
        toDrawnLines(BENT_LINED_DRIFT_SHEET),
        toColumns(bounds.left + 2, WIDTH - bounds.right - 2)
      )
    ).toBeLessThanOrEqual(LINED_STEP / 20);
  });

  it('перспектива и изгиб на листе вдали от середины кадра: линии не дальше двадцатой шага', () => {
    const result = measure(SHIFTED_BENT_LINED_SHEET);
    const ruling = buildSheetRuling(result.source, FRAME);
    const bounds = resolveSheetBounds(SHIFTED_OUTLINE, WIDTH, HEIGHT);
    const left = bounds.left + 2;
    const right = WIDTH - bounds.right - 2;

    expect(ruling.perspective).not.toBeNull();
    expect(ruling.bend).not.toBeNull();
    expect(
      measureRestoreError(
        ruling,
        SHIFTED_BENT_LINED_SHEET,
        toDrawnLines(SHIFTED_BENT_LINED_SHEET),
        toColumns(left, right),
        toNearestLineInColumn((left + right) / 2)
      )
    ).toBeLessThanOrEqual(LINED_STEP / 20);
  });

  it('клетка с дрейфом 4 %: поля в пределах полушага от эталона', () => {
    const result = measure(GRID_DRIFT_SHEET);
    const ruling = buildSheetRuling(result.source, FRAME);
    const lines = toDrawnLines(GRID_DRIFT_SHEET);
    /**
     * Эталон боковых полей — тот же лист без перспективы: боковое поле
     * отсчитывается от конца линий с зазором, и в параметрах листа его нет.
     */
    const flat = buildSheetRuling(
      measure({ ...GRID_DRIFT_SHEET, rulingPerspective: null }).source,
      FRAME
    );

    expect(ruling.perspective).not.toBeNull();
    expect(flat.perspective).toBeNull();
    expect(
      Math.abs(
        ruling.margins.top - computeSyntheticLineY(GRID_DRIFT_SHEET, lines[0] || 0, 0)
      )
    ).toBeLessThanOrEqual(LINED_STEP / 2);
    expect(
      Math.abs(
        HEIGHT -
          ruling.margins.bottom -
          computeSyntheticLineY(GRID_DRIFT_SHEET, lines.at(-1) || 0, 0)
      )
    ).toBeLessThanOrEqual(LINED_STEP / 2);
    expect(Math.abs(ruling.margins.left - flat.margins.left)).toBeLessThanOrEqual(
      LINED_STEP / 2
    );
    expect(Math.abs(ruling.margins.right - flat.margins.right)).toBeLessThanOrEqual(
      LINED_STEP / 2
    );
  });

  it('второй проход не нашёл разлиновку: результат — ровный проход без перспективы', async () => {
    const actual = await vi.importActual<typeof RectifyModule>(
      '@pages/Generator/lib/paper/measureSheetPhotoRectify'
    );

    vi.mocked(rectifySheetImage).mockImplementationOnce((image, projection) => {
      const rectified = actual.rectifySheetImage(image, projection);

      return {
        ...rectified,
        image: {
          ...rectified.image,
          luminance: new Float32Array(rectified.image.luminance.length).fill(0.9),
        },
      };
    });

    const result = measure(LINED_DRIFT_SHEET);
    const { crop, detection } = detectInCrop(LINED_DRIFT_SHEET, result.outline);
    const phaseShift =
      crop.top - crop.left * Math.tan(detection.skewAngle / DEGREES_IN_RADIAN);

    expect(vi.mocked(rectifySheetImage)).toHaveBeenCalled();
    expect(result.diagnostics.perspective?.isRectifiedRulingMissing).toBe(true);
    expect(result.source.perspective).toBeNull();
    expect(result.source.step).toBe(detection.step);
    expect(result.source.skewAngle).toBe(detection.skewAngle);
    expect(result.source.firstLinePhase).toBeCloseTo(
      (detection.firstLinePhase + phaseShift + detection.step) % detection.step,
      9
    );

    const expected = toFrameMargins(detection, crop);
    const margins = result.source.margins || expected;

    (['top', 'right', 'bottom', 'left'] as const).forEach((side) => {
      expect(margins[side]).toBeCloseTo(expected[side], 9);
    });
  });
});
