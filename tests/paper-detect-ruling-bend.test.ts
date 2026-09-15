import {
  buildSheetRuling,
  type RulingBend,
  type SheetRuling,
} from '@pages/Generator/lib/paper';
import { detectRuling } from '@pages/Generator/lib/paper/detectRuling';
import type { RulingBendRegion } from '@pages/Generator/lib/paper/detectRulingBend';
import { sampleRulingBend } from '@pages/Generator/lib/paper/sampleRulingBend';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticLineEnds,
  computeSyntheticLineY,
  computeSyntheticMarginLineX,
  createSyntheticSheet,
  type SyntheticField,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

const STEP = 24;

const WIDTH = 720;

const HEIGHT = 960;

/**
 * Допуск попадания по спеке: двадцатая часть шага.
 */
const LINE_TOLERANCE = STEP / 20;

/**
 * Допуск на границы области в пикселях: область режется по целым столбцам, а
 * концы линий и линия поля находятся с точностью около пикселя.
 */
const REGION_TOLERANCE = 2;

/**
 * Допуск на поля в пикселях, как у остальных тестов детектора: поля упираются в
 * дискретность профиля.
 */
const MARGIN_TOLERANCE = 3;

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Прогиб по ширине кадра: середина линии ниже концов на три десятых шага.
 */
const FRAME_SAG: SyntheticField = (x) => {
  return 0.3 * STEP * (1 - ((2 * x) / WIDTH - 1) ** 2);
};

/**
 * Изогнутый лист в линейку с линиями от края до края кадра.
 */
const BENT_SHEET = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 10,
  margins: { top: 72, right: 0, bottom: 72, left: 0 },
  noise: 0.04,
  seed: 7,
  bend: FRAME_SAG,
} satisfies SyntheticSheetParams;

/**
 * Левые концы линий и линия поля: между ними — область с линиями. Линия поля
 * стоит у внутренней границы крайней трети ширины, где её ищет детектор: за
 * ней остаётся почти треть кадра.
 */
const LINE_START = 60;

const MARGIN_LINE_X = 490;

/**
 * Прогиб в пределах области: в середине треть шага — наибольший прогиб, который
 * допускает спека, — к концам линий и к линии поля сходит на нет без излома.
 * Край пологий: за крайним узлом сетка держит смещение постоянным, и крутой
 * край проверял бы полуполосу у края области, а не саму область.
 */
const REGION_SAG: SyntheticField = (x) => {
  const center = (LINE_START + MARGIN_LINE_X) / 2;
  const half = (MARGIN_LINE_X - LINE_START) / 2;
  const share = Math.max(-1, Math.min(1, (x - center) / half));

  return (STEP / 3) * Math.cos((Math.PI * share) / 2) ** 2;
};

/**
 * Ровный лист, снятый с краем тетради: слева ближе шага от концов линий —
 * тёмные пятна спирали с шагом, близким к шагу линий, справа линии проходят за
 * линию поля до края кадра. Концов линий справа нет, и область справа режет
 * только линия поля. Лист наклонён, и концы линий с линией поля идут наискосок
 * кадра.
 */
const STRAIGHT_SPIRAL_SHEET = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 10,
  angle: 1,
  margins: { top: 72, right: 0, bottom: 72, left: LINE_START },
  marginLineX: MARGIN_LINE_X,
  spiral: { x: 32, period: 26, radius: 8, darkness: 0.9 },
  noise: 0.04,
  seed: 11,
} satisfies SyntheticSheetParams;

/**
 * Тот же лист с прогибом линий.
 */
const SPIRAL_SHEET = {
  ...STRAIGHT_SPIRAL_SHEET,
  bend: REGION_SAG,
} satisfies SyntheticSheetParams;

/**
 * Лист со спиралью, у которого за линией поля поверх линий идёт линейка
 * соседней страницы с почти тем же шагом.
 */
const STRAIGHT_CLUTTERED_SHEET = {
  ...STRAIGHT_SPIRAL_SHEET,
  outerRuling: { step: 22, phase: 5 },
} satisfies SyntheticSheetParams;

/**
 * Тот же лист с прогибом линий.
 */
const CLUTTERED_SHEET = {
  ...STRAIGHT_CLUTTERED_SHEET,
  bend: REGION_SAG,
} satisfies SyntheticSheetParams;

const detectSheetRuling = (params: SyntheticSheetParams): SheetRuling => {
  const skewAngle = params.angle || 0;
  const detection = detectRuling(createSyntheticSheet(params), { skewAngle });

  return buildSheetRuling({ ...detection, skewAngle });
};

/**
 * Область с линиями в столбцах кадра: между самым внутренним левым концом
 * линий и самым внутренним положением линии поля по всей высоте разлиновки.
 */
const findLinedRegion = (params: typeof SPIRAL_SHEET): RulingBendRegion => {
  let left = Number.NEGATIVE_INFINITY;
  let right = Number.POSITIVE_INFINITY;

  for (let y = params.margins.top; y <= params.height - params.margins.bottom; y += 1) {
    left = Math.max(left, computeSyntheticLineEnds(params, y).left);
    right = Math.min(right, computeSyntheticMarginLineX(params, y) || right);
  }

  return { left, right };
};

