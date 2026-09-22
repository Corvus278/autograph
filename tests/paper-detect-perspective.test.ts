import { detectRulingPerspective } from '@pages/Generator/lib/paper/detectRulingPerspective';
import type {
  PerspectiveFrame,
  RulingPerspectiveDetection,
} from '@pages/Generator/lib/paper/detectRulingPerspective.types';
import type { SheetImageData } from '@pages/Generator/lib/paper/paper.types';
import { lineHeightAt } from '@pages/Generator/lib/paper/rulingPerspective';
import { describe, expect, it } from 'vitest';

import {
  computeSyntheticLineY,
  createSyntheticSheet,
  type SyntheticArea,
  type SyntheticField,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

const STEP = 24;

const WIDTH = 720;

const HEIGHT = 960;

const MARGIN = 72;

/**
 * Допуск попадания по спеке: двадцатая часть шага.
 */
const LINE_TOLERANCE = STEP / 20;

/**
 * Высота области с линиями: по ней считаются и дрейф шага, и схождение.
 */
const RULED_HEIGHT = HEIGHT - 2 * MARGIN;

const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Лист в линейку на весь кадр по ширине: линии от края до края, сверху и снизу
 * — поле в три шага, чтобы наклонные крайние линии не уходили из кадра.
 */
const BASE_SHEET = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 10,
  angle: 1,
  margins: { top: MARGIN, right: 0, bottom: MARGIN, left: 0 },
  noise: 0.04,
  seed: 7,
} satisfies SyntheticSheetParams;

/**
 * Описание листа вместе со всем, что нужно детектору от ровного прохода.
 */
type PerspectiveSheet = typeof BASE_SHEET & SyntheticSheetParams;

/**
 * Коэффициент изменения шага по высоте, при котором шаг между крайними линиями
 * области растёт на заданную долю: местный шаг меняется как `1/(1 − a·q)²`.
 *
 * @param drift — во сколько раз шаг у нижней линии больше, чем у верхней, минус 1
 * @returns коэффициент `convergenceY` модели
 */
const toConvergenceY = (drift: number): number => {
  const ratio = Math.sqrt(1 + drift);

  return (2 * (ratio - 1)) / (RULED_HEIGHT * (ratio + 1));
};

/**
 * Схождение линий на полградуса по высоте области: наклон крайних линий
 * расходится ровно на столько.
 */
const CONVERGENCE_X = 0.5 / DEGREES_IN_RADIAN / RULED_HEIGHT;

const DRIFT_4 = { convergenceX: CONVERGENCE_X, convergenceY: toConvergenceY(0.04) };

const DRIFT_5 = { convergenceX: CONVERGENCE_X, convergenceY: toConvergenceY(0.05) };

const DRIFT_8 = { convergenceX: CONVERGENCE_X, convergenceY: toConvergenceY(0.08) };

/**
 * Дрейф, при котором линии отходят от равномерной гребёнки меньше чем на
 * сороковую шага. Схождения по ширине нет: отход должен считаться одной
 * причиной, иначе порог проверяется не тем числом.
 */
const DRIFT_BELOW_THRESHOLD = { convergenceX: 0, convergenceY: toConvergenceY(0.006) };

/**
 * Дрейф, при котором отход доходит до пятнадцатой шага — между сороковой, на
 * которой перспективу хранить нельзя, и двадцатой, с которой уже нужно.
 */
const DRIFT_ABOVE_THRESHOLD = { convergenceX: 0, convergenceY: toConvergenceY(0.025) };

const toFrameShare = (value: number, size: number): number => {
  return (2 * value) / size - 1;
};

/**
 * Статичный прогиб по ширине: середина линии ниже концов на заданную долю шага,
 * одинаково у всех линий, — так выгибается бумага у корешка. Крайние смещения
 * изгиба на снимке IMG_1596 из design доходят до 0,47 шага, и перспектива
 * обязана находиться вместе с таким изгибом, а не вместо него.
 *
 * @param share — глубина прогиба в долях шага
 * @returns поле сдвига линий
 */
const toSag = (share: number): SyntheticField => {
  return (x) => {
    return share * STEP * (1 - toFrameShare(x, WIDTH) ** 2);
  };
};

/**
 * Прогиб, меняющий знак дрейфа по ширине: у краёв кадра шаг растёт к низу
 * листа, в середине — убывает. Ни одна перспектива такого не описывает.
 */
