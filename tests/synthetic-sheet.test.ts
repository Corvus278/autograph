import type {
  RulingPerspective,
  SheetImageData,
  SheetOutline,
} from '@pages/Generator/lib/paper';
import { LINE_SEARCH_SHARE } from '@pages/Generator/lib/paper/traceRulingLines';
import { describe, expect, it } from 'vitest';

import {
  ABSENT_MARGIN_LINE_SHEET,
  BLOTTED_DEEP_COLUMN_SHEET,
  BLOTTED_MARGIN_LINE_SHEET,
  computeSyntheticColumnX,
  computeSyntheticLineEnds,
  computeSyntheticLineY,
  computeSyntheticMarginLineX,
  computeSyntheticOutline,
  computeSyntheticPerspective,
  createSyntheticSheet,
  DEEP_COLUMN_SHEET,
  DRIFTING_MARGIN_LINE_SHEET,
  type SyntheticCalibrationSheet,
  type SyntheticMarginLineSheet,
  type SyntheticSheetParams,
} from './helpers/synthetic-sheet';

const WIDTH = 600;

const HEIGHT = 480;

const STEP = 30;

/**
 * Треть шага — изгиб, который измерение обязано держать у углов кадра.
 */
const BEND_AMPLITUDE = 0.3 * STEP;

/**
 * Глубина линии разлиновки по умолчанию у хелпера.
 */
const LINE_DARKNESS = 0.45;

/**
 * Полуокно центроида: меньше половины шага, чтобы соседняя линия в окно не
 * попала даже при изгибе.
 */
const CENTER_WINDOW = 12;

/**
 * Центр гауссианы по растру восстанавливается с точностью до тысячных; сотые
 * уже поймали бы изгиб, применённый не в той точке.
 */
const CENTER_TOLERANCE = 0.05;

/**
 * Конец линии обрезан по пикселю: первый тёмный пиксель лежит не дальше
 * пикселя от границы.
 */
const END_TOLERANCE = 1;

/**
 * Изгиб заметно больше допуска: иначе тест не отличил бы изогнутую линию от
 * прямой.
 */
const MIN_VISIBLE_BEND = 3;

/**
 * Доля высоты кадра от −1 у верха до 1 у низа.
 *
 * @param y — высота в кадре
 * @returns доля от −1 до 1
 */
const toHeightShare = (y: number): number => {
  return (2 * y) / HEIGHT - 1;
};

/**
 * Насколько пиксель темнее бумаги. Бумага в тестах без шума и света, поэтому
 * тёмное — это только нарисованное.
 *
 * @param image — кадр
 * @param x — столбец
 * @param y — строка
 * @returns глубина от 0 до 1
 */
const readLuminance = (image: SheetImageData, x: number, y: number): number => {
  return image.luminance[y * image.width + x] || 0;
};

/**
 * Насколько пиксель темнее бумаги. Бумага в тестах без шума и света, поэтому
 * тёмное — это только нарисованное.
 *
 * @param image — кадр
 * @param x — столбец
 * @param y — строка
 * @returns глубина от 0 до 1
 */
const readInk = (image: SheetImageData, x: number, y: number): number => {
  return 1 - readLuminance(image, x, y);
};

/**
 * Центр линии по растру: центроид тёмного в столбце. Меряется по растру, а не
 * возвратом функции смещения: иначе тест сверял бы эталон сам с собой и не
 * заметил бы, что отрисовка изгиб не применила.
 *
 * @param image — кадр
 * @param x — столбец
 * @param expectedY — ожидаемый центр, вокруг которого берётся окно
 * @returns высота центра линии
 */
const measureColumnCenter = (
  image: SheetImageData,
  x: number,
  expectedY: number
): number => {
  let weight = 0;
  let moment = 0;

  for (
    let y = Math.round(expectedY - CENTER_WINDOW);
    y <= Math.round(expectedY + CENTER_WINDOW);
    y += 1
  ) {
    const ink = readInk(image, x, y);

    weight += ink;
    moment += ink * y;
  }

  return moment / weight;
};

/**
 * Центр вертикальной линии по растру: центроид тёмного в строке.
 *
 * @param image — кадр
 * @param y — строка
 * @param expectedX — ожидаемый центр, вокруг которого берётся окно
 * @returns столбец центра линии
 */
const measureRowCenter = (
  image: SheetImageData,
  y: number,
  expectedX: number
): number => {
  let weight = 0;
  let moment = 0;

  for (
    let x = Math.round(expectedX - CENTER_WINDOW);
    x <= Math.round(expectedX + CENTER_WINDOW);
    x += 1
  ) {
    const ink = readInk(image, x, y);

    weight += ink;
    moment += ink * x;
  }

  return moment / weight;
};

/**
 * Крайние тёмные столбцы строки. `-1` — тёмного в строке нет.
 */
type InkSpan = {
  /**
   * Первый тёмный столбец.
   */
  first: number;

  /**
   * Последний тёмный столбец.
   */
  last: number;
};

/**
 * Первый и последний столбец строки, где чернил больше половины глубины линии.
 *
 * @param image — кадр
 * @param y — строка
 * @returns крайние тёмные столбцы
 */
const findInkSpan = (image: SheetImageData, y: number): InkSpan => {
  let first = -1;
  let last = -1;

  for (let x = 0; x < image.width; x += 1) {
    if (readInk(image, x, y) > LINE_DARKNESS / 2) {
      first = first < 0 ? x : first;
      last = x;
    }
  }

  return { first, last };
};

describe('createSyntheticSheet: изгиб горизонтальных линий', () => {
  /**
   * Перспектива: концы линий у верха и низа кадра уходят в разные стороны,
   * у середины ширины линия прямая.
   */
  const BENT_SHEET: SyntheticSheetParams = {
    width: WIDTH,
    height: HEIGHT,
    step: STEP,
    phase: 15,
    angle: 1,
    margins: { top: 30, right: 0, bottom: 30, left: 0 },
    bend: (x, y) => {
      return BEND_AMPLITUDE * ((2 * x) / WIDTH - 1) ** 2 * toHeightShare(y);
    },
  };

  it.each([1, 7, 14])(
    'центр линии %i в столбцах лежит на эталонном смещении',
    (index) => {
      const image = createSyntheticSheet(BENT_SHEET);

      [40, 300, 560].forEach((x) => {
        const expectedY = computeSyntheticLineY(BENT_SHEET, index, x);

        expect(
          Math.abs(measureColumnCenter(image, x, expectedY) - expectedY)
        ).toBeLessThan(CENTER_TOLERANCE);
      });
    }
  );

  it('эталон изогнутой линии отходит от прямой', () => {
    const bentY = computeSyntheticLineY(BENT_SHEET, 1, 40);
    const straightY = computeSyntheticLineY(
      {
        ...BENT_SHEET,
        bend: () => {
          return 0;
        },
      },
      1,
      40
    );

    expect(Math.abs(bentY - straightY)).toBeGreaterThan(MIN_VISIBLE_BEND);
  });
});

