import type { MarginLineSide, SheetImageData } from '@pages/Generator/lib/paper';
import {
  type BandedMarginLine,
  detectRuling,
  findBandedMarginLine,
  MARGIN_LINE_BAND_STEPS,
} from '@pages/Generator/lib/paper/detectRuling';
import { buildStripProfiles } from '@pages/Generator/lib/paper/sheetProfile';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ABSENT_MARGIN_LINE_SHEET,
  BLOTTED_MARGIN_LINE_SHEET,
  computeSyntheticMarginLineX,
  createSyntheticSheet,
  DRIFTING_MARGIN_LINE_SHEET,
  type SyntheticCalibrationSheet,
  type SyntheticCurve,
  type SyntheticMarginLineSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

/**
 * Полосы строятся одной функцией на все ступени, и счётчик её вызовов —
 * единственный способ увидеть, что полосовой ступени на листе не понадобилось:
 * по `marginLineX` ступень не различишь.
 */
vi.mock('@pages/Generator/lib/paper/sheetProfile', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@pages/Generator/lib/paper/sheetProfile')>();

  return { ...actual, buildStripProfiles: vi.fn(actual.buildStripProfiles) };
});

/**
 * Допуск на положение линии поля в пикселях.
 */
const PIXEL_TOLERANCE = 1;

/**
 * Лист в линейку с линией поля. Высокий кадр: полоса трассировки — полтора
 * шага, и чем выше кадр при той же амплитуде изгиба, тем меньше линия успевает
 * уйти в пределах одной полосы, крайней в том числе.
 */
const MARGIN_SHEET = {
  width: 420,
  height: 2400,
  step: 24,
  phase: 8,
  margins: { top: 48, right: 30, bottom: 48, left: 30 },
  noise: 0.04,
} satisfies SyntheticSheetParams;

const LEFT_MARGIN_LINE_X = 90;

const RIGHT_MARGIN_LINE_X = 330;

/**
 * Амплитуда изгиба линии поля — три десятых шага.
 */
const BEND_AMPLITUDE = 0.3 * MARGIN_SHEET.step;

const REGION_TOP = MARGIN_SHEET.margins.top;

const REGION_BOTTOM = MARGIN_SHEET.height - MARGIN_SHEET.margins.bottom;

/**
 * `marginLineX` прямой линии поля на тех же листах и с тем же углом, снятый
 * измерением по среднему профилю столбцов, без трассировки по полосам: на
 * прямой линии трассировка не должна его сдвигать.
 */
const STRAIGHT_LEFT_BASE_X = 89.9995;

const STRAIGHT_RIGHT_TILTED_BASE_X = 329.998;

/**
 * Положение строки внутри области с линиями: −1 у верхнего края области, 1 у
 * нижнего.
 */
const toRegionShare = (y: number): number => {
  return (2 * (y - REGION_TOP)) / (REGION_BOTTOM - REGION_TOP) - 1;
};

/**
 * Параболический изгиб, самый сильный у верхнего и нижнего края области.
 *
 * @param sign — направление: 1 — вправо, −1 — влево
 * @returns сдвиг линии поля по высоте кадра
 */
const bendAtEdges = (sign: number): SyntheticCurve => {
  return (y) => {
    return sign * BEND_AMPLITUDE * toRegionShare(y) ** 2;
  };
};

/**
 * Параболический изгиб, самый сильный в середине высоты области.
 *
 * @param sign — направление: 1 — вправо, −1 — влево
 * @returns сдвиг линии поля по высоте кадра
 */
const bendAtMiddle = (sign: number): SyntheticCurve => {
  return (y) => {
    return sign * BEND_AMPLITUDE * (1 - toRegionShare(y) ** 2);
  };
};

/**
 * Самая внутренняя точка линии поля в области с линиями: у левой линии поля
 * область письма справа, у правой — слева.
 */
const findInnermostMarginLineX = (params: SyntheticSheetParams): number => {
  const isLeft = (params.marginLineX || 0) < (params.width || 0) / 2;
  let innermost = isLeft ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;

  for (let y = REGION_TOP; y <= REGION_BOTTOM; y += 1) {
    const x = computeSyntheticMarginLineX(params, y) || 0;

    innermost = isLeft ? Math.max(innermost, x) : Math.min(innermost, x);
  }

  return innermost;
};