const TWISTED_SAG: SyntheticField = (x, y) => {
  return 0.25 * STEP * (3 * toFrameShare(x, WIDTH) ** 2 - 1) * toFrameShare(y, HEIGHT);
};

/**
 * Прогиб с осью, смещённой к правому краю: слева шаг убывает к низу листа,
 * справа растёт — так лежит лист на снимке IMG_1602. Наклонная часть такого
 * прогиба ложится на модель, и подгонка выдаёт за перспективу форму, которой на
 * листе нет: расхождение гребёнок выходит далеко за порог хранения, и отбраковать
 * лист может только невязка. Квадратичная по ширине часть на модель не ложится
 * ни при каких параметрах — она эту невязку и даёт.
 *
 * Амплитуда — 0,9 шага, а не глубина прогиба живого снимка. Форма фикстуры даёт
 * меньшую невязку, чем IMG_1602: при 0,6–0,8 шага она не доходит до порога в
 * пятую шага, и такой прогиб выдаётся за перспективу. При 0,9 невязка около 0,26
 * шага — того же порядка, что у IMG_1602, и с запасом над порогом. Сам IMG_1602
 * проверяется замером на снимке, а не этой фикстурой.
 */
const OFF_CENTRE_SAG: SyntheticField = (x, y) => {
  return 0.9 * STEP * (1 - (toFrameShare(x, WIDTH) - 0.4) ** 2) * toFrameShare(y, HEIGHT);
};

/**
 * Первый столбец крайней правой из пяти полос детектора.
 */
const TORN_STRIP_LEFT = (4 * WIDTH) / 5;

/**
 * Сдвиг сорванного участка трассы: больше порога невязки в пятую шага, но
 * внутри окна поиска в треть шага, — трасса берёт сдвинутый провал за свою линию.
 */
const TORN_SHIFT = Math.round(0.3 * STEP);

/**
 * Пятно во всю ширину кадра, под которым не видно десяти линий из тридцати
 * четырёх. Трасса проходит его предсказанием, и на той стороне обязана выйти на
 * свою линию: перескочи она на соседнюю, номера линий разошлись бы с эталоном, а
 * восстановленные линии — на целый шаг.
 */
const SPOT: SyntheticArea = {
  left: 0,
  top: HEIGHT / 2 - 5 * STEP,
  right: WIDTH,
  bottom: HEIGHT / 2 + 5 * STEP,
  contrast: 0,
};

/**
 * Кадр фотографии для синтетики: вырезка занимает его целиком.
 */
const WHOLE_FRAME: PerspectiveFrame = { left: 0, top: 0, width: WIDTH, height: HEIGHT };

/**
 * Меряет перспективу листа, отдавая детектору ровный проход по нему: шаг, фазу,
 * наклон и поля, которыми лист нарисован.
 *
 * @param params — описание листа
 * @param frame — кадр фотографии, в который попала вырезка
 * @returns результат измерения
 */
const detect = (
  params: PerspectiveSheet,
  frame: PerspectiveFrame = WHOLE_FRAME
): RulingPerspectiveDetection => {
  const { step, phase, angle, margins } = params;

  return detectRulingPerspective(
    createSyntheticSheet(params),
    { step, firstLinePhase: phase, skewAngle: angle, margins },
    frame
  );
};

/**
 * Номера линий, нарисованных внутри полей листа.
 *
 * @param params — описание листа
 * @returns номера линий на гребёнке
 */
const toDrawnLines = (params: PerspectiveSheet): number[] => {
  const { step, phase, margins, height } = params;
  const first = Math.ceil((margins.top - phase) / step);
  const last = Math.floor((height - margins.bottom - phase) / step);

  return Array.from({ length: last - first + 1 }, (_item, index) => {
    return first + index;
  });
};

/**
 * Границы расхождения восстановленных линий с эталоном.
 */
type RestoreBounds = {
  /**
   * Наименьшее расхождение со знаком: линия ниже эталона — отрицательное.
   */
  min: number;

  /**
   * Наибольшее расхождение со знаком.
   */
  max: number;
};