describe('createSyntheticSheet: изогнутые концы горизонтальных линий', () => {
  const ENDS_SHEET: SyntheticSheetParams = {
    width: WIDTH,
    height: HEIGHT,
    step: STEP,
    phase: 15,
    angle: 1,
    margins: { top: 30, right: 40, bottom: 30, left: 50 },
    lineEndsBend: {
      left: (y) => {
        return 40 * toHeightShare(y) ** 2;
      },
      right: (y) => {
        return -30 * (1 - toHeightShare(y) ** 2);
      },
    },
  };

  it.each([1, 7, 14])('концы линии %i лежат на эталонных границах', (index) => {
    const image = createSyntheticSheet(ENDS_SHEET);
    const leftRow = Math.round(computeSyntheticLineY(ENDS_SHEET, index, 60));
    const rightRow = Math.round(computeSyntheticLineY(ENDS_SHEET, index, WIDTH - 60));

    expect(
      Math.abs(
        findInkSpan(image, leftRow).first -
          computeSyntheticLineEnds(ENDS_SHEET, leftRow).left
      )
    ).toBeLessThanOrEqual(END_TOLERANCE);
    expect(
      Math.abs(
        findInkSpan(image, rightRow).last -
          computeSyntheticLineEnds(ENDS_SHEET, rightRow).right
      )
    ).toBeLessThanOrEqual(END_TOLERANCE);
  });

  it('эталонная граница концов отходит от прямой', () => {
    const { left } = computeSyntheticLineEnds(ENDS_SHEET, 45);
    const { left: straightLeft } = computeSyntheticLineEnds(
      { ...ENDS_SHEET, lineEndsBend: {} },
      45
    );

    expect(Math.abs(left - straightLeft)).toBeGreaterThan(MIN_VISIBLE_BEND);
  });
});

describe('createSyntheticSheet: изогнутые вертикали', () => {
  it('центр изогнутой линии поля в строках лежит на эталоне', () => {
    const params: SyntheticSheetParams = {
      width: WIDTH,
      height: HEIGHT,
      angle: 1,
      kind: 'blank',
      marginLineX: 90,
      marginLineBend: (y) => {
        return BEND_AMPLITUDE * toHeightShare(y) ** 2;
      },
    };
    const image = createSyntheticSheet(params);

    [40, 240, 440].forEach((y) => {
      const expectedX = computeSyntheticMarginLineX(params, y) || 0;

      expect(Math.abs(measureRowCenter(image, y, expectedX) - expectedX)).toBeLessThan(
        CENTER_TOLERANCE
      );
    });
    expect(
      Math.abs(
        (computeSyntheticMarginLineX(params, 40) || 0) -
          (90 - 40 * Math.tan(Math.PI / 180))
      )
    ).toBeGreaterThan(MIN_VISIBLE_BEND);
  });

  it('центр изогнутой крайней вертикали клетки в строках лежит на эталоне', () => {
    const params: SyntheticSheetParams = {
      width: WIDTH,
      height: HEIGHT,
      step: STEP,
      phase: 15,
      angle: 0.5,
      kind: 'grid',
      margins: { top: 30, right: 30, bottom: 30, left: 30 },
      columnBend: (x, y) => {
        return x < 60 ? BEND_AMPLITUDE * toHeightShare(y) ** 2 : 0;
      },
    };
    const image = createSyntheticSheet(params);

    [60, 180, 420].forEach((y) => {
      [1, 5, 18].forEach((index) => {
        const expectedX = computeSyntheticColumnX(params, index, y);

        expect(Math.abs(measureRowCenter(image, y, expectedX) - expectedX)).toBeLessThan(
          CENTER_TOLERANCE
        );
      });
    });
    expect(
      computeSyntheticColumnX(params, 1, 60) - (45 - 60 * Math.tan(Math.PI / 360))
    ).toBeGreaterThan(MIN_VISIBLE_BEND);
  });
});

/**
 * Яркость стола за листом: вдвое темнее бумаги, как на замерах фотографий.
 */
const SURFACE_BRIGHTNESS = 0.3;

/**
 * Обложка светлее стола, но темнее бумаги.
 */
const COVER_BRIGHTNESS = 0.55;

/**
 * Неравномерность освещения листа: без неё бумага упирается в единицу, и ничто
 * за контуром не может оказаться светлее её.
 */
const SHEET_LIGHTING = 0.35;

/**
 * Соседний лист за спиралью светлее бумаги у левого края ниже середины кадра —
 * там, где он и меряется: при `SHEET_LIGHTING` свет садится к низу и к правому
 * краю. У верхнего левого угла бумага пока светлее него. Поиск края, идущий
 * снаружи внутрь, принял бы такую полосу за бумагу.
 */
const NEIGHBOUR_BRIGHTNESS = 0.95;

/**
 * Контур листа: стороны наклонены к краям кадра, лист занимает большую часть
 * кадра.
 */
const SHEET_OUTLINE: SheetOutline = {
  topLeft: { x: 60, y: 50 },
  topRight: { x: 545, y: 40 },
  bottomRight: { x: 555, y: 440 },
  bottomLeft: { x: 70, y: 450 },
};

const SURFACE_SHEET: SyntheticSheetParams = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 15,
  angle: 0.5,
  lighting: SHEET_LIGHTING,
  margins: { top: 90, right: 80, bottom: 80, left: 100 },
  surface: {
    outline: SHEET_OUTLINE,
    cornerRadius: 12,
    brightness: SURFACE_BRIGHTNESS,
    cover: { side: 'right', width: 30, brightness: COVER_BRIGHTNESS },
    neighbour: { side: 'left', width: 40, brightness: NEIGHBOUR_BRIGHTNESS },
  },
  spiral: { x: 62, period: 37, phase: 10, radius: 5, darkness: 0.7 },
};

/**
 * Высота центра пятна спирали, лежащего поверх левого края листа.
 */
const SPIRAL_SPOT_Y = 232;

/**
 * Линия, по которой сверяется глубина чернил: первая нарисованная ниже
 * верхнего поля.
 */
const LINE_PROBE_INDEX = 3;

/**
 * Какая доля глубины линии достаётся ближайшей к её центру строке растра:
 * центр дробный, и строка отстоит от него до полупикселя.
 */
const INK_ON_LINE_SHARE = 0.8;

describe('createSyntheticSheet: лист на поверхности', () => {
  it.each([
    { place: 'стол сверху', x: 300, y: 10, expected: SURFACE_BRIGHTNESS },
    { place: 'стол снизу', x: 300, y: 470, expected: SURFACE_BRIGHTNESS },
    { place: 'стол за соседним листом', x: 10, y: 240, expected: SURFACE_BRIGHTNESS },
    { place: 'обложка справа', x: 565, y: 240, expected: COVER_BRIGHTNESS },
    { place: 'соседний лист слева', x: 40, y: 240, expected: NEIGHBOUR_BRIGHTNESS },
  ])('за контуром листа $place имеет свою яркость', ({ x, y, expected }) => {
    expect(readLuminance(createSyntheticSheet(SURFACE_SHEET), x, y)).toBeCloseTo(
      expected,
      3
    );
  });

  it('внутри контура между линиями лежит бумага без чернил', () => {
    const image = createSyntheticSheet(SURFACE_SHEET);
    const paper = readLuminance(image, 300, 122);
    const lineRow = Math.round(
      computeSyntheticLineY(SURFACE_SHEET, LINE_PROBE_INDEX, 300)
    );

    expect(paper).toBeGreaterThan(COVER_BRIGHTNESS);
    expect(paper - readLuminance(image, 300, lineRow)).toBeGreaterThan(
      LINE_DARKNESS * INK_ON_LINE_SHARE
    );
  });

  it('соседний лист светлее бумаги рядом с ним', () => {
    const image = createSyntheticSheet(SURFACE_SHEET);
    const paper = readLuminance(image, 120, 241);

    expect(readLuminance(image, 40, 240)).toBeGreaterThan(paper);
    expect(paper).toBeGreaterThan(COVER_BRIGHTNESS);
  });

  it('пятно спирали ложится поверх края листа', () => {
    expect(
      readLuminance(createSyntheticSheet(SURFACE_SHEET), 62, SPIRAL_SPOT_Y)
    ).toBeCloseTo(NEIGHBOUR_BRIGHTNESS - 0.7, 3);
  });

  it('эталонный контур — заданный, без поверхности — кадр целиком', () => {
    expect(computeSyntheticOutline(SURFACE_SHEET)).toEqual(SHEET_OUTLINE);
    expect(computeSyntheticOutline({ width: WIDTH, height: HEIGHT })).toEqual({
      topLeft: { x: 0, y: 0 },
      topRight: { x: WIDTH, y: 0 },
      bottomRight: { x: WIDTH, y: HEIGHT },
      bottomLeft: { x: 0, y: HEIGHT },
    });
  });
});