/**
 * Стирает или бледнит линию поля на строках `[from, to)`: точки вокруг линии
 * смешиваются с точками той же строки на `shift` левее, где линии поля нет, а
 * остальная разлиновка та же.
 *
 * @param image — растр листа, правится на месте
 * @param lineX — столбец линии поля по строке кадра
 * @param rows — строки `[from, to)`
 * @param shift — на сколько столбцов левее берётся фон
 * @param keep — какая доля глубины линии остаётся: 0 — линия стёрта
 */
const fadeMarginLine = (
  image: ReturnType<typeof createSyntheticSheet>,
  lineX: (y: number) => number,
  rows: [number, number],
  shift: number,
  keep: number
): void => {
  const { width, luminance } = image;
  const [from, to] = rows;

  for (let y = from; y < to; y += 1) {
    const row = y * width;
    const center = Math.round(lineX(y));

    for (let x = center - 8; x <= center + 8; x += 1) {
      const background = luminance[row + x - shift] || 0;
      const value = luminance[row + x] || 0;

      luminance[row + x] = background + keep * (value - background);
    }
  }
};

/**
 * Случай проверки поиска, ограниченного краем листа.
 */
type ForeignSideCase = {
  /**
   * Подпись случая в названии теста.
   */
  label: string;

  /**
   * Положение линии поля на листе в пикселях.
   */
  marginLineX: number;

  /**
   * Край, которым ограничен поиск: не тот, у которого стоит линия.
   */
  foreignSide: MarginLineSide;
};