/**
 * Область, по которой мерился изгиб, восстановленная по его сетке: узлы стоят
 * в центрах равных полос области.
 */
const toNodeRegion = (bend: RulingBend): RulingBendRegion => {
  const left = bend.columnOrigin + 0.5 - bend.columnSpacing / 2;

  return { left, right: left + bend.columnSpacing * bend.columnCount };
};

/**
 * Наибольшее расхождение линий, восстановленных по найденной разлиновке, с
 * нарисованными — по каждому столбцу области и каждой линии внутри полей.
 * Номер найденной линии берётся ближайший к нарисованной: фаза детектора
 * отсчитана от другой линии гребёнки.
 */
const measureRestoreError = (
  params: typeof SPIRAL_SHEET,
  ruling: SheetRuling,
  region: RulingBendRegion
): number => {
  const { step, phase, angle, margins, height } = params;
  const tangent = Math.tan(angle * DEGREES_TO_RADIANS);
  const firstLine = Math.ceil((margins.top - phase) / step);
  const lastLine = Math.floor((height - margins.bottom - phase) / step);
  let maxError = 0;

  for (let index = firstLine; index <= lastLine; index += 1) {
    const center = phase + index * step;
    const line = Math.round((center - ruling.firstLinePhase) / ruling.step);

    for (let x = Math.ceil(region.left); x < Math.floor(region.right); x += 1) {
      const straightY = ruling.firstLinePhase + line * ruling.step + x * tangent;
      const restored =
        straightY +
        (ruling.bend ? sampleRulingBend(ruling.bend, ruling.skewAngle, x, straightY) : 0);

      maxError = Math.max(
        maxError,
        Math.abs(restored - computeSyntheticLineY(params, index, x))
      );
    }
  }

  return maxError;
};

describe('detectRuling: изгиб линий', () => {
  it('разлиновка, собранная из детекции изогнутого листа, несёт изгиб', () => {
    expect(detectSheetRuling(BENT_SHEET).bend).not.toBeNull();
  });

  it('сохраняет изгиб на наклонном листе со спиралью и чужой линейкой за линией поля', () => {
    const ruling = detectSheetRuling(CLUTTERED_SHEET);

    expect(ruling.marginLineSide).toBe('right');
    expect(ruling.bend).not.toBeNull();
    expect(
      measureRestoreError(CLUTTERED_SHEET, ruling, findLinedRegion(CLUTTERED_SHEET))
    ).toBeLessThanOrEqual(LINE_TOLERANCE);
  });

  /**
   * Промах по линиям одну область не держит: линии за линией поля ведут трассу
   * верно, а пятна спирали сдвигают крайний узел меньше допуска. Поэтому
   * область проверяется отдельно, по сетке узлов, на листе без чужой линейки:
   * она делает концы линий у линии поля различимыми, и область справа держали
   * бы они, а не линия поля. Найденные справа концы линий обязаны лежать дальше
   * шага за линией поля — иначе область, не обрезанная линией поля, совпала бы
   * с верной, и проверка ничего бы не различала. На наклонном листе концы линий
   * и линия поля за высоту разлиновки уходят вбок на четырнадцать пикселей, и
   * область по их положению не у той линии заходила бы за них на части строк.
   */
  it('мерит изгиб от самого внутреннего конца линий до самого внутреннего положения линии поля', () => {
    const { bend, margins } = detectSheetRuling(SPIRAL_SHEET);
    const expected = findLinedRegion(SPIRAL_SHEET);
    const region = bend && toNodeRegion(bend);

    expect(WIDTH - margins.right).toBeGreaterThan(expected.right + STEP);
    expect(Math.abs((region?.left || 0) - expected.left)).toBeLessThanOrEqual(
      REGION_TOLERANCE
    );
    expect(Math.abs((region?.right || 0) - expected.right)).toBeLessThanOrEqual(
      REGION_TOLERANCE
    );
  });

  /**
   * По полям и линии поля выкладывается блок текста, и прогиб линий их сдвигать
   * не должен.
   */
  it.each([
    ['со спиралью', SPIRAL_SHEET, STRAIGHT_SPIRAL_SHEET],
    ['со спиралью и чужой линейкой', CLUTTERED_SHEET, STRAIGHT_CLUTTERED_SHEET],
  ])(
    'находит на листе %s с прогибом в треть шага те же поля и линию поля, что и на ровном',
    (_name, bentSheet, straightSheet) => {
      const bent = detectSheetRuling(bentSheet);
      const straight = detectSheetRuling(straightSheet);

      expect(Math.abs(bent.margins.top - straight.margins.top)).toBeLessThanOrEqual(
        MARGIN_TOLERANCE
      );
      expect(Math.abs(bent.margins.bottom - straight.margins.bottom)).toBeLessThanOrEqual(
        MARGIN_TOLERANCE
      );
      expect(Math.abs(bent.margins.left - straight.margins.left)).toBeLessThanOrEqual(
        MARGIN_TOLERANCE
      );
      expect(Math.abs(bent.margins.right - straight.margins.right)).toBeLessThanOrEqual(
        MARGIN_TOLERANCE
      );
      expect(
        Math.abs((bent.marginLineX || 0) - (straight.marginLineX || 0))
      ).toBeLessThanOrEqual(MARGIN_TOLERANCE);
    }
  );
});