/**
 * Расхождение линий, восстановленных по найденной разлиновке, с эталоном
 * синтетики — наименьшее и наибольшее со знаком, по каждому столбцу кадра и
 * каждой нарисованной линии. Проскользни трасса на соседнюю линию —
 * расхождение вышло бы в целый шаг.
 *
 * @param detection — результат измерения
 * @param reference — описание листа, линии которого служат эталоном
 * @returns границы расхождения в пикселях
 */
const collectRestoreBounds = (
  detection: RulingPerspectiveDetection,
  reference: PerspectiveSheet
): RestoreBounds => {
  const projection = {
    skewAngle: detection.skewAngle,
    perspective: detection.perspective,
  };

  return toDrawnLines(reference).reduce(
    (bounds, line) => {
      const coordinate = detection.firstLinePhase + line * detection.step;
      let { min, max } = bounds;

      for (let x = 0; x < WIDTH; x += 1) {
        const difference =
          lineHeightAt(projection, x, coordinate) -
          computeSyntheticLineY(reference, line, x);

        min = Math.min(min, difference);
        max = Math.max(max, difference);
      }

      return { min, max };
    },
    { min: Number.POSITIVE_INFINITY, max: Number.NEGATIVE_INFINITY }
  );
};

/**
 * Наибольшее расхождение восстановленных линий с эталоном.
 *
 * @param detection — результат измерения
 * @param reference — описание листа, линии которого служат эталоном
 * @returns расхождение в пикселях
 */
const measureRestoreError = (
  detection: RulingPerspectiveDetection,
  reference: PerspectiveSheet
): number => {
  const { min, max } = collectRestoreBounds(detection, reference);

  return Math.max(Math.abs(min), Math.abs(max));
};

/**
 * Разброс расхождения восстановленных линий с эталоном. Общий сдвиг гребёнки в
 * него не входит: с перспективы на изогнутом листе спрос только за форму
 * гребёнки, а сдвиг забирает себе изгиб, который меряется поверх неё.
 *
 * @param detection — результат измерения
 * @param reference — описание листа, линии которого служат эталоном
 * @returns разброс расхождения в пикселях
 */
const measureRestoreSpread = (
  detection: RulingPerspectiveDetection,
  reference: PerspectiveSheet
): number => {
  const { min, max } = collectRestoreBounds(detection, reference);

  return max - min;
};

/**
 * Срывает трассу у края листа: начиная с заданного столбца сдвигает вниз
 * участок растра вокруг каждой из заданных линий, так что провал линии
 * оказывается ниже своего места. Так выглядит узел, взятый трассой не у своей
 * линии.
 *
 * @param params — описание листа
 * @param lines — номера сдвигаемых линий
 * @param stripLeft — первый столбец сорванного участка
 * @returns растр листа с сорванным участком
 */
const createTornSheet = (
  params: PerspectiveSheet,
  lines: number[],
  stripLeft: number = TORN_STRIP_LEFT
): SheetImageData => {
  const image = createSyntheticSheet(params);
  const luminance = Float32Array.from(image.luminance);
  const halfStep = STEP / 2;

  lines.forEach((line) => {
    for (let x = stripLeft; x < WIDTH; x += 1) {
      const center = Math.round(computeSyntheticLineY(params, line, x));

      for (let y = center - halfStep + TORN_SHIFT; y <= center + halfStep; y += 1) {
        luminance[y * WIDTH + x] = image.luminance[(y - TORN_SHIFT) * WIDTH + x] || 0;
      }
    }
  });

  return { ...image, luminance };
};

const computeMean = (values: number[]): number => {
  return (
    values.reduce((sum, value) => {
      return sum + value;
    }, 0) / Math.max(1, values.length)
  );
};

/**
 * Наибольший отход линий листа от самой близкой к ним равномерной наклонной
 * гребёнки — то самое число, которым спека меряет порог хранения перспективы.
 *
 * Гребёнка ищется методом наименьших квадратов по сетке «линия × столбец».
 * Сетка полная, поэтому номер линии и столбец после вычитания средних
 * ортогональны, и шаг с наклоном находятся по отдельности, без решения системы.
 *
 * @param params — описание листа
 * @returns отход в пикселях
 */
