import type {
  RulingBend,
  RulingPerspective,
  RulingProjection,
} from '@pages/Generator/lib/paper';
import {
  buildSheetRuling,
  sampleRulingBend,
  sampleRulingBendSlope,
} from '@pages/Generator/lib/paper';
import { describe, expect, it } from 'vitest';

/**
 * Узлы строки несимметричны, строки узлов разные: перепутанный порядок узлов
 * или строка, выбранная по высоте вместо координаты вдоль линий, дают другое
 * значение.
 */
const BEND: RulingBend = {
  columnOrigin: 140,
  columnSpacing: 90,
  columnCount: 4,
  rowOrigin: 213,
  rowSpacing: 40,
  rowCount: 2,
  offsets: [1.25, -0.5, 2.75, 0.1, -1.5, 3.2, 0.4, -2.05],
};

/**
 * Наклон у предела поиска угла: у последнего узла прямая линия уходит по
 * высоте на треть расстояния между строками узлов, и выборка по высоте вместо
 * координаты вдоль линий смешала бы строки.
 */
const SKEW_ANGLE = 2;
const TILT = Math.tan((SKEW_ANGLE * Math.PI) / 180);

const STRAIGHT_PROJECTION: RulingProjection = { skewAngle: 0, perspective: null };

const SKEWED_PROJECTION: RulingProjection = {
  skewAngle: SKEW_ANGLE,
  perspective: null,
};

const LAST_COLUMN = BEND.columnCount - 1;
const LAST_ROW = BEND.rowCount - 1;

/**
 * Четыре узла отрезка кривой Катмулла — Рома: кривая идёт между вторым и
 * третьим.
 */
type Segment = [number, number, number, number];

const readNode = (row: number, column: number): number => {
  return BEND.offsets[row * BEND.columnCount + column] || 0;
};

const toNodeX = (column: number): number => {
  return BEND.columnOrigin + column * BEND.columnSpacing;
};

const toRowU = (row: number): number => {
  return BEND.rowOrigin + row * BEND.rowSpacing;
};

/**
 * Равномерный Катмулл — Ром, посчитанный по формуле кривой, а не выборкой:
 * эталон для точек между узлами.
 */