describe('detectRuling: трассировка линии поля', () => {
  it.each([
    ['слева, самая внутренняя точка у краёв области', LEFT_MARGIN_LINE_X, bendAtEdges(1)],
    ['слева, самая внутренняя точка в середине', LEFT_MARGIN_LINE_X, bendAtMiddle(1)],
    [
      'справа, самая внутренняя точка у краёв области',
      RIGHT_MARGIN_LINE_X,
      bendAtEdges(-1),
    ],
    ['справа, самая внутренняя точка в середине', RIGHT_MARGIN_LINE_X, bendAtMiddle(-1)],
  ])(
    'изогнутая линия поля %s не дальше от области письма, чем её самая внутренняя точка',
    (_label, marginLineX, marginLineBend) => {
      const params = { ...MARGIN_SHEET, marginLineX, marginLineBend };
      const innermost = findInnermostMarginLineX(params);
      const detection = detectRuling(createSyntheticSheet(params), { skewAngle: 0 });
      const detectedX = detection.marginLineX || 0;

      expect(detection.marginLineSide).toBe(
        marginLineX === LEFT_MARGIN_LINE_X ? 'left' : 'right'
      );

      if (marginLineX === LEFT_MARGIN_LINE_X) {
        expect(detectedX).toBeGreaterThanOrEqual(innermost - PIXEL_TOLERANCE);
        expect(detectedX).toBeLessThanOrEqual(innermost + MARGIN_SHEET.step / 6);

        return;
      }

      expect(detectedX).toBeLessThanOrEqual(innermost + PIXEL_TOLERANCE);
      expect(detectedX).toBeGreaterThanOrEqual(innermost - MARGIN_SHEET.step / 6);
    }
  );

  /**
   * Сторона приходит проходу по выпрямленной копии от ровного прохода: линия у
   * другого края — не уточнение той же линии, а другая находка, и её нельзя
   * ни взять в разлиновку, ни дать ей обрезать сетку изгиба.
   */
  it.each([
    { label: 'слева', marginLineX: LEFT_MARGIN_LINE_X, foreignSide: 'right' },
    { label: 'справа', marginLineX: RIGHT_MARGIN_LINE_X, foreignSide: 'left' },
  ] satisfies ForeignSideCase[])(
    'линия поля $label: поиск, ограниченный другим краем, её не берёт',
    ({ marginLineX, foreignSide }) => {
      const image = createSyntheticSheet({ ...MARGIN_SHEET, marginLineX });
      const free = detectRuling(image, { skewAngle: 0 });
      const constrained = detectRuling(image, {
        skewAngle: 0,
        marginLineSide: foreignSide,
      });
      const own = detectRuling(image, {
        skewAngle: 0,
        marginLineSide: free.marginLineSide,
      });

      expect(free.marginLineX).not.toBeNull();
      expect(constrained.marginLineX).toBeNull();
      expect(constrained.marginLineSide).toBeNull();
      expect(own.marginLineX).toBe(free.marginLineX);
    }
  );

  it('прямая линия поля даёт прежний результат', () => {
    const left = detectRuling(
      createSyntheticSheet({ ...MARGIN_SHEET, marginLineX: LEFT_MARGIN_LINE_X }),
      { skewAngle: 0 }
    );
    const rightTilted = detectRuling(
      createSyntheticSheet({
        ...MARGIN_SHEET,
        marginLineX: RIGHT_MARGIN_LINE_X,
        angle: 1.3,
      }),
      { skewAngle: 1.3 }
    );

    expect(Math.abs((left.marginLineX || 0) - STRAIGHT_LEFT_BASE_X)).toBeLessThanOrEqual(
      PIXEL_TOLERANCE
    );
    expect(
      Math.abs((rightTilted.marginLineX || 0) - STRAIGHT_RIGHT_TILTED_BASE_X)
    ).toBeLessThanOrEqual(PIXEL_TOLERANCE);
  });

  /**
   * Самая внутренняя точка — у верха области, а между ней и остальной линией
   * линия стёрта на несколько полос. Выше разрыва линия бледнее, чтобы старт
   * трассировки пришёлся ниже разрыва: трасса обязана перешагнуть его.
   */
  it('уточняет линию поля по остальным полосам, если в части полос её нет', () => {
    const marginLineBend: SyntheticCurve = (y) => {
      return BEND_AMPLITUDE * ((REGION_BOTTOM - y) / (REGION_BOTTOM - REGION_TOP)) ** 2;
    };

    const params = { ...MARGIN_SHEET, marginLineX: LEFT_MARGIN_LINE_X, marginLineBend };
    const image = createSyntheticSheet(params);

    const lineX = (y: number): number => {
      return LEFT_MARGIN_LINE_X + marginLineBend(y);
    };

    fadeMarginLine(image, lineX, [0, 300], 20, 0.9);
    fadeMarginLine(image, lineX, [300, 420], 20, 0);

    const { marginLineX } = detectRuling(image, { skewAngle: 0 });

    expect(marginLineX || 0).toBeGreaterThanOrEqual(
      findInnermostMarginLineX(params) - PIXEL_TOLERANCE
    );
  });

  /**
   * Вертикаль клетки стоит в окне трассировки с внутренней стороны линии поля.
   * Там, где линия поля стёрта, в окне остаётся только вертикаль, и трасса,
   * принявшая её, увела бы линию поля внутрь.
   */
  it('на клетчатом листе трасса не уходит на обычную вертикаль', () => {
    const marginLineX = 80;
    const params = {
      width: 420,
      height: 1200,
      step: 28,
      phase: 0,
      kind: 'grid',
      margins: { top: 56, right: 28, bottom: 56, left: 28 },
      marginLineX,
      marginLineDarkness: 0.9,
      noise: 0.04,
    } satisfies SyntheticSheetParams;
    const image = createSyntheticSheet(params);

    fadeMarginLine(
      image,
      () => {
        return marginLineX;
      },
      [400, 600],
      params.step,
      0
    );

    const detection = detectRuling(image, { skewAngle: 0 });

    expect(detection.kind).toBe('grid');
    expect(detection.marginLineSide).toBe('left');
    expect(Math.abs((detection.marginLineX || 0) - marginLineX)).toBeLessThanOrEqual(
      PIXEL_TOLERANCE
    );
  });
});

/**
 * Нынешний барьер детектора: во сколько раз кандидат обязан быть глубже
 * соседних вертикалей (`MARGIN_LINE_DEPTH_RATIO` в
 * `lib/paper/detectRuling.ts`). Исходник константу не экспортирует, и
 * литералом она повторена нарочно: калибровка барьера правит её число, и
 * проверка разделения классов, взяв его оттуда, молча переписалась бы вместе
 * с ним.
 */
const PEER_DEPTH_RATIO = 1.5;

/**
 * Доля полос, в которых трасса обязана найти черту на листе без пятна: черта
 * идёт через всю область с линиями, и потерять её негде.
 */
const TRACED_BAND_SHARE = 0.8;

