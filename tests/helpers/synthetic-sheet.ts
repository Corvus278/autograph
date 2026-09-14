import type {
  PaperMargins,
  RulingKind,
  SheetImageData,
} from '@pages/Generator/lib/paper';
import { mulberry32 } from '@shared/lib/random';

/**
 * Описание рисуемого листа. Все длины — в пикселях итогового изображения,
 * координаты линий отсчитываются вдоль разлиновки: горизонтальные линии лежат
 * на `y - x * tg(angle)`, вертикальные — на `x + y * tg(angle)`. Поэтому при
 * наклоне поворачивается вся разлиновка целиком, как на настоящем листе,
 * снятом под углом.
 */
export type SyntheticSheetParams = {
  /**
   * Ширина изображения.
   */
  width?: number;

  /**
   * Высота изображения.
   */
  height?: number;

  /**
   * Шаг разлиновки.
   */
  step?: number;

  /**
   * Смещение линий по модулю шага. Первая нарисованная линия — наименьшая
   * координата не меньше `margins.top`, сравнимая с фазой по модулю шага.
   */
  phase?: number;

  /**
   * Наклон разлиновки в градусах, положительный — линии идут вниз слева
   * направо.
   */
  angle?: number;

  /**
   * Вид разлиновки: `grid` добавляет вертикальные линии с тем же шагом,
   * `blank` не рисует ни одной.
   */
  kind?: RulingKind;

  /**
   * Границы области с линиями: линия рисуется, только если её центр внутри.
   */
  margins?: PaperMargins;

  /**
   * Смещение вертикальной линии поля от левого края. `null` — линии поля нет.
   */
  marginLineX?: number | null;

  /**
   * Толщина линии разлиновки: удвоенная сигма гауссианы, которой линия
   * размывается.
   */
  lineWidth?: number;

  /**
   * Насколько линия разлиновки темнее бумаги, от 0 до 1.
   */
  lineDarkness?: number;

  /**
   * Насколько линия поля темнее бумаги, от 0 до 1.
   */
  marginLineDarkness?: number;

  /**
   * Размах равномерного шума яркости: имитация зерна бумаги и матрицы.
   */
  noise?: number;

  /**
   * Размах неравномерности освещения по диагонали кадра.
   */
  lighting?: number;

  /**
   * Seed шума: без него каждый прогон давал бы другое зерно.
   */
  seed?: number;

  /**
   * Координата вдоль разлиновки, начиная с которой горизонтальные линии уходят
   * с арифметической гребёнки. Не задана — все линии на гребёнке.
   */
  driftFrom?: number;

  /**
   * На сколько пикселей уходят линии от `driftFrom` и ниже: так у края кадра
   * лист тянет объектив или изгиб страницы.
   */
  drift?: number;

  /**
   * На сколько пикселей концы горизонтальной линии у верхнего и нижнего края
   * кадра расходятся с гребёнкой: концы уходят в разные стороны, у нижнего
   * края — зеркально верхнему, у середины кадра линия ровная. Так ложится
   * разлиновка на снимке телефоном, когда лист повёрнут к объективу.
   */
  perspective?: number;

  /**
   * Какую долю глубины теряют горизонтальные линии у верхнего и нижнего края
   * кадра; к середине кадра потеря убывает до нуля. Так на снимке телефоном
   * резкость и свет уходят от центра к краям.
   */
  fade?: number;

  /**
   * Левая и правая границы вертикальных линий клетки, если они уже области
   * горизонтальных линий: так у тетради, где горизонтальные линии тянутся к
   * краю листа дальше последней вертикальной. Не заданы — те же, что у
   * горизонтальных линий.
   */
  columnMargins?: Pick<PaperMargins, 'left' | 'right'>;
};