const computeCatmullRom = ([p0, p1, p2, p3]: Segment, t: number): number => {
  return (
    0.5 *
    (2 * p1 +
      (p2 - p0) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t ** 2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
  );
};

/**
 * Смещение на ровном листе на высоте первой строки узлов.
 */
const sampleFirstRow = (x: number): number => {
  return sampleRulingBend(BEND, STRAIGHT_PROJECTION, x, toRowU(0));
};

describe('выборка изгиба', () => {
  it('в узле возвращает сам узел', () => {
    for (let row = 0; row <= LAST_ROW; row += 1) {
      for (let column = 0; column <= LAST_COLUMN; column += 1) {
        expect(
          sampleRulingBend(BEND, STRAIGHT_PROJECTION, toNodeX(column), toRowU(row))
        ).toBeCloseTo(readNode(row, column), 9);
      }
    }
  });

  it('между узлами строки идёт по Катмуллу — Рому с зеркальными фантомными узлами', () => {
    const p0 = readNode(0, 0);
    const p1 = readNode(0, 1);
    const p2 = readNode(0, 2);
    const p3 = readNode(0, 3);

    /**
     * Фантомные узлы за краями повторяют соседа крайнего узла: `P₋₁ = P₁`,
     * `P₄ = P₂`.
     */
    const segments: Segment[] = [
      [p1, p0, p1, p2],
      [p0, p1, p2, p3],
      [p1, p2, p3, p2],
    ];

    for (const [index, segment] of segments.entries()) {
      for (const t of [0.25, 0.5, 0.8]) {
        const x = toNodeX(index) + t * BEND.columnSpacing;

        expect(sampleFirstRow(x)).toBeCloseTo(computeCatmullRom(segment, t), 9);
      }
    }
  });

  it('между строками узлов смешивает строки линейно по координате вдоль линий', () => {
    const weight = 0.3;

    for (let column = 0; column <= LAST_COLUMN; column += 1) {
      const x = toNodeX(column);
      const u = toRowU(0) + weight * BEND.rowSpacing;
      const expected = (1 - weight) * readNode(0, column) + weight * readNode(1, column);

      expect(sampleRulingBend(BEND, SKEWED_PROJECTION, x, u + x * TILT)).toBeCloseTo(
        expected,
        9
      );
    }
  });

  it('за крайними узлами держит значение ближайшего узла', () => {
    const cases = [
      { x: 0, u: toRowU(0), row: 0, column: 0 },
      { x: toNodeX(0) - 30, u: toRowU(LAST_ROW), row: LAST_ROW, column: 0 },
      { x: toNodeX(LAST_COLUMN) + 45, u: toRowU(0), row: 0, column: LAST_COLUMN },
      { x: 1600, u: toRowU(LAST_ROW), row: LAST_ROW, column: LAST_COLUMN },
      { x: toNodeX(1), u: toRowU(0) - 100, row: 0, column: 1 },
      { x: toNodeX(2), u: toRowU(LAST_ROW) + 200, row: LAST_ROW, column: 2 },
      { x: -50, u: -50, row: 0, column: 0 },
    ];

    for (const { x, u, row, column } of cases) {
      expect(sampleRulingBend(BEND, SKEWED_PROJECTION, x, u + x * TILT)).toBeCloseTo(
        readNode(row, column),
        9
      );
    }
  });

  it('производная непрерывна на крайнем узле: разности слева и справа сходятся к нулю', () => {
    for (const column of [0, LAST_COLUMN]) {
      const x = toNodeX(column);
      const center = sampleFirstRow(x);
      let previous = Number.POSITIVE_INFINITY;

      for (const h of [10, 1, 0.1, 0.01]) {
        const left = Math.abs(center - sampleFirstRow(x - h)) / h;
        const right = Math.abs(sampleFirstRow(x + h) - center) / h;
        const difference = Math.max(left, right);

        expect(difference).toBeLessThan(previous);
        previous = difference;
      }

      /**
       * Ненулевая касательная в крайнем узле — полразности соседних узлов на
       * расстояние между ними — оставила бы здесь сотые.
       */
      expect(previous).toBeLessThan(1e-4);
      expect(sampleRulingBendSlope(BEND, STRAIGHT_PROJECTION, x, toRowU(0))).toBeCloseTo(
        0,
        9
      );
    }
  });

  it('на наклонном листе точка на линии гребёнки получает смещение своей строки узлов', () => {
    /**
     * У последнего узла прямая линия заметно ниже своей высоты у левого края:
     * иначе тест не отличил бы координату вдоль линий от высоты.
     */
    expect(toNodeX(LAST_COLUMN) * TILT).toBeGreaterThan(BEND.rowSpacing / 4);

    for (let row = 0; row <= LAST_ROW; row += 1) {
      for (let column = 0; column <= LAST_COLUMN; column += 1) {
        const x = toNodeX(column);

        expect(
          sampleRulingBend(BEND, SKEWED_PROJECTION, x, toRowU(row) + x * TILT)
        ).toBeCloseTo(readNode(row, column), 9);
      }
    }
  });

  it('производная вдоль линии совпадает с конечной разностью при постоянной координате вдоль линий', () => {
    const h = 1e-3;
    const points = [
      { x: toNodeX(1) + 17, u: toRowU(0) + 11 },
      { x: toNodeX(2) - 21, u: toRowU(0) + 29 },
      { x: toNodeX(3) - 12, u: toRowU(0) + 17 },
    ];

    for (const { x, u } of points) {
      const y = u + x * TILT;
      const slope = sampleRulingBendSlope(BEND, SKEWED_PROJECTION, x, y);
      const alongLine =
        (sampleRulingBend(BEND, SKEWED_PROJECTION, x + h, y + h * TILT) -
          sampleRulingBend(BEND, SKEWED_PROJECTION, x - h, y - h * TILT)) /
        (2 * h);
      const atConstantY =
        (sampleRulingBend(BEND, SKEWED_PROJECTION, x + h, y) -
          sampleRulingBend(BEND, SKEWED_PROJECTION, x - h, y)) /
        (2 * h);

      expect(slope).toBeCloseTo(alongLine, 6);

      /**
       * Производная при постоянной высоте отличается на наклон, умноженный на
       * разницу строк узлов: точки взяты там, где эта разница заметна.
       */
      expect(Math.abs(slope - atConstantY)).toBeGreaterThan(5e-4);
    }
  });
});

/**
 * Перспектива со схождением только по ширине: шаг у левого края кадра примерно
 * на десятую меньше, чем в начале отсчёта. Схождение по высоте здесь нулевое —
 * общая формула координаты вдоль линий проверена в `paper-ruling-perspective`,
 * а выборке изгиба нужна только строка узлов по `U`.
 */
const PERSPECTIVE: RulingPerspective = {
  originX: 1200,
  originY: 400,
  convergenceX: 1e-4,
  convergenceY: 0,
};

const PERSPECTIVE_PROJECTION: RulingProjection = {
  skewAngle: SKEW_ANGLE,
  perspective: PERSPECTIVE,
};

/**
 * Высота линии с координатой вдоль линий `u` в столбце, посчитанная по формуле
 * design при нулевом схождении по высоте, а не выборкой из `lib/paper`: эталон
 * не должен зависеть от проверяемого модуля.
 *
 * @param u — координата вдоль линий
 * @param x — горизонталь в пикселях кадра
 * @returns высота линии в пикселях кадра
 */
const toPerspectiveLineY = (u: number, x: number): number => {
  const { originX, originY, convergenceX } = PERSPECTIVE;
  const offsetX = x - originX;

  return (
    originY +
    offsetX * TILT +
    (u - originY + originX * TILT) * (1 + convergenceX * offsetX)
  );
};

describe('выборка изгиба под перспективой', () => {
  it('точка на линии получает смещение своей строки узлов', () => {
    for (let row = 0; row <= LAST_ROW; row += 1) {
      for (let column = 0; column <= LAST_COLUMN; column += 1) {
        const u = toRowU(row);
        const x = toNodeX(column);
        const y = toPerspectiveLineY(u, x);

        /**
         * Линия под перспективой уходит от прямой гребёнки дальше восьмой
         * расстояния между строками узлов: иначе выборка по прямой
         * `y − x·tgθ` попала бы в ту же строку и тест ничего не отличил бы.
         */
        expect(Math.abs(y - x * TILT - u)).toBeGreaterThan(BEND.rowSpacing / 8);
        expect(sampleRulingBend(BEND, PERSPECTIVE_PROJECTION, x, y)).toBeCloseTo(
          readNode(row, column),
          9
        );
      }
    }
  });

  it('производная совпадает с конечной разностью вдоль линии', () => {
    const h = 1e-3;
    const points = [
      { x: toNodeX(1) + 17, u: toRowU(0) + 11 },
      { x: toNodeX(2) - 21, u: toRowU(0) + 29 },
    ];

    for (const { x, u } of points) {
      const slope = sampleRulingBendSlope(
        BEND,
        PERSPECTIVE_PROJECTION,
        x,
        toPerspectiveLineY(u, x)
      );
      const ahead = sampleRulingBend(
        BEND,
        PERSPECTIVE_PROJECTION,
        x + h,
        toPerspectiveLineY(u, x + h)
      );
      const behind = sampleRulingBend(
        BEND,
        PERSPECTIVE_PROJECTION,
        x - h,
        toPerspectiveLineY(u, x - h)
      );

      expect(slope).toBeCloseTo((ahead - behind) / (2 * h), 6);
    }
  });
});

/**
 * Кадр листа: сборке разлиновки он нужен для фолбэка полей, на перенос изгиба
 * не влияет.
 */
const FRAME = { width: 1600, height: 2000 };

describe('изгиб в сборке разлиновки', () => {
  it('переносит переданный изгиб как есть', () => {
    const ruling = buildSheetRuling(
      { step: 40, firstLinePhase: 13, skewAngle: -0.9, bend: BEND },
      FRAME
    );

    expect(ruling.bend).toEqual(BEND);
  });

  it('без изгиба в источнике даёт прямые линии', () => {
    const ruling = buildSheetRuling(
      { step: 40, firstLinePhase: 13, skewAngle: 0 },
      FRAME
    );

    expect(ruling.bend).toBeNull();
  });

  it('без шага отбрасывает изгиб: сетка относилась бы к несуществующей гребёнке', () => {
    const ruling = buildSheetRuling(
      { step: 0, firstLinePhase: 0, skewAngle: 0, bend: BEND },
      FRAME
    );

    expect(ruling.bend).toBeNull();
  });
});