/**
 * Какую долю глубины черты вправе потерять полосовая мера: в полосе черта
 * усреднена по её высоте, а эталон снят по самой черте на каждой строке.
 */
const BAND_DEPTH_SHARE = 0.5;

/**
 * Число полос опроса на кадр — высота кадра, делённая на высоту полосы.
 */
const toBandCount = (sheet: SyntheticCalibrationSheet): number => {
  return Math.round(sheet.height / (MARGIN_LINE_BAND_STEPS * sheet.step));
};

/**
 * Опрашивает лист калибровки полосовой ступенью так же, как её зовёт замер:
 * полосы строятся по всему кадру, а область с линиями у листов калибровки
 * занимает его почти целиком.
 *
 * @param sheet — лист калибровки
 * @returns кандидат и числа, по которым он принят или отвергнут
 */
const pollCalibrationSheet = (sheet: SyntheticCalibrationSheet): BandedMarginLine => {
  const strips = buildStripProfiles(
    createSyntheticSheet(sheet),
    'vertical',
    0,
    0,
    toBandCount(sheet)
  );

  return findBandedMarginLine(strips, sheet.step, sheet.width);
};

/**
 * Самая внутренняя точка черты листа калибровки в его области с линиями: у
 * левой черты область письма справа, и самое внутреннее — наибольшее `x`.
 *
 * @param sheet — лист с чертой
 * @returns столбец самой внутренней точки черты
 */
const findInnermostCalibrationX = (sheet: SyntheticMarginLineSheet): number => {
  const bottom = sheet.height - sheet.margins.bottom;
  let innermost = Number.NEGATIVE_INFINITY;

  for (let y = sheet.margins.top; y <= bottom; y += 1) {
    innermost = Math.max(innermost, computeSyntheticMarginLineX(sheet, y) || 0);
  }

  return innermost;
};

/**
 * Глубина черты в одной полосе, снятая по растру хелпера: на каждой строке
 * столбец черты берётся заново, фоном служат точки в полушаге по обе стороны.
 *
 * Эталон меряется по растру, а не тем же полосовым кодом: иначе проверка
 * сравнивала бы измерение с самим собой.
 *
 * @param image — растр листа
 * @param sheet — лист с чертой
 * @param band — номер полосы опроса сверху вниз
 * @returns средняя по строкам полосы глубина черты
 */
const measureBandInk = (
  image: SheetImageData,
  sheet: SyntheticMarginLineSheet,
  band: number
): number => {
  const { height, step, width } = sheet;
  const bandHeight = height / toBandCount(sheet);
  const half = Math.round(step / 2);
  const from = Math.round(band * bandHeight);
  const to = Math.round((band + 1) * bandHeight);
  let sum = 0;

  for (let y = from; y < to; y += 1) {
    const row = y * width;
    const center = Math.round(computeSyntheticMarginLineX(sheet, y) || 0);
    const background =
      ((image.luminance[row + center - half] || 0) +
        (image.luminance[row + center + half] || 0)) /
      2;

    sum += background - (image.luminance[row + center] || 0);
  }

  return sum / (to - from);
};

describe('findBandedMarginLine: черта, уходящая в сторону', () => {
  it('находит черту там, где профиль во всю высоту её размазал', () => {
    const sheet = DRIFTING_MARGIN_LINE_SHEET;
    const report = pollCalibrationSheet(sheet);

    expect(report.line).not.toBeNull();
    expect(report.line?.side).toBe('left');
    expect(
      Math.abs((report.line?.x || 0) - findInnermostCalibrationX(sheet))
    ).toBeLessThanOrEqual(sheet.step / 5);
  });

  it('держит медианную глубину не ниже половины глубины черты в полосе', () => {
    const sheet = DRIFTING_MARGIN_LINE_SHEET;
    const image = createSyntheticSheet(sheet);
    const middleBand = Math.floor(toBandCount(sheet) / 2);
    const report = pollCalibrationSheet(sheet);

    expect(report.coverage).toBeGreaterThanOrEqual(TRACED_BAND_SHARE);
    expect(report.depth).toBeGreaterThanOrEqual(
      BAND_DEPTH_SHARE * measureBandInk(image, sheet, middleBand)
    );
  });
});