const DEFAULT_MARGINS: PaperMargins = { top: 0, right: 0, bottom: 0, left: 0 };

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Чернила линии в точке: гауссиана с центром на линии.
 *
 * Гауссиана, а не треугольник или ступенька: у ступеньки положение линии
 * округлялось бы до целого пикселя, а у треугольника форма линии зависит от
 * того, попал её центр в отсчёт или между отсчётами. На дробном шаге соседние
 * линии тогда получаются разной формы, и профиль приобретает период вдвое
 * больше настоящего — ровно ту ошибку, которую поиск шага и должен не
 * допускать. У гауссианы разница формы гасится экспоненциально и на глаз, и в
 * спектре.
 */
const computeInk = (distance: number, sigma: number): number => {
  return Math.exp(-0.5 * (distance / sigma) ** 2);
};

const computeCombInk = (
  coordinate: number,
  step: number,
  phase: number,
  sigma: number,
  from: number,
  to: number,
  driftFrom = Number.POSITIVE_INFINITY,
  drift = 0
): number => {
  const center = Math.round((coordinate - phase) / step) * step + phase;

  if (center < from || center > to) {
    return 0;
  }

  const shift = center >= driftFrom ? drift : 0;

  return computeInk(coordinate - center - shift, sigma);
};

/**
 * Рисует полутоновый лист с заданной разлиновкой: шагом, фазой, наклоном,
 * полями, линией поля, зерном и неравномерным освещением. Нужен затем, чтобы
 * измерения проверялись против известного ответа, а не против глазомера по
 * настоящей фотографии.
 *
 * @param params — описание листа
 * @returns полутоновая выжимка, готовая к анализу
 */
export const createSyntheticSheet = (
  params: SyntheticSheetParams = {}
): SheetImageData => {
  const {
    width = 420,
    height = 560,
    step = 24,
    phase = 0,
    angle = 0,
    kind = 'lined',
    margins = DEFAULT_MARGINS,
    marginLineX = null,
    lineWidth = 2.4,
    lineDarkness = 0.45,
    marginLineDarkness = 0.6,
    noise = 0,
    lighting = 0,
    seed = 1,
    driftFrom = Number.POSITIVE_INFINITY,
    drift = 0,
    perspective = 0,
    fade = 0,
    columnMargins = margins,
  } = params;
  const tangent = Math.tan(angle * DEGREES_TO_RADIANS);
  const random = mulberry32(seed);
  const luminance = new Float32Array(width * height);
  const sigma = lineWidth / 2;
  const topEdge = margins.top;
  const bottomEdge = height - margins.bottom;
  const leftEdge = margins.left;
  const rightEdge = width - margins.right;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const heightShare = (2 * y) / height - 1;
    const rowDarkness = lineDarkness * (1 - fade * Math.abs(heightShare));

    for (let x = 0; x < width; x += 1) {
      const alongLines = y - x * tangent;
      const acrossLines = x + y * tangent;
      const shade = (x / width + y / height) / 2;
      const perspectiveShift = perspective * heightShare * ((2 * x) / width - 1);
      let value = 1 - lighting * shade;

      if (kind !== 'blank') {
        const isAcrossInside = acrossLines >= leftEdge && acrossLines <= rightEdge;

        if (isAcrossInside) {
          value -=
            rowDarkness *
            computeCombInk(
              alongLines - perspectiveShift,
              step,
              phase,
              sigma,
              topEdge,
              bottomEdge,
              driftFrom,
              drift
            );
        }

        if (kind === 'grid' && alongLines >= topEdge && alongLines <= bottomEdge) {
          value -=
            lineDarkness *
            computeCombInk(
              acrossLines,
              step,
              phase,
              sigma,
              columnMargins.left,
              width - columnMargins.right
            );
        }
      }

      if (marginLineX !== null && alongLines >= topEdge && alongLines <= bottomEdge) {
        value -= marginLineDarkness * computeInk(acrossLines - marginLineX, sigma);
      }

      value += (random() - 0.5) * noise;
      luminance[row + x] = Math.max(0, Math.min(1, value));
    }
  }

  return { width, height, luminance };
};