const measureCombDeviation = (params: PerspectiveSheet): number => {
  const lines = toDrawnLines(params);
  const columns = [0, WIDTH / 4, WIDTH / 2, (3 * WIDTH) / 4, WIDTH - 1];
  const samples = lines.flatMap((line) => {
    return columns.map((x) => {
      return { line, x, y: computeSyntheticLineY(params, line, x) };
    });
  });
  const meanLine = computeMean(lines);
  const meanColumn = computeMean(columns);
  const meanHeight = computeMean(
    samples.map((sample) => {
      return sample.y;
    })
  );
  const totals = samples.reduce(
    (sums, { line, x, y }) => {
      return {
        lineMoment: sums.lineMoment + (line - meanLine) * (y - meanHeight),
        lineSquare: sums.lineSquare + (line - meanLine) ** 2,
        columnMoment: sums.columnMoment + (x - meanColumn) * (y - meanHeight),
        columnSquare: sums.columnSquare + (x - meanColumn) ** 2,
      };
    },
    { lineMoment: 0, lineSquare: 0, columnMoment: 0, columnSquare: 0 }
  );
  const step = totals.lineMoment / totals.lineSquare;
  const tangent = totals.columnMoment / totals.columnSquare;

  return samples.reduce((limit, { line, x, y }) => {
    const residual =
      y - meanHeight - step * (line - meanLine) - tangent * (x - meanColumn);

    return Math.max(limit, Math.abs(residual));
  }, 0);
};

/**
 * Лист, у которого перспектива должна найтись.
 */
type PerspectiveCase = {
  /**
   * Что на листе.
   */
  title: string;

  /**
   * Описание листа.
   */
  params: PerspectiveSheet;

  /**
   * Описание листа, линии которого служат эталоном: у листа с помехой это тот
   * же лист без неё.
   */
  reference: PerspectiveSheet;
};

const DRIFT_4_SHEET: PerspectiveSheet = { ...BASE_SHEET, rulingPerspective: DRIFT_4 };

const DRIFT_8_SHEET: PerspectiveSheet = { ...BASE_SHEET, rulingPerspective: DRIFT_8 };

/**
 * Дрейф 25 % — граница гарантии спеки: до неё точность восстановления линий
 * обещана, и такой лист обязан сохранить перспективу. Дрейф задан долей, а не
 * `convergenceY`: доля меряется там же, где её меряет детектор, — местным шагом
 * на крайних нарисованных линиях.
 */
const DRIFT_25_SHEET: PerspectiveSheet = { ...BASE_SHEET, stepDrift: 0.25 };

/**
 * Дрейф 34 % — у самой границы порога надёжности. Без него тест был бы зелёным
 * при любом пороге от гарантии спеки до отказного дрейфа и не сказал бы, где
 * порог стоит на самом деле.
 */
const DRIFT_34_SHEET: PerspectiveSheet = { ...BASE_SHEET, stepDrift: 0.34 };

/**
 * Дрейф 60 % — вдвое за порогом надёжности: так шаг по кадру меняется не у
 * тетради на столе, а у листа, по которому модель перспективы уже не строится.
 */
const DRIFT_60_SHEET: PerspectiveSheet = { ...BASE_SHEET, stepDrift: 0.6 };

const PERSPECTIVE_CASES: PerspectiveCase[] = [
  {
    title: 'линейка с дрейфом 4 %',
    params: DRIFT_4_SHEET,
    reference: DRIFT_4_SHEET,
  },
  {
    title: 'линейка с дрейфом 8 %',
    params: DRIFT_8_SHEET,
    reference: DRIFT_8_SHEET,
  },
  {
    title: 'линейка с дрейфом 25 %',
    params: DRIFT_25_SHEET,
    reference: DRIFT_25_SHEET,
  },
  {
    title: 'линейка с дрейфом 34 %',
    params: DRIFT_34_SHEET,
    reference: DRIFT_34_SHEET,
  },
  {
    title: 'клетка с дрейфом 4 %',
    params: { ...DRIFT_4_SHEET, kind: 'grid' },
    reference: { ...DRIFT_4_SHEET, kind: 'grid' },
  },
  {
    title: 'клетка с дрейфом 8 %',
    params: { ...DRIFT_8_SHEET, kind: 'grid' },
    reference: { ...DRIFT_8_SHEET, kind: 'grid' },
  },
  {
    title: 'дрейф 8 % с пятном на десяти линиях',
    params: { ...DRIFT_8_SHEET, lowContrastArea: SPOT },
    reference: DRIFT_8_SHEET,
  },
];