/**
 * Схождение линий по ширине и рост шага по высоте: шаг у нижних линий больше,
 * чем у верхних, на единицы процентов — как на снимке тетради телефоном.
 */
const PERSPECTIVE = { convergenceX: 0.00015, convergenceY: 0.00015 };

const PERSPECTIVE_SHEET: SyntheticSheetParams = {
  width: WIDTH,
  height: HEIGHT,
  step: STEP,
  phase: 15,
  angle: 1,
  margins: { top: 60, right: 0, bottom: 60, left: 0 },
  rulingPerspective: PERSPECTIVE,
};

const PERSPECTIVE_BENT_SHEET: SyntheticSheetParams = {
  ...PERSPECTIVE_SHEET,
  bend: (x, y) => {
    return 0.2 * STEP * ((2 * x) / WIDTH - 1) ** 2 * toHeightShare(y);
  },
};

/**
 * Пять столбцов от края до края: перспектива меняет положение линии по всей
 * ширине кадра, и середины мало.
 */
const PERSPECTIVE_COLUMNS = [30, 170, 300, 440, 570];

/**
 * Полпикселя — допуск задачи: перспектива, применённая не в той точке, уводит
 * линию на пиксели.
 */
const PERSPECTIVE_TOLERANCE = 0.5;

describe.each([
  { title: 'перспектива', params: PERSPECTIVE_SHEET },
  { title: 'перспектива и изгиб вместе', params: PERSPECTIVE_BENT_SHEET },
])('createSyntheticSheet: $title', ({ params }) => {
  it.each([2, 7, 13])('центр линии %i в пяти столбцах лежит на эталоне', (index) => {
    const image = createSyntheticSheet(params);

    PERSPECTIVE_COLUMNS.forEach((x) => {
      const expectedY = computeSyntheticLineY(params, index, x);

      expect(Math.abs(measureColumnCenter(image, x, expectedY) - expectedY)).toBeLessThan(
        PERSPECTIVE_TOLERANCE
      );
    });
  });
});

/**
 * Высота линии `Y(x, U)` при `PERSPECTIVE`, посчитанная по формуле проектного
 * решения вне хелпера и вне `lib/paper`. Растр и эталон хелпера считает одна
 * запись формулы, поэтому согласованная ошибка в ней взаимно сократилась бы и
 * проверками попадания на линии не ловилась — числа держат эту запись снаружи.
 */
const PERSPECTIVE_LINE_HEIGHTS = [
  { index: 2, x: 30, lineY: 85.691990606916988 },
  { index: 2, x: 570, lineY: 82.25915012737326 },
  { index: 7, x: 300, lineY: 230.25079740091678 },
  { index: 13, x: 30, lineY: 402.78588836734878 },
  { index: 13, x: 570, lineY: 426.60911908844582 },
];

describe('createSyntheticSheet: эталон перспективы', () => {
  it.each(PERSPECTIVE_LINE_HEIGHTS)(
    'эталон линии $index в столбце $x совпадает с числом по формуле перспективы',
    ({ index, x, lineY }) => {
      expect(computeSyntheticLineY(PERSPECTIVE_SHEET, index, x)).toBeCloseTo(lineY, 9);
    }
  );

  it('линия в перспективе отходит от равномерной гребёнки', () => {
    const bentY = computeSyntheticLineY(PERSPECTIVE_SHEET, 13, 570);
    const straightY = computeSyntheticLineY(
      { ...PERSPECTIVE_SHEET, rulingPerspective: null },
      13,
      570
    );

    expect(Math.abs(bentY - straightY)).toBeGreaterThan(MIN_VISIBLE_BEND);
  });

  it('эталонная перспектива отсчитана от середины кадра', () => {
    const expected: RulingPerspective = {
      originX: WIDTH / 2,
      originY: HEIGHT / 2,
      convergenceX: PERSPECTIVE.convergenceX,
      convergenceY: PERSPECTIVE.convergenceY,
    };

    expect(computeSyntheticPerspective(PERSPECTIVE_SHEET)).toEqual(expected);
    expect(computeSyntheticPerspective(SURFACE_SHEET)).toBeNull();
  });
});

describe('createSyntheticSheet: помехи у края листа', () => {
  it('рисует пятна спирали с заданным шагом', () => {
    const image = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      kind: 'blank',
      spiral: { x: 30, period: 37, phase: 10, radius: 6, darkness: 0.7 },
    });

    expect(readInk(image, 30, 47)).toBeGreaterThan(0.69);
    expect(readInk(image, 33, 196)).toBeGreaterThan(0.69);
    expect(readInk(image, 30, 65)).toBeLessThan(0.01);
    expect(readInk(image, 300, 47)).toBeLessThan(0.01);
  });

  it.each([
    {
      side: 'слева',
      marginLineX: 100,
      margins: { top: 30, right: 0, bottom: 30, left: 110 },
      outerX: 50,
    },
    {
      side: 'справа',
      marginLineX: 500,
      margins: { top: 30, right: 110, bottom: 30, left: 0 },
      outerX: 550,
    },
  ])(
    'рисует линейку другого шага за линией поля $side',
    ({ marginLineX, margins, outerX }) => {
      const image = createSyntheticSheet({
        width: WIDTH,
        height: HEIGHT,
        step: STEP,
        phase: 15,
        margins,
        marginLineX,
        outerRuling: { step: 17, phase: 4 },
      });

      expect(readInk(image, outerX, 38)).toBeGreaterThan(LINE_DARKNESS * 0.9);
      expect(readInk(image, 300, 38)).toBeLessThan(0.01);
      expect(readInk(image, 300, 45)).toBeGreaterThan(LINE_DARKNESS * 0.9);
    }
  );

  it('ослабляет линии в пятне пониженного контраста', () => {
    const image = createSyntheticSheet({
      width: WIDTH,
      height: HEIGHT,
      step: STEP,
      phase: 15,
      lowContrastArea: { left: 0, top: 100, right: 200, bottom: 300, contrast: 0.25 },
    });

    expect(readInk(image, 100, 135)).toBeCloseTo(LINE_DARKNESS * 0.25, 3);
    expect(readInk(image, 400, 135)).toBeCloseTo(LINE_DARKNESS, 3);
    expect(readInk(image, 100, 45)).toBeCloseTo(LINE_DARKNESS, 3);
  });
});

