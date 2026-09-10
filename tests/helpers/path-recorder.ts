import type { GlyphPoint } from '@pages/Generator/lib/glyph';
import type { RenderContext } from '@pages/Generator/lib/render';

import type { Polyline } from './ink-raster';
import { cubicPoint, CURVE_STEPS, quadPoint } from './ink-raster';

/**
 * Ширина символа в измерителе-модели: настоящих размеров ни jsdom, ни node не
 * считают, а буквам, которых нет в шрифте, ширина всё равно нужна.
 */
const CHAR_WIDTH = 10;

/**
 * Преобразование координат: строки матрицы `a c e` и `b d f`, как их принимает
 * `setTransform` канвы.
 */
type Matrix = {
  /**
   * Горизонтальный масштаб.
   */
  a: number;

  /**
   * Вертикальный скос.
   */
  b: number;

  /**
   * Горизонтальный скос.
   */
  c: number;

  /**
   * Вертикальный масштаб.
   */
  d: number;

  /**
   * Сдвиг по горизонтали.
   */
  e: number;

  /**
   * Сдвиг по вертикали.
   */
  f: number;
};

const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/**
 * Текст, отрисованный шрифтом, а не контуром.
 */
export type DrawnText = {
  /**
   * Что нарисовали.
   */
  text: string;

  /**
   * Горизонталь точки на базовой линии в пикселях страницы.
   */
  x: number;

  /**
   * Вертикаль точки на базовой линии в пикселях страницы.
   */
  y: number;
};

/**
 * Контекст, записывающий пути, вместе с тем, что в него нарисовали.
 */
export type PathRecorder = {
  /**
   * Контекст, который подставляется рендереру.
   */
  context: RenderContext;

  /**
   * Залитые контуры в пикселях страницы: преобразования контекста уже
   * применены.
   */
  polylines: Polyline[];

  /**
   * Текст, нарисованный шрифтом.
   */
  texts: DrawnText[];
};

/**
 * Произведение преобразований: сначала применяется правое, потом левое — тот
 * же порядок, в каком их накапливает канва.
 */
const multiply = (left: Matrix, right: Matrix): Matrix => {
  return {
    a: left.a * right.a + left.c * right.b,
    b: left.b * right.a + left.d * right.b,
    c: left.a * right.c + left.c * right.d,
    d: left.b * right.c + left.d * right.d,
    e: left.a * right.e + left.c * right.f + left.e,
    f: left.b * right.e + left.d * right.f + left.f,
  };
};

/**
 * Контекст-записыватель, который держит преобразования и собирает залитые
 * контуры в пикселях страницы.
 *
 * Нужен там, где проверяется форма отрисованного, а не состав вызовов: буквы
 * приходят путями, и увидеть в них слово можно только применив к точкам ту же
 * цепочку преобразований, что применил бы браузер.
 *
 * @returns контекст и то, что в него нарисовали
 */
export const createPathRecorder = (): PathRecorder => {
  const polylines: Polyline[] = [];
  const texts: DrawnText[] = [];
  let matrix: Matrix = IDENTITY;
  const stack: Matrix[] = [];
  let path: Polyline[] = [];
  let current: Polyline = [];
  let cursor: GlyphPoint = { x: 0, y: 0 };

  const toPage = (point: GlyphPoint): GlyphPoint => {
    return {
      x: matrix.a * point.x + matrix.c * point.y + matrix.e,
      y: matrix.b * point.x + matrix.d * point.y + matrix.f,
    };
  };

  const closeCurrent = (): void => {
    if (current.length > 1) {
      path.push(current);
    }

    current = [];
  };

  const context: RenderContext = {
    fillStyle: '',
    font: '',
    textBaseline: 'alphabetic',
    save: () => {
      stack.push(matrix);
    },
    restore: () => {
      matrix = stack.pop() || IDENTITY;
    },
    scale: (x, y) => {
      matrix = multiply(matrix, { a: x, b: 0, c: 0, d: y, e: 0, f: 0 });
    },
    translate: (x, y) => {
      matrix = multiply(matrix, { ...IDENTITY, e: x, f: y });
    },
    rotate: (angle) => {
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      matrix = multiply(matrix, { a: cos, b: sin, c: -sin, d: cos, e: 0, f: 0 });
    },
    transform: (a, b, c, d, e, f) => {
      matrix = multiply(matrix, { a, b, c, d, e, f });
    },
    drawImage: () => {},
    measureText: (text) => {
      return { width: [...text].length * CHAR_WIDTH };
    },
    fillText: (text, x, y) => {
      texts.push({ text, ...toPage({ x, y }) });
    },
    beginPath: () => {
      current = [];
      path = [];
    },
    moveTo: (x, y) => {
      closeCurrent();
      cursor = { x, y };
      current.push(toPage(cursor));
    },
    lineTo: (x, y) => {
      cursor = { x, y };
      current.push(toPage(cursor));
    },
    quadraticCurveTo: (cpx, cpy, x, y) => {
      const control = { x: cpx, y: cpy };
      const end = { x, y };

      for (let step = 1; step <= CURVE_STEPS; step += 1) {
        current.push(toPage(quadPoint(cursor, control, end, step / CURVE_STEPS)));
      }

      cursor = end;
    },
    bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => {
      const first = { x: cp1x, y: cp1y };
      const second = { x: cp2x, y: cp2y };
      const end = { x, y };

      for (let step = 1; step <= CURVE_STEPS; step += 1) {
        current.push(toPage(cubicPoint(cursor, first, second, end, step / CURVE_STEPS)));
      }

      cursor = end;
    },
    closePath: () => {
      closeCurrent();
    },
    fill: () => {
      closeCurrent();
      polylines.push(...path);
      path = [];
    },
  };

  return { context, polylines, texts };
};