describe('detectRulingPerspective: перспектива найдена', () => {
  it.each(PERSPECTIVE_CASES)('$title: линии восстановлены', ({ params, reference }) => {
    const detection = detect(params);

    expect(detection.perspective).not.toBeNull();
    expect(measureRestoreError(detection, reference)).toBeLessThan(LINE_TOLERANCE);
  });

  it.each(PERSPECTIVE_CASES)('$title: линии прослежены', ({ params }) => {
    expect(detect(params).foundNodeShare).toBeGreaterThan(0.6);
  });

  /**
   * Две нижние линии в правой полосе сдвинуты на треть шага: невязка в этих
   * узлах выше порога, и без отброса выбросов перспектива пропала бы вместе с
   * ними. Узлов два из ста семидесяти — внутри запаса выбросов.
   */
  it('дрейф 5 % с сорванным участком трассы у края листа: линии восстановлены', () => {
    const params: PerspectiveSheet = { ...BASE_SHEET, rulingPerspective: DRIFT_5 };
    const { step, phase, angle, margins } = params;
    const lastLines = toDrawnLines(params).slice(-2);
    const detection = detectRulingPerspective(
      createTornSheet(params, lastLines),
      { step, firstLinePhase: phase, skewAngle: angle, margins },
      WHOLE_FRAME
    );

    expect(detection.perspective).not.toBeNull();
    expect(measureRestoreError(detection, params)).toBeLessThan(LINE_TOLERANCE);
  });

  /**
   * Изгиб уводит все линии столбца почти одинаково: подгонка забирает его
   * средний сдвиг в фазу, а проверка невязки — постоянную по столбцу часть.
   * Поэтому перспектива находится вместе с изгибом любой глубины, которую
   * принимает собственная проверка надёжности изгиба, — до полушага. Форму
   * гребёнки изгиб не меняет, а общий сдвиг снимет измерение изгиба: оно идёт
   * следом и поверх найденной перспективы.
   */
  it.each([0.2, 0.47])('дрейф 4 % с изгибом в %s шага: форма гребёнки та же', (share) => {
    const detection = detect({ ...DRIFT_4_SHEET, bend: toSag(share) });

    expect(detection.perspective).not.toBeNull();
    expect(detection.foundNodeShare).toBeGreaterThan(0.6);
    expect(measureRestoreSpread(detection, DRIFT_4_SHEET)).toBeLessThan(LINE_TOLERANCE);
  });
});