describe('findBandedMarginLine: барьер меряется полосами с обеих сторон', () => {
  it('пропускает черту, которая глубже соседей в полтора раза', () => {
    const report = pollCalibrationSheet(DRIFTING_MARGIN_LINE_SHEET);

    expect(report.threshold).toBe('peers');
    expect(report.ratio).toBeGreaterThan(PEER_DEPTH_RATIO);
    expect(report.line).not.toBeNull();
  });

  it('связывает соседями кандидата на листе без черты', () => {
    const report = pollCalibrationSheet(ABSENT_MARGIN_LINE_SHEET);

    expect(report.threshold).toBe('peers');
    expect(report.ratio).toBeLessThan(PEER_DEPTH_RATIO);
    expect(report.line).toBeNull();
  });

  it('меряет соседей той же полосовой мерой на листе с чертой и без неё', () => {
    const drifting = pollCalibrationSheet(DRIFTING_MARGIN_LINE_SHEET);
    const absent = pollCalibrationSheet(ABSENT_MARGIN_LINE_SHEET);

    expect(drifting.peerDepth).toBeCloseTo(absent.peerDepth, 10);
  });
});

/**
 * Доля высоты кадра сверху, где за краем листа уже обложка: край контура
 * наклонён относительно настоящего края листа, и в верхней части кадра в
 * вырезку попадает полоса тёмной обложки, а ниже — нет.
 */
const COVER_HEIGHT_SHARE = 0.45;

/**
 * Ширина полосы обложки у правого края кадра в пикселях — меньше полушага:
 * обрыв бумаги стоит ближе полуокна фона к краю полосы.
 */
const COVER_WIDTH = 6;

/**
 * Яркость тёмной обложки за краем листа.
 */
const COVER_LUMINANCE = 0.37;

/**
 * Лист без черты, у которого в верхней части кадра последние столбцы — уже
 * обложка за краем листа. Растр собирается здесь, а не в хелпере: краевой
 * лист не складывается из готовых полей листа калибровки.
 *
 * @param sheet — лист калибровки без черты
 * @returns растр листа с обрывом бумаги у правого края
 */
const createCoverEdgeSheet = (sheet: SyntheticCalibrationSheet): SheetImageData => {
  const image = createSyntheticSheet(sheet);
  const luminance = Float32Array.from(image.luminance);
  const coverRows = Math.round(sheet.height * COVER_HEIGHT_SHARE);

  for (let y = 0; y < coverRows; y += 1) {
    for (let x = sheet.width - COVER_WIDTH; x < sheet.width; x += 1) {
      luminance[y * sheet.width + x] = COVER_LUMINANCE;
    }
  }

  return { ...image, luminance };
};

describe('findBandedMarginLine: край листа у края полосы', () => {
  it('не принимает обрыв бумаги в пределах полуокна фона от края за черту', () => {
    const sheet = ABSENT_MARGIN_LINE_SHEET;
    const strips = buildStripProfiles(
      createCoverEdgeSheet(sheet),
      'vertical',
      0,
      0,
      toBandCount(sheet)
    );

    expect(findBandedMarginLine(strips, sheet.step, sheet.width).line).toBeNull();
  });
});

/**
 * `marginLineX` прямой черты на базе прогона — до последнего знака, а не с
 * допуском: полосовая ступень обязана оставить лист с прямой чертой нетронутым
 * побитово, и допуск в пиксель пропустил бы подмену числа другой ступенью.
 */
const STRAIGHT_LEFT_EXACT_X = 90.00427426734643;

const STRAIGHT_RIGHT_TILTED_EXACT_X = 329.86982352348195;

/**
 * Сколько раз строились полосы опроса. Опознаются по числу полос на кадр: их
 * больше одной на шаг разлиновки, тогда как трассировочные идут по полторы
 * полосы на шаг, а полосы области с линиями — восемь на кадр.
 *
 * @param height — высота кадра
 * @param step — шаг разлиновки
 * @returns число построений полос опроса
 */
const countPollBuilds = (height: number, step: number): number => {
  return vi.mocked(buildStripProfiles).mock.calls.filter(([, axis, , , stripCount]) => {
    return axis === 'vertical' && stripCount > height / step;
  }).length;
};