/**
 * Отпечаток растра — FNV-1a по байтам яркости. Хэш, а не массив чисел: растр
 * даже маленького листа — сотни тысяч отсчётов, а держать нужно ровно одно
 * утверждение — «ни один пиксель не сдвинулся».
 *
 * @param values — яркости пикселей листа
 * @returns отпечаток из восьми шестнадцатеричных цифр
 */
const hashLuminance = (values: Float32Array): string => {
  const bytes = new Uint8Array(values.buffer, values.byteOffset, values.byteLength);
  let hash = 0x81_1c_9d_c5;

  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01_00_01_93) >>> 0;
  }

  return hash.toString(16).padStart(8, '0');
};

/**
 * Лист с отпечатком его растра.
 */
type RasterFixture = {
  /**
   * Отпечаток растра, снятый до появления долей дрейфа и схождения.
   */
  digest: string;

  /**
   * Имя листа — по нему видно в отчёте, какая ветвь отрисовки разошлась.
   */
  name: string;

  /**
   * Описание листа.
   */
  params: SyntheticSheetParams;
};

/**
 * Листы, покрывающие все ветви отрисовки: прямая гребёнка, наклон с линией
 * поля, заданная напрямую перспектива, изгиб вместе с поверхностью и помехами.
 * Отпечатки сняты на базе прогона и вписаны литералами: пересчитай их новым
 * кодом — и проверка перестанет что-либо держать.
 */
const TILTED_MARGIN_LINE_DIGEST = 'a32a9a4b';

/**
 * Лист с наклонной разлиновкой и линией поля без сноса. Вынесен из списка
 * отпечатков: на нём же проверяется, что нулевой снос не двигает ни одного
 * пикселя, а отпечаток для этого нужен снятый до появления сноса.
 */
const TILTED_MARGIN_LINE_SHEET: SyntheticSheetParams = {
  width: 300,
  height: 400,
  step: 21.5,
  phase: 7.25,
  angle: 1.3,
  margins: { top: 30, right: 20, bottom: 40, left: 55 },
  marginLineX: 48,
  noise: 0.03,
  lighting: 0.25,
  seed: 7,
};

const RASTER_FIXTURES: RasterFixture[] = [
  { digest: 'c342f07d', name: 'defaults', params: {} },
  {
    digest: TILTED_MARGIN_LINE_DIGEST,
    name: 'linedTilted',
    params: TILTED_MARGIN_LINE_SHEET,
  },
  {
    digest: '3fb6f6ea',
    name: 'gridPerspective',
    params: {
      width: 360,
      height: 480,
      kind: 'grid',
      step: 26,
      phase: 5,
      angle: -0.8,
      margins: { top: 24, right: 18, bottom: 24, left: 30 },
      rulingPerspective: { convergenceX: 0.0004, convergenceY: 0.0006 },
      seed: 3,
    },
  },
  {
    digest: '0abf2a0d',
    name: 'surfaceSpiralBend',
    params: {
      width: 320,
      height: 420,
      step: 23,
      phase: 3.5,
      angle: 0.6,
      margins: { top: 40, right: 26, bottom: 36, left: 60 },
      marginLineX: 54,
      fade: 0.3,
      driftFrom: 300,
      drift: 2.5,
      noise: 0.02,
      seed: 11,
      bend: (x: number, y: number): number => {
        return 3 * Math.sin((x / 320) * Math.PI) + y * 0.001;
      },
      spiral: { x: 12, period: 31, radius: 4 },
      lowContrastArea: { left: 200, top: 40, right: 320, bottom: 200, contrast: 0.35 },
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
        vignette: 0.2,
        cover: { side: 'left', width: 6, brightness: 0.15 },
      },
    },
  },
];

/**
 * Лист, у которого гребёнка задана до числа: по ней считаются номера крайних
 * линий, между которыми и меряется дрейф.
 */
type CombSheet = SyntheticSheetParams & {
  /**
   * Высота кадра.
   */
  height: number;

  /**
   * Фаза разлиновки.
   */
  phase: number;

  /**
   * Шаг разлиновки.
   */
  step: number;
};

const DRIFT_SHARE = 0.25;

const CONVERGENCE_SHARE = 0.2;

const DRIFT_SHEET: CombSheet = {
  width: 420,
  height: 560,
  step: 24,
  phase: 12,
  stepDrift: DRIFT_SHARE,
};

const CONVERGENCE_SHEET: CombSheet = {
  width: 420,
  height: 560,
  step: 24,
  phase: 12,
  lineConvergence: CONVERGENCE_SHARE,
};

const HALVED_SHEET: SyntheticSheetParams = {
  width: 480,
  height: 400,
  step: 20,
  phase: 10,
  kind: 'grid',
  everySecondLineArea: { left: 240, top: 0, right: 479, bottom: 399, contrast: 0 },
};

/**
 * Столбцы листа «через одну», не попавшие на вертикаль клетки: на вертикали
 * чернила есть и там, где горизонтальная линия погашена.
 */
const HALVED_COLUMNS = { clear: 100, halved: 400 };

/**
 * Номера крайних линий листа без полей: первая и последняя, попавшие в кадр.
 * Дрейф отсчитывается между ними же — там его меряет и детектор перспективы.
 *
 * @param sheet — лист с заданной гребёнкой
 * @returns номера первой и последней линии на гребёнке
 */
const computeEdgeLines = ({ height, step, phase }: CombSheet): [number, number] => {
  return [Math.ceil(-phase / step), Math.floor((height - phase) / step)];
};

/**
 * Местный шаг разлиновки у линии: расстояние между местами полулинии выше и
 * полулинии ниже неё. Разность симметрична вокруг линии и потому меряет ту же
 * величину, что берёт детектор перспективы, а не промежуток до соседки,
 * сдвинутый на полшага вглубь листа.
 *
 * @param params — описание листа
 * @param index — номер линии на гребёнке
 * @param x — столбец кадра
 * @returns шаг в пикселях кадра
 */
const measureLocalStep = (
  params: SyntheticSheetParams,
  index: number,
  x: number
): number => {
  return (
    computeSyntheticLineY(params, index + 0.5, x) -
    computeSyntheticLineY(params, index - 0.5, x)
  );
};

/**
 * Прямоугольник кадра, в котором читается период тёмных строк.
 */
type ProbeArea = {
  /**
   * Нижний край, строка кадра, не включительно.
   */
  bottom: number;

  /**
   * Левый край, столбец кадра.
   */
  left: number;

  /**
   * Правый край, столбец кадра включительно.
   */
  right: number;

  /**
   * Верхний край, строка кадра.
   */
  top: number;
};

/**
 * Наименьший размах профиля, при котором он считается периодическим, а не
 * ровной бумагой. Провал полноширинной линии глубже трёх десятых, а зерно
 * бумаги, усреднённое по сотням столбцов, не даёт и сотой: пять сотых
 * отделяют одно от другого с запасом в обе стороны.
 */
const MIN_PROFILE_SWING = 0.05;