describe('detectRulingPerspective: перспектива отброшена', () => {
  /**
   * Подгонка за таким прогибом не идёт: он симметричен по ширине, а модель по
   * ширине наклонная, — и лист остаётся ровным по расхождению гребёнок, не
   * дотянувшему до порога хранения. Прогиб, за которым подгонка идёт, — ниже.
   */
  it('симметричный прогиб не выдаётся за перспективу', () => {
    const detection = detect({ ...BASE_SHEET, bend: TWISTED_SAG });

    expect(detection.deviation).toBeLessThan(STEP / 20);
    expect(detection.perspective).toBeNull();
  });

  it('прогиб с осью у правого края отбраковывается невязкой', () => {
    const detection = detect({ ...BASE_SHEET, bend: OFF_CENTRE_SAG });

    expect(detection.deviation).toBeGreaterThan(STEP / 20);
    expect(detection.perspective).toBeNull();
  });

  /**
   * Знаменатель модели проверяется по кадру фотографии, а не по вырезке: за её
   * краями фотография продолжается, и горизонт найденной перспективы может
   * лежать там. На настоящем снимке до горизонта тысячи пикселей, и раньше него
   * лист отбраковал бы дрейф шага, поэтому кадр здесь нарочно уведён далеко
   * вниз от вырезки.
   */
  it('горизонт перспективы в кадре за вырезкой не сохраняется', () => {
    const params: PerspectiveSheet = { ...BASE_SHEET, rulingPerspective: DRIFT_4 };
    const frame: PerspectiveFrame = { left: 0, top: 0, width: WIDTH, height: 60_000 };

    expect(detect(params).perspective).not.toBeNull();
    expect(detect(params, frame).perspective).toBeNull();
  });

  /**
   * Линии прослежены все до одной, и отбраковывает лист именно дрейф: за
   * порогом надёжности модель перспективы перестаёт описывать лист, а не
   * теряет трассу.
   */
  it('дрейф 60 % не сохраняется', () => {
    const detection = detect(DRIFT_60_SHEET);

    expect(detection.bottomStep / detection.topStep - 1).toBeGreaterThan(0.35);
    expect(detection.foundNodeShare).toBeGreaterThan(0.6);
    expect(detection.perspective).toBeNull();
  });

  /**
   * Трасса сорвана на половине кадра: в правой половине каждая вторая линия
   * сдвинута вниз на треть шага. Соседние линии расходятся сильнее четверти
   * шага, и постоянной по столбцу составляющей, которую невязке прощает изгиб,
   * такой сдвиг не становится. Дрейф самого листа — 25 %, внутри порога
   * надёжности: отбраковать лист может только невязка.
   */
  it('трасса, сорванная на половине кадра, не сохраняется', () => {
    const { step, phase, angle, margins } = DRIFT_25_SHEET;
    const tornLines = toDrawnLines(DRIFT_25_SHEET).filter((line) => {
      return line % 2 === 0;
    });
    const detection = detectRulingPerspective(
      createTornSheet(DRIFT_25_SHEET, tornLines, WIDTH / 2),
      { step, firstLinePhase: phase, skewAngle: angle, margins },
      WHOLE_FRAME
    );

    expect(detection.foundNodeShare).toBeGreaterThan(0.6);
    expect(detection.bottomStep / detection.topStep - 1).toBeLessThan(0.35);
    expect(detection.perspective).toBeNull();
  });

  /**
   * Прогиб с осью у правого края не ложится на модель ни при каких параметрах,
   * а дрейф листа — 25 %, внутри порога надёжности. Значит, лист отбраковывает
   * невязка, и поднятый порог дрейфа этого не меняет.
   */
  it('дрейф 25 % с прогибом, не согласным ни с одной перспективой, не сохраняется', () => {
    const detection = detect({ ...DRIFT_25_SHEET, bend: OFF_CENTRE_SAG });

    expect(detection.foundNodeShare).toBeGreaterThan(0.6);
    expect(detection.bottomStep / detection.topStep - 1).toBeLessThan(0.35);
    expect(detection.deviation).toBeGreaterThan(STEP / 20);
    expect(detection.perspective).toBeNull();
  });

  it('ровный лист остаётся ровным', () => {
    expect(detect(BASE_SHEET).perspective).toBeNull();
  });
});

describe('detectRulingPerspective: порог хранения', () => {
  it('отход меньше сороковой шага не сохраняется', () => {
    const params: PerspectiveSheet = {
      ...BASE_SHEET,
      rulingPerspective: DRIFT_BELOW_THRESHOLD,
    };

    expect(measureCombDeviation(params)).toBeLessThan(STEP / 40);
    expect(detect(params).perspective).toBeNull();
  });

  it('отход в пятнадцатую шага сохраняется', () => {
    const params: PerspectiveSheet = {
      ...BASE_SHEET,
      rulingPerspective: DRIFT_ABOVE_THRESHOLD,
    };
    const deviation = measureCombDeviation(params);

    expect(deviation).toBeGreaterThan(STEP / 20);
    expect(deviation).toBeLessThan(STEP / 10);
    expect(detect(params).perspective).not.toBeNull();
  });
});

describe('detectRulingPerspective: шаг меняется сильнее гарантии', () => {
  /**
   * Двукратное изменение шага по высоте — далеко за гарантией спеки в
   * двадцать пять процентов и за порогом надёжности. Спека разрешает оба
   * исхода, поэтому спрос один: перспектива, которая уводит линии дальше
   * двадцатой шага, храниться не должна. Отказ — не ошибка: детектор отдаёт
   * числа ровного прохода, и лист остаётся пригодным для раскладки.
   */
  it('двукратный дрейф: лист без перспективы либо линии в допуске', () => {
    const params: PerspectiveSheet = { ...BASE_SHEET, stepDrift: 1 };
    const detection = detect(params);
    const restoreError =
      detection.perspective === null ? 0 : measureRestoreError(detection, params);

    expect(detection.bottomStep / detection.topStep - 1).toBeGreaterThan(0.35);
    expect(restoreError).toBeLessThan(LINE_TOLERANCE);
    expect(detection.step).toBeGreaterThan(0);
  });
});