describe('detectRuling: полосовая ступень стоит второй', () => {
  beforeEach(() => {
    vi.mocked(buildStripProfiles).mockClear();
  });

  it('оставляет прямую черту нетронутой и полос опроса не строит', () => {
    const detection = detectRuling(
      createSyntheticSheet({ ...MARGIN_SHEET, marginLineX: LEFT_MARGIN_LINE_X }),
      { skewAngle: 0 }
    );

    expect(detection.marginLineX).toBe(STRAIGHT_LEFT_EXACT_X);
    expect(detection.marginLineSide).toBe('left');
    expect(countPollBuilds(MARGIN_SHEET.height, MARGIN_SHEET.step)).toBe(0);
  });

  it('так же оставляет наклонный лист с чертой справа', () => {
    const detection = detectRuling(
      createSyntheticSheet({
        ...MARGIN_SHEET,
        marginLineX: RIGHT_MARGIN_LINE_X,
        angle: 1.3,
      }),
      { skewAngle: 1.3 }
    );

    expect(detection.marginLineX).toBe(STRAIGHT_RIGHT_TILTED_EXACT_X);
    expect(detection.marginLineSide).toBe('right');
    expect(countPollBuilds(MARGIN_SHEET.height, MARGIN_SHEET.step)).toBe(0);
  });

  it('находит снесённую черту второй ступенью', () => {
    const sheet = DRIFTING_MARGIN_LINE_SHEET;
    const detection = detectRuling(createSyntheticSheet(sheet), { skewAngle: 0 });

    expect(detection.marginLineSide).toBe('left');
    expect(
      Math.abs((detection.marginLineX || 0) - findInnermostCalibrationX(sheet))
    ).toBeLessThanOrEqual(sheet.step / 5);
    expect(countPollBuilds(sheet.height, sheet.step)).toBe(1);
  });

  it('не ищет черту ни одной ступенью, когда сторона снята', () => {
    const detection = detectRuling(createSyntheticSheet(DRIFTING_MARGIN_LINE_SHEET), {
      skewAngle: 0,
      marginLineSide: null,
    });

    expect(detection.marginLineX).toBeNull();
    expect(detection.marginLineSide).toBeNull();
    expect(
      countPollBuilds(DRIFTING_MARGIN_LINE_SHEET.height, DRIFTING_MARGIN_LINE_SHEET.step)
    ).toBe(0);
  });

  it('ищет снесённую черту только у заданной стороны', () => {
    const detection = detectRuling(createSyntheticSheet(DRIFTING_MARGIN_LINE_SHEET), {
      skewAngle: 0,
      marginLineSide: 'right',
    });

    expect(detection.marginLineX).toBeNull();
    expect(
      countPollBuilds(DRIFTING_MARGIN_LINE_SHEET.height, DRIFTING_MARGIN_LINE_SHEET.step)
    ).toBe(1);
  });
});

describe('detectRuling: отказ полосовой ступени', () => {
  it('не заводит черту на листе, где её нет', () => {
    const detection = detectRuling(createSyntheticSheet(ABSENT_MARGIN_LINE_SHEET), {
      skewAngle: 0,
    });

    expect(detection.marginLineX).toBeNull();
    expect(detection.marginLineSide).toBeNull();
  });

  it('держит черту, пропавшую под пятном в нескольких полосах подряд', () => {
    const detection = detectRuling(createSyntheticSheet(BLOTTED_MARGIN_LINE_SHEET), {
      skewAngle: 0,
    });

    expect(detection.marginLineX).not.toBeNull();
    expect(detection.marginLineSide).toBe('left');
  });
});

describe('detectRuling: повторяемость полосовой ступени', () => {
  it('второе измерение того же кадра повторяет первое до числа', () => {
    /**
     * Растр один на оба измерения: пользователь добавляет тот же файл второй
     * раз, а не пересоздаёт лист. Новый растр на каждый вызов прятал бы
     * случайность за совпадением синтезатора.
     */
    const image = createSyntheticSheet(DRIFTING_MARGIN_LINE_SHEET);
    const first = detectRuling(image, { skewAngle: 0 });
    const second = detectRuling(image, { skewAngle: 0 });

    /**
     * Найденная черта проверяется отдельно: на листе без неё оба измерения
     * сошлись бы на `null`, и сторож повторяемости стал бы пустым.
     */
    expect(second.marginLineX).not.toBeNull();
    expect(second).toStrictEqual(first);
  });
});