/**
 * Расстояния между соседними тёмными строками в прямоугольнике кадра: так
 * период разлиновки читается прямо с растра, без единой строки измерителя из
 * `src` — иначе проверки «через одну» и ловушек опирались бы на то, что им же
 * и предстоит проверять. Пусто — периодичности в прямоугольнике нет.
 *
 * Центром тёмной строки берётся середина участка ниже порога, а не местный
 * минимум профиля: у широкого штриха дно плоское, и зерно бумаги рассыпало бы
 * его на десяток минимумов подряд.
 *
 * @param image — кадр
 * @param area — прямоугольник кадра
 * @returns расстояния между соседними тёмными строками
 */
const measureRowGaps = (image: SheetImageData, area: ProbeArea): number[] => {
  const { width, luminance } = image;
  const { top, bottom, left, right } = area;
  const profile = new Float64Array(bottom - top);

  for (let y = top; y < bottom; y += 1) {
    let sum = 0;

    for (let x = left; x <= right; x += 1) {
      sum += luminance[y * width + x] || 0;
    }

    profile[y - top] = sum / (right - left + 1);
  }

  const darkest = Math.min(...profile);
  const swing = Math.max(...profile) - darkest;

  if (swing < MIN_PROFILE_SWING) {
    return [];
  }

  const threshold = darkest + swing / 2;
  const centers: number[] = [];
  let runStart = -1;

  for (let index = 0; index <= profile.length; index += 1) {
    const isDark = index < profile.length && (profile[index] || 0) < threshold;

    if (isDark && runStart < 0) {
      runStart = index;
    }

    if (!isDark && runStart >= 0) {
      centers.push((runStart + index - 1) / 2);
      runStart = -1;
    }
  }

  return centers.slice(1).map((center, index) => {
    return center - (centers[index] || 0);
  });
};

describe('createSyntheticSheet: дрейф шага и схождение линий', () => {
  it('без долей дрейфа и схождения рисует прежний растр до пикселя', () => {
    const digests = RASTER_FIXTURES.map(({ name, params }) => {
      return `${name} ${hashLuminance(createSyntheticSheet(params).luminance)}`;
    });

    expect(digests).toEqual(
      RASTER_FIXTURES.map(({ name, digest }) => {
        return `${name} ${digest}`;
      })
    );
  });

  it('растит шаг от верхней крайней линии к нижней на заданную долю', () => {
    const [topLine, bottomLine] = computeEdgeLines(DRIFT_SHEET);
    const topStep = measureLocalStep(DRIFT_SHEET, topLine, 210);
    const bottomStep = measureLocalStep(DRIFT_SHEET, bottomLine, 210);

    expect(bottomStep / topStep).toBeCloseTo(1 + DRIFT_SHARE, 4);
  });

  it('держит дрейф одинаковым по всей ширине кадра', () => {
    const [topLine, bottomLine] = computeEdgeLines(DRIFT_SHEET);
    const atLeft =
      measureLocalStep(DRIFT_SHEET, bottomLine, 0) /
      measureLocalStep(DRIFT_SHEET, topLine, 0);
    const atRight =
      measureLocalStep(DRIFT_SHEET, bottomLine, 419) /
      measureLocalStep(DRIFT_SHEET, topLine, 419);

    expect(atRight).toBeCloseTo(atLeft, 6);
  });

  it('сводит линии по ширине кадра на заданную долю', () => {
    const gapAtLeft = measureLocalStep(CONVERGENCE_SHEET, 10, 0);
    const gapAtRight = measureLocalStep(CONVERGENCE_SHEET, 10, 420);

    expect(gapAtRight / gapAtLeft).toBeCloseTo(1 - CONVERGENCE_SHARE, 6);
  });

  it('рисует линии с дрейфом и схождением там, где их ждёт эталон', () => {
    const params: SyntheticSheetParams = {
      ...DRIFT_SHEET,
      lineConvergence: CONVERGENCE_SHARE,
    };
    const image = createSyntheticSheet(params);

    for (const [index, x] of [
      [2, 30],
      [11, 210],
      [20, 400],
    ]) {
      const lineY = computeSyntheticLineY(params, index || 0, x || 0);
      const localStep = measureLocalStep(params, index || 0, x || 0);

      expect(readInk(image, x || 0, Math.round(lineY))).toBeGreaterThan(0.3);
      expect(readInk(image, x || 0, Math.round(lineY + localStep / 2))).toBeLessThan(
        0.05
      );
    }
  });
});

describe('createSyntheticSheet: лист, различимый через одну линию', () => {
  it('удваивает период разлиновки внутри прямоугольника', () => {
    const image = createSyntheticSheet(HALVED_SHEET);

    expect(
      new Set(measureRowGaps(image, { top: 0, bottom: 400, left: 0, right: 239 }))
    ).toEqual(new Set([20]));
    expect(
      new Set(measureRowGaps(image, { top: 0, bottom: 400, left: 240, right: 479 }))
    ).toEqual(new Set([40]));
  });

  it('гасит внутри прямоугольника линии нечётного номера, не трогая чётные', () => {
    const image = createSyntheticSheet(HALVED_SHEET);
    const { clear, halved } = HALVED_COLUMNS;
    const evenY = Math.round(computeSyntheticLineY(HALVED_SHEET, 4, halved));
    const oddY = Math.round(computeSyntheticLineY(HALVED_SHEET, 5, halved));

    expect(readInk(image, halved, evenY)).toBeGreaterThan(0.3);
    expect(readInk(image, halved, oddY)).toBeLessThan(0.05);
    expect(readInk(image, clear, oddY)).toBeGreaterThan(0.3);
  });
});

/**
 * Шаг, который на кадре 480×400 сошёл бы за настоящую разлиновку: ловушка
 * обязана спорить с разлиновкой на равных, иначе её отсекал бы не разбор
 * периода по высоте кадра, а неправдоподобность самого периода.
 */
const TRAP_STEP = 20;

/**
 * Глубина штриха ловушки — не ниже глубины линии разлиновки: иначе ловушку
 * отсекла бы сила сигнала, и проверка ничего не сказала бы о разборе по
 * высоте.
 */
const TRAP_DARKNESS = 0.5;

/**
 * Чистый лист с полосой печатного текста посередине кадра. Период у текста
 * настоящий, но живёт он только в своей полосе.
 */
const TEXT_TRAP_SHEET: SyntheticSheetParams = {
  width: 480,
  height: 400,
  kind: 'blank',
  noise: 0.02,
  seed: 5,
  textBand: {
    top: 140,
    bottom: 260,
    left: 60,
    right: 420,
    step: TRAP_STEP,
    strokeHeight: 11,
    pitch: 9,
    strokeWidth: 3,
    darkness: TRAP_DARKNESS,
  },
};

/**
 * Лист, у которого линии занимают лишь верхнюю половину кадра: нижнее поле во
 * всю вторую половину оставляет там чистую бумагу.
 */
const HALF_RULED_SHEET: SyntheticSheetParams = {
  width: 480,
  height: 400,
  step: TRAP_STEP,
  phase: 10,
  margins: { top: 0, right: 0, bottom: 200, left: 0 },
  noise: 0.02,
  seed: 9,
};

/**
 * Полоса кадра с текстом — по ней читается период самой ловушки.
 */
const TEXT_BAND_AREA: ProbeArea = { top: 140, bottom: 260, left: 60, right: 420 };

/**
 * Период тёмных строк в каждой из полос, на которые режется кадр по высоте:
 * медиана расстояний между соседними строками, ноль — периодичности в полосе
 * нет. Настоящая разлиновка даёт период во всех полосах и ряд, монотонный по
 * высоте; локальный источник периодичности — нет.
 *
 * @param image — кадр
 * @param count — число полос
 * @returns период в каждой полосе сверху вниз
 */
const measureBandPeriods = (image: SheetImageData, count: number): number[] => {
  const periods: number[] = [];

  for (let band = 0; band < count; band += 1) {
    const gaps = measureRowGaps(image, {
      top: Math.round((image.height * band) / count),
      bottom: Math.round((image.height * (band + 1)) / count),
      left: 0,
      right: image.width - 1,
    });
    const sorted = [...gaps].sort((first, second) => {
      return first - second;
    });

    periods.push(sorted[Math.floor(sorted.length / 2)] || 0);
  }

  return periods;
};

/**
 * Самые глубокие чернила в прямоугольнике кадра.
 *
 * @param image — кадр
 * @param area — прямоугольник кадра
 * @returns глубина от 0 до 1
 */
const measureDeepestInk = (image: SheetImageData, area: ProbeArea): number => {
  const { top, bottom, left, right } = area;
  let deepest = 0;

  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      deepest = Math.max(deepest, readInk(image, x, y));
    }
  }

  return deepest;
};

describe('createSyntheticSheet: ловушки для поиска периода', () => {
  it('полоса текста даёт период только в своей полосе кадра', () => {
    const image = createSyntheticSheet(TEXT_TRAP_SHEET);

    expect(new Set(measureRowGaps(image, TEXT_BAND_AREA))).toEqual(new Set([TRAP_STEP]));
    expect(measureBandPeriods(image, 4)).toEqual([0, TRAP_STEP, TRAP_STEP, 0]);
  });

  it('полоса текста не бледнее линий разлиновки', () => {
    const image = createSyntheticSheet(TEXT_TRAP_SHEET);

    expect(measureDeepestInk(image, TEXT_BAND_AREA)).toBeGreaterThanOrEqual(
      LINE_DARKNESS
    );
  });

  it('половина кадра без линий оставляет период только в другой половине', () => {
    const image = createSyntheticSheet(HALF_RULED_SHEET);

    expect(
      new Set(measureRowGaps(image, { top: 0, bottom: 200, left: 0, right: 479 }))
    ).toEqual(new Set([TRAP_STEP]));
    expect(measureRowGaps(image, { top: 200, bottom: 400, left: 0, right: 479 })).toEqual(
      []
    );
    expect(measureBandPeriods(image, 4)).toEqual([TRAP_STEP, TRAP_STEP, 0, 0]);
  });

  it('линии разлиновки во весь кадр дают период во всех полосах', () => {
    const image = createSyntheticSheet({
      ...HALF_RULED_SHEET,
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    expect(measureBandPeriods(image, 4)).toEqual([
      TRAP_STEP,
      TRAP_STEP,
      TRAP_STEP,
      TRAP_STEP,
    ]);
  });
});

/**
 * Снос черты поля в долях шага: полтора шага размывают профиль столбцов во всю
 * высоту до неразличимости, на таком листе и проверяется полосовой поиск.
 */
const MARGIN_LINE_DRIFT_SHARE = 1.5;

const DRIFT_ONLY_STEP = 40;

/**
 * Лист без разлиновки с одной снесённой чертой поля: геометрия сноса меряется
 * там, где в окно центроида не попадает ни одна чужая линия.
 */
const DRIFTING_MARGIN_LINE_ONLY_SHEET: SyntheticSheetParams = {
  width: 600,
  height: 800,
  step: DRIFT_ONLY_STEP,
  kind: 'blank',
  margins: { top: 60, right: 60, bottom: 60, left: 60 },
  marginLineX: 110,
  marginLineDrift: MARGIN_LINE_DRIFT_SHARE,
};

/**
 * Последний столбец кадра: черта ищется по всей ширине, а не около эталонного
 * места.
 */
const DRIFT_SEARCH_END = 599;

/**
 * Строки, на которых меряется снос: верхняя и нижняя границы области с
 * линиями, между ними снос набирается целиком.
 */
const DRIFT_TOP_ROW = 60;

const DRIFT_BOTTOM_ROW = 740;

/**
 * Строки замера на листе калибровки: середины промежутков между
 * горизонтальными линиями. На самой линии чернила складываются с чертой, и
 * замер мерил бы сумму двух.
 */
const CALIBRATION_TOP_ROW = 80;

const CALIBRATION_BOTTOM_ROW = 720;

/**
 * Столбец, правее которого черта со сносом не достаёт ни сама, ни точками
 * фона: левее него глубины вертикалей двух листов сравнивать нельзя.
 */
const BEYOND_MARGIN_LINE_X = 220;

/**
 * Разброс глубин вертикалей на листе без черты: не больше четверти от самой
 * глубокой. Больший разброс означал бы, что отрицательный класс отсекается
 * разницей контраста, а не барьером глубины.
 */
const MAX_COLUMN_DEPTH_SPREAD = 0.25;

/**
 * Порог «чернила есть»: девять десятых глубины черты. Ниже порога — только
 * неравномерный свет и зерно.
 */
const MARGIN_LINE_INK = 0.63;

/**
 * Порог «чернил нет»: свет и зерно листа калибровки в сумме дают меньше.
 */
const BLANK_INK = 0.2;

/**
 * Столбец черты поля в строке: сначала самый тёмный столбец в заданном отрезке,
 * потом центроид вокруг него. Отрезок, а не эталонное место: окно, поставленное
 * по эталону, само задавало бы ответ, и сноса, которого отрисовка не применила,
 * тест бы не заметил.
 *
 * @param image — кадр
 * @param y — строка
 * @param from — начало отрезка поиска
 * @param to — конец отрезка поиска
 * @returns столбец центра черты
 */
const findMarginLineColumn = (
  image: SheetImageData,
  y: number,
  from: number,
  to: number
): number => {
  let darkest = from;

  for (let x = from; x <= to; x += 1) {
    if (readInk(image, x, y) > readInk(image, darkest, y)) {
      darkest = x;
    }
  }

  return measureRowCenter(image, y, darkest);
};

/**
 * Средняя яркость каждого столбца по области с линиями. Среднее по строкам, а
 * не одна строка: вертикаль видна в каждой строке одинаково, а зерно и
 * горизонтальные линии усредняются.
 *
 * @param image — кадр
 * @param fromY — первая строка области
 * @param toY — последняя строка области
 * @returns яркость по столбцам
 */
const measureColumnProfile = (
  image: SheetImageData,
  fromY: number,
  toY: number
): number[] => {
  const profile: number[] = [];

  for (let x = 0; x < image.width; x += 1) {
    let sum = 0;

    for (let y = fromY; y <= toY; y += 1) {
      sum += readLuminance(image, x, y);
    }

    profile.push(sum / (toY - fromY + 1));
  }

  return profile;
};

/**
 * Глубина вертикали в профиле: фон берётся в полушаге по обе стороны, где
 * вертикалей нет. Два отсчёта, а не один: неравномерный свет по ширине кадра
 * линеен, и симметричная пара его снимает.
 *
 * @param profile — яркость по столбцам
 * @param center — столбец вертикали
 * @param half — полушага
 * @returns насколько вертикаль темнее фона
 */
const measureColumnDepth = (profile: number[], center: number, half: number): number => {
  const background = ((profile[center - half] || 0) + (profile[center + half] || 0)) / 2;

  return background - (profile[center] || 0);
};

/**
 * Глубины вертикалей клетки, у которых и центр, и обе точки фона лежат внутри
 * области с линиями.
 *
 * @param image — кадр
 * @param sheet — лист калибровки
 * @param fromX — левая граница отбора вертикалей
 * @returns глубины по возрастанию столбца
 */
const measureColumnDepths = (
  image: SheetImageData,
  sheet: SyntheticCalibrationSheet,
  fromX: number
): number[] => {
  const { height, margins, phase, step, width } = sheet;
  const profile = measureColumnProfile(image, margins.top, height - margins.bottom);
  const half = step / 2;
  const depths: number[] = [];

  for (
    let center = phase + Math.ceil((margins.left + half - phase) / step) * step;
    center + half <= width - margins.right;
    center += step
  ) {
    if (center >= fromX) {
      depths.push(measureColumnDepth(profile, center, half));
    }
  }

  return depths;
};

describe('createSyntheticSheet: снос линии поля', () => {
  it('при нулевом сносе рисует прежний растр до пикселя', () => {
    const image = createSyntheticSheet({
      ...TILTED_MARGIN_LINE_SHEET,
      marginLineDrift: 0,
    });

    expect(hashLuminance(image.luminance)).toBe(TILTED_MARGIN_LINE_DIGEST);
  });

  it('разводит столбец черты сверху и снизу области на заданное число пикселей', () => {
    const image = createSyntheticSheet(DRIFTING_MARGIN_LINE_ONLY_SHEET);
    const topX = findMarginLineColumn(image, DRIFT_TOP_ROW, 0, DRIFT_SEARCH_END);
    const bottomX = findMarginLineColumn(image, DRIFT_BOTTOM_ROW, 0, DRIFT_SEARCH_END);

    expect(bottomX - topX).toBeCloseTo(MARGIN_LINE_DRIFT_SHARE * DRIFT_ONLY_STEP, 2);
  });

  it('ведёт черту по эталону в каждой строке области', () => {
    const image = createSyntheticSheet(DRIFTING_MARGIN_LINE_ONLY_SHEET);

    [DRIFT_TOP_ROW, 400, DRIFT_BOTTOM_ROW].forEach((y) => {
      const expectedX = computeSyntheticMarginLineX(DRIFTING_MARGIN_LINE_ONLY_SHEET, y);

      expect(
        Math.abs(findMarginLineColumn(image, y, 0, DRIFT_SEARCH_END) - (expectedX || 0))
      ).toBeLessThan(CENTER_TOLERANCE);
    });
  });
});

describe('createSyntheticSheet: листы калибровки поиска линии поля', () => {
  it('ведёт черту листа со сносом мимо её места у верхней границы', () => {
    const image = createSyntheticSheet(DRIFTING_MARGIN_LINE_SHEET);
    const { marginLineX } = DRIFTING_MARGIN_LINE_SHEET;

    [CALIBRATION_TOP_ROW, CALIBRATION_BOTTOM_ROW].forEach((y) => {
      const expectedX = computeSyntheticMarginLineX(DRIFTING_MARGIN_LINE_SHEET, y) || 0;

      expect(readInk(image, Math.round(expectedX), y)).toBeGreaterThan(MARGIN_LINE_INK);
    });
    expect(readInk(image, marginLineX, CALIBRATION_BOTTOM_ROW)).toBeLessThan(BLANK_INK);
  });

  it('держит глубины вертикалей листа без черты в пределах четверти', () => {
    const image = createSyntheticSheet(ABSENT_MARGIN_LINE_SHEET);
    const depths = measureColumnDepths(image, ABSENT_MARGIN_LINE_SHEET, 0);
    const deepest = Math.max(...depths);

    expect(depths.length).toBeGreaterThan(5);
    expect(Math.min(...depths)).toBeGreaterThan(BLANK_INK);
    expect((deepest - Math.min(...depths)) / deepest).toBeLessThan(
      MAX_COLUMN_DEPTH_SPREAD
    );
  });

  it('не отличается от листа с чертой ни зерном, ни контрастом вертикалей', () => {
    const absent = createSyntheticSheet(ABSENT_MARGIN_LINE_SHEET);
    const drifting = createSyntheticSheet(DRIFTING_MARGIN_LINE_SHEET);

    expect(computeSyntheticMarginLineX(ABSENT_MARGIN_LINE_SHEET, 400)).toBeNull();
    expect(
      measureColumnDepths(drifting, DRIFTING_MARGIN_LINE_SHEET, BEYOND_MARGIN_LINE_X)
    ).toEqual(
      measureColumnDepths(absent, ABSENT_MARGIN_LINE_SHEET, BEYOND_MARGIN_LINE_X)
    );
  });
});

/**
 * Высота полосы трассировки в шагах — та же, по которой детектор ведёт
 * вертикальную границу. Литералом: константа детектора не вынесена в его
 * публичное API, а полосы обязаны совпасть, иначе пропажа черты пришлась бы на
 * половины полос.
 */
const TRACE_BAND_STEPS = 1.5;

/**
 * Первая и следующая за последней полоса, накрытая пятном.
 */
const BLOTTED_BAND_FROM = 4;

const BLOTTED_BAND_TO = 8;

/**
 * Доля типичной глубины, ниже которой черта под пятном обязана пропасть.
 */
const BLOTTED_DEPTH_SHARE = 0.1;

/**
 * Насколько глубина ловушки вправе разойтись с глубиной черты. Не ноль: центр
 * черты дробный, и отсчёт в целом столбце берёт у гауссианы чуть меньше пика.
 */
const DEPTH_MATCH_SHARE = 0.1;

/**
 * Во сколько раз кандидат обязан быть глубже соседей, чтобы нынешний барьер
 * его пропустил. Лист-ловушка барьер обязан проходить: иначе различителю фазы
 * на нём нечего разбирать — кандидата свяжет глубина.
 */
const TRAP_DEPTH_RATIO = 1.5;

/**
 * Вертикаль клетки в стороне от пятна и от черты: по ней меряется глубина
 * соседей той же полосовой мерой, что и у кандидата.
 */
const PEER_COLUMN_X = 300;

/**
 * Столбец черты или вертикали на строке кадра.
 */
type SyntheticColumnAt = (y: number) => number;

/**
 * Глубина тёмной вертикали в строке: фон — полушага по обе стороны.
 *
 * @param image — кадр
 * @param x — столбец вертикали
 * @param y — строка
 * @param half — полушага, целое число столбцов
 * @returns насколько вертикаль темнее фона
 */
const measureRowDepth = (
  image: SheetImageData,
  x: number,
  y: number,
  half: number
): number => {
  const background =
    (readLuminance(image, x - half, y) + readLuminance(image, x + half, y)) / 2;

  return background - readLuminance(image, x, y);
};

/**
 * Глубина вертикали по полосам области с линиями. Столбец берётся на каждой
 * строке заново, поэтому снос черты в полосе не размывает её глубину — так же
 * её меряет и трасса.
 *
 * @param image — кадр
 * @param sheet — лист калибровки
 * @param columnAt — столбец вертикали на строке
 * @returns глубины по полосам сверху вниз
 */
const measureBandDepths = (
  image: SheetImageData,
  sheet: SyntheticCalibrationSheet,
  columnAt: SyntheticColumnAt
): number[] => {
  const { height, margins, step } = sheet;
  const bandHeight = Math.round(TRACE_BAND_STEPS * step);
  const half = Math.round(step / 2);
  const depths: number[] = [];

  for (
    let top = margins.top;
    top + bandHeight <= height - margins.bottom;
    top += bandHeight
  ) {
    let sum = 0;

    for (let y = top; y < top + bandHeight; y += 1) {
      sum += measureRowDepth(image, Math.round(columnAt(y)), y, half);
    }

    depths.push(sum / bandHeight);
  }

  return depths;
};

/**
 * Середина набора. Медиана, а не среднее и не наибольшее: там, где черта
 * проходит по вертикали клетки, глубина в полосе складывается из двух линий, и
 * одна такая полоса увела бы типичную глубину.
 *
 * @param values — набор
 * @returns серединное значение
 */
const computeMedian = (values: number[]): number => {
  const sorted = [...values].sort((first, second) => {
    return first - second;
  });

  return sorted[Math.floor(sorted.length / 2)] || 0;
};

/**
 * Столбец черты листа на строке кадра.
 *
 * @param sheet — лист с чертой
 * @returns столбец черты на строке
 */
const createMarginLineColumnAt = (sheet: SyntheticMarginLineSheet): SyntheticColumnAt => {
  return (y: number): number => {
    return computeSyntheticMarginLineX(sheet, y) || 0;
  };
};

describe('createSyntheticSheet: черта под пятном', () => {
  it('гасит черту в четырёх полосах подряд ниже десятой доли типичной', () => {
    const image = createSyntheticSheet(BLOTTED_MARGIN_LINE_SHEET);
    const depths = measureBandDepths(
      image,
      BLOTTED_MARGIN_LINE_SHEET,
      createMarginLineColumnAt(BLOTTED_MARGIN_LINE_SHEET)
    );
    const blotted = depths.slice(BLOTTED_BAND_FROM, BLOTTED_BAND_TO);
    const typical = computeMedian([
      ...depths.slice(0, BLOTTED_BAND_FROM),
      ...depths.slice(BLOTTED_BAND_TO),
    ]);

    expect(blotted).toHaveLength(BLOTTED_BAND_TO - BLOTTED_BAND_FROM);
    expect(typical).toBeGreaterThan(MARGIN_LINE_INK);
    expect(Math.max(...blotted)).toBeLessThan(typical * BLOTTED_DEPTH_SHARE);
  });

  it('накрывает черту шире окна продолжения трассы с обеих сторон', () => {
    const { blotArea, step } = BLOTTED_MARGIN_LINE_SHEET;
    const columnAt = createMarginLineColumnAt(BLOTTED_MARGIN_LINE_SHEET);
    const reach = step * LINE_SEARCH_SHARE;

    [blotArea.top, blotArea.bottom].forEach((y) => {
      expect(columnAt(y) - blotArea.left).toBeGreaterThan(reach);
      expect(blotArea.right - columnAt(y)).toBeGreaterThan(reach);
    });
  });
});

describe('createSyntheticSheet: глубокая вертикаль на фазе гребёнки', () => {
  it('ставит самую глубокую вертикаль ближе шестой доли шага к фазе', () => {
    const image = createSyntheticSheet(DEEP_COLUMN_SHEET);
    const { height, margins, phase, step, width } = DEEP_COLUMN_SHEET;
    const profile = measureColumnProfile(image, margins.top, height - margins.bottom);
    const half = Math.round(step / 2);
    let deepest = margins.left + half;

    for (let x = margins.left + half; x <= width - margins.right - half; x += 1) {
      if (
        measureColumnDepth(profile, x, half) > measureColumnDepth(profile, deepest, half)
      ) {
        deepest = x;
      }
    }

    const offset = deepest - phase - Math.round((deepest - phase) / step) * step;

    expect(deepest).toBe(DEEP_COLUMN_SHEET.deepColumn.x);
    expect(Math.abs(offset)).toBeLessThan(step * LINE_SEARCH_SHARE);
  });

  it('поднимает глубокую вертикаль выше барьера по соседям', () => {
    const image = createSyntheticSheet(DEEP_COLUMN_SHEET);
    const depths = measureColumnDepths(image, DEEP_COLUMN_SHEET, 0);
    const deepest = Math.max(...depths);
    const peers = depths.filter((depth) => {
      return depth < deepest;
    });

    expect(deepest / Math.max(...peers)).toBeGreaterThan(TRAP_DEPTH_RATIO);
  });

  it('не отличается от листа без черты ни зерном, ни контрастом соседей', () => {
    const deep = createSyntheticSheet(DEEP_COLUMN_SHEET);
    const absent = createSyntheticSheet(ABSENT_MARGIN_LINE_SHEET);

    expect(computeSyntheticMarginLineX(DEEP_COLUMN_SHEET, 400)).toBeNull();
    expect(measureColumnDepths(deep, DEEP_COLUMN_SHEET, BEYOND_MARGIN_LINE_X)).toEqual(
      measureColumnDepths(absent, ABSENT_MARGIN_LINE_SHEET, BEYOND_MARGIN_LINE_X)
    );
  });

  it('прячет фантом под пятном от профиля во всю высоту, оставляя его в полосах', () => {
    const { deepColumn } = BLOTTED_DEEP_COLUMN_SHEET;
    const image = createSyntheticSheet(BLOTTED_DEEP_COLUMN_SHEET);
    const profileDepths = measureColumnDepths(image, BLOTTED_DEEP_COLUMN_SHEET, 0);
    const trapProfile = Math.max(...profileDepths);
    const peerProfile = Math.max(
      ...profileDepths.filter((depth) => {
        return depth < trapProfile;
      })
    );
    const trapBands = measureBandDepths(image, BLOTTED_DEEP_COLUMN_SHEET, () => {
      return deepColumn.x;
    });
    const peerBands = measureBandDepths(image, BLOTTED_DEEP_COLUMN_SHEET, () => {
      return PEER_COLUMN_X;
    });
    const visible = [
      ...trapBands.slice(0, BLOTTED_BAND_FROM),
      ...trapBands.slice(BLOTTED_BAND_TO),
    ];

    expect(trapProfile / peerProfile).toBeLessThan(TRAP_DEPTH_RATIO);
    expect(computeMedian(visible) / computeMedian(peerBands)).toBeGreaterThan(
      TRAP_DEPTH_RATIO
    );
  });

  it('держит глубину ловушки вровень с глубиной черты', () => {
    const { deepColumn } = DEEP_COLUMN_SHEET;
    const trap = computeMedian(
      measureBandDepths(
        createSyntheticSheet(DEEP_COLUMN_SHEET),
        DEEP_COLUMN_SHEET,
        () => {
          return deepColumn.x;
        }
      )
    );
    const marginLine = computeMedian(
      measureBandDepths(
        createSyntheticSheet(DRIFTING_MARGIN_LINE_SHEET),
        DRIFTING_MARGIN_LINE_SHEET,
        createMarginLineColumnAt(DRIFTING_MARGIN_LINE_SHEET)
      )
    );

    expect(Math.abs(trap - marginLine) / marginLine).toBeLessThan(DEPTH_MATCH_SHARE);
  });
});
