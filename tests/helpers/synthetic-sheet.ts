import type {
  PaperMargins,
  RulingKind,
  SheetImageData,
} from '@pages/Generator/lib/paper';
import { mulberry32 } from '@shared/lib/random';

/**
 * Сдвиг вертикальной границы в пикселях как функция высоты кадра `y`.
 */
export type SyntheticCurve = (y: number) => number;

/**
 * Сдвиг линии в пикселях в точке листа `(x, y)`. Точка — место, где линия
 * прошла бы без изгиба: так эталонное положение линии считается прямой
 * подстановкой, без решения уравнения относительно её собственного сдвига.
 */
export type SyntheticField = (x: number, y: number) => number;

/**
 * Столбец одинаковых тёмных пятен вдоль края листа — отверстия и кольца
 * спирали.
 */
export type SyntheticSpiral = {
  /**
   * Столбец центров пятен.
   */
  x: number;

  /**
   * Шаг пятен по высоте кадра.
   */
  period: number;

  /**
   * Высота центра пятна по модулю шага пятен.
   */
  phase?: number;

  /**
   * Радиус тёмной сердцевины. За ним пятно светлеет гауссианой той же ширины,
   * что у линии разлиновки.
   */
  radius: number;

  /**
   * Насколько сердцевина темнее бумаги, от 0 до 1.
   */
  darkness?: number;
};

/**
 * Горизонтальные линии чужого шага — соседняя страница разворота или
 * подложка, видная за линией поля.
 */
export type SyntheticOuterRuling = {
  /**
   * Шаг чужих линий.
   */
  step: number;

  /**
   * Фаза чужих линий по модулю их шага, вдоль разлиновки.
   */
  phase?: number;
};

/**
 * Прямоугольник кадра, где линии разлиновки бледнее: блик или дальний угол,
 * ушедший из резкости.
 */
export type SyntheticArea = {
  /**
   * Левый край прямоугольника, столбец кадра.
   */
  left: number;

  /**
   * Верхний край прямоугольника, строка кадра.
   */
  top: number;

  /**
   * Правый край прямоугольника, столбец кадра.
   */
  right: number;

  /**
   * Нижний край прямоугольника, строка кадра.
   */
  bottom: number;

  /**
   * Какая доля глубины линий остаётся внутри, от 0 до 1.
   */
  contrast: number;
};

/**
 * Сдвиги концов горизонтальных линий вправо от границ `margins`.
 */
export type SyntheticLineEndsBend = {
  /**
   * Сдвиг левого конца. Не задан — конец на `margins.left`.
   */
  left?: SyntheticCurve;

  /**
   * Сдвиг правого конца. Не задан — конец на `width - margins.right`.
   */
  right?: SyntheticCurve;
};

/**
 * Столбцы, где на заданной строке кончаются горизонтальные линии.
 */
export type SyntheticLineEnds = {
  /**
   * Самый левый столбец, где линия ещё рисуется.
   */
  left: number;

  /**
   * Самый правый столбец, где линия ещё рисуется.
   */
  right: number;
};

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

  /**
   * Изгиб горизонтальных линий: на сколько пикселей линия уходит вниз от прямой
   * гребёнки, отрицательное — вверх. Точное положение линии с изгибом отдаёт
   * `computeSyntheticLineY`. Изгиб меньше шага: пиксель рисуется ближайшей из
   * трёх соседних по гребёнке линий.
   */
  bend?: SyntheticField;

  /**
   * Изгиб вертикальных линий клетки: сдвиг вправо от прямой вертикали в её
   * точке. Чтобы изогнуть только крайние вертикали, функция отдаёт ноль для
   * остальных. Точное положение — `computeSyntheticColumnX`.
   */
  columnBend?: SyntheticField;

  /**
   * Изгиб линии поля: сдвиг вправо от `marginLineX` на высоте кадра. Точное
   * положение — `computeSyntheticMarginLineX`.
   */
  marginLineBend?: SyntheticCurve;

  /**
   * Изгиб концов горизонтальных линий. Точные концы —
   * `computeSyntheticLineEnds`.
   */
  lineEndsBend?: SyntheticLineEndsBend;

  /**
   * Пятна спирали. Их шаг по высоте нарочно задаётся отдельно от шага линий:
   * совпади он, спираль сошла бы за продолжение разлиновки.
   */
  spiral?: SyntheticSpiral;

  /**
   * Линии чужого шага между линией поля и ближним к ней краем кадра, по высоте
   * — в той же области, что и разлиновка. Без линии поля не рисуются.
   */
  outerRuling?: SyntheticOuterRuling;

  /**
   * Прямоугольник пониженного контраста горизонтальных и вертикальных линий
   * разлиновки. Линию поля, пятна спирали и чужую линейку не задевает: пятно
   * проверяет устойчивость измерения самой разлиновки.
   */
  lowContrastArea?: SyntheticArea;
};

const DEFAULT_WIDTH = 420;

const DEFAULT_HEIGHT = 560;

const DEFAULT_STEP = 24;

const DEFAULT_MARGINS: PaperMargins = { top: 0, right: 0, bottom: 0, left: 0 };

const NO_LINE_ENDS_BEND: SyntheticLineEndsBend = {};

const DEGREES_TO_RADIANS = Math.PI / 180;

/**
 * Нулевой сдвиг: границы и линии, изгиб которых не задан, остаются прямыми.
 *
 * @returns ноль
 */
const computeNoShift = (): number => {
  return 0;
};

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
 * Чернила изогнутой гребёнки: пиксель рисуется ближайшей из трёх соседних по
 * прямой гребёнке линий. Одной ближайшей мало: изогнутая линия уходит со своего
 * места на гребёнке, и у её центра ближайшей по прямой гребёнке оказывается
 * соседняя линия — изгиб рвался бы посередине шага.
 *
 * @param coordinate — координата пикселя поперёк линий гребёнки
 * @param step — шаг гребёнки
 * @param phase — фаза гребёнки
 * @param sigma — сигма гауссианы линии
 * @param from — наименьшее место линии на прямой гребёнке, которое рисуется
 * @param to — наибольшее место линии на прямой гребёнке, которое рисуется
 * @param driftFrom — место на гребёнке, с которого линии уходят на `drift`
 * @param drift — уход линий от `driftFrom`
 * @param offsetAt — изгиб линии по её месту на прямой гребёнке
 * @returns глубина чернил от 0 до 1
 */
const computeBentCombInk = (
  coordinate: number,
  step: number,
  phase: number,
  sigma: number,
  from: number,
  to: number,
  driftFrom: number,
  drift: number,
  offsetAt: (center: number) => number
): number => {
  const nearest = Math.round((coordinate - phase) / step);
  let closest = Number.POSITIVE_INFINITY;

  for (let index = nearest - 1; index <= nearest + 1; index += 1) {
    const center = index * step + phase;

    if (center >= from && center <= to) {
      const shift = center >= driftFrom ? drift : 0;
      const distance = coordinate - center - shift - offsetAt(center);

      closest = Math.abs(distance) < Math.abs(closest) ? distance : closest;
    }
  }

  return computeInk(closest, sigma);
};

const DEFAULT_SPIRAL_DARKNESS = 0.7;

/**
 * Чернила пятен спирали. Ближайшее пятно ищется только по высоте: пятна стоят
 * одним столбцом, и ближайший по высоте центр ближе всех и на плоскости.
 *
 * @param spiral — пятна спирали
 * @param x — столбец пикселя
 * @param y — строка пикселя
 * @param sigma — сигма размытого края, как у линии
 * @returns глубина чернил от 0 до 1
 */
const computeSpiralInk = (
  spiral: SyntheticSpiral,
  x: number,
  y: number,
  sigma: number
): number => {
  const {
    x: centerX,
    period,
    phase = 0,
    radius,
    darkness = DEFAULT_SPIRAL_DARKNESS,
  } = spiral;
  const centerY = Math.round((y - phase) / period) * period + phase;
  const distance = Math.hypot(x - centerX, y - centerY) - radius;

  return darkness * (distance > 0 ? computeInk(distance, sigma) : 1);
};

/**
 * Пиксель внутри прямоугольника, края включительно.
 *
 * @param area — прямоугольник кадра
 * @param x — столбец пикселя
 * @param y — строка пикселя
 * @returns `true`, если пиксель внутри
 */
const isInsideArea = (area: SyntheticArea, x: number, y: number): boolean => {
  const { left, top, right, bottom } = area;

  return x >= left && x <= right && y >= top && y <= bottom;
};

/**
 * Рисует полутоновый лист с заданной разлиновкой: шагом, фазой, наклоном,
 * полями, линией поля, изгибом линий и границ, помехами у края, зерном и
 * неравномерным освещением. Нужен затем, чтобы измерения проверялись против
 * известного ответа, а не против глазомера по настоящей фотографии. Вызов без
 * параметров изгиба и помех рисует тот же растр, что и до их появления.
 *
 * @param params — описание листа
 * @returns полутоновая выжимка, готовая к анализу
 */
export const createSyntheticSheet = (
  params: SyntheticSheetParams = {}
): SheetImageData => {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    step = DEFAULT_STEP,
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
    bend = null,
    columnBend = null,
    marginLineBend = computeNoShift,
    lineEndsBend = NO_LINE_ENDS_BEND,
    spiral = null,
    outerRuling = null,
    lowContrastArea = null,
  } = params;
  const { left: leftEndBend = computeNoShift, right: rightEndBend = computeNoShift } =
    lineEndsBend;
  const tangent = Math.tan(angle * DEGREES_TO_RADIANS);
  const random = mulberry32(seed);
  const luminance = new Float32Array(width * height);
  const sigma = lineWidth / 2;
  const topEdge = margins.top;
  const bottomEdge = height - margins.bottom;
  const leftEdge = margins.left;
  const rightEdge = width - margins.right;
  const isOuterRulingOnLeft = marginLineX !== null && marginLineX < width / 2;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const heightShare = (2 * y) / height - 1;
    const rowDarkness = lineDarkness * (1 - fade * Math.abs(heightShare));
    const rowLeftEdge = leftEdge + leftEndBend(y);
    const rowRightEdge = rightEdge + rightEndBend(y);
    const rowMarginLineX = marginLineX === null ? null : marginLineX + marginLineBend(y);

    for (let x = 0; x < width; x += 1) {
      const alongLines = y - x * tangent;
      const acrossLines = x + y * tangent;
      const shade = (x / width + y / height) / 2;
      const perspectiveShift = perspective * heightShare * ((2 * x) / width - 1);
      const isAlongInside = alongLines >= topEdge && alongLines <= bottomEdge;
      const contrast =
        lowContrastArea !== null && isInsideArea(lowContrastArea, x, y)
          ? lowContrastArea.contrast
          : 1;
      let value = 1 - lighting * shade;

      if (kind !== 'blank') {
        const isAcrossInside = acrossLines >= rowLeftEdge && acrossLines <= rowRightEdge;

        if (isAcrossInside) {
          const lineInk =
            bend === null
              ? computeCombInk(
                  alongLines - perspectiveShift,
                  step,
                  phase,
                  sigma,
                  topEdge,
                  bottomEdge,
                  driftFrom,
                  drift
                )
              : computeBentCombInk(
                  alongLines - perspectiveShift,
                  step,
                  phase,
                  sigma,
                  topEdge,
                  bottomEdge,
                  driftFrom,
                  drift,
                  (center) => {
                    return bend(x, center + x * tangent);
                  }
                );

          value -= rowDarkness * contrast * lineInk;
        }

        if (kind === 'grid' && isAlongInside) {
          const columnInk =
            columnBend === null
              ? computeCombInk(
                  acrossLines,
                  step,
                  phase,
                  sigma,
                  columnMargins.left,
                  width - columnMargins.right
                )
              : computeBentCombInk(
                  acrossLines,
                  step,
                  phase,
                  sigma,
                  columnMargins.left,
                  width - columnMargins.right,
                  Number.POSITIVE_INFINITY,
                  0,
                  (center) => {
                    return columnBend(center - y * tangent, y);
                  }
                );

          value -= lineDarkness * contrast * columnInk;
        }
      }

      if (rowMarginLineX !== null && isAlongInside) {
        value -= marginLineDarkness * computeInk(acrossLines - rowMarginLineX, sigma);

        const isBeyondMarginLine = isOuterRulingOnLeft
          ? acrossLines < rowMarginLineX
          : acrossLines > rowMarginLineX;

        if (outerRuling !== null && isBeyondMarginLine) {
          value -=
            lineDarkness *
            computeCombInk(
              alongLines,
              outerRuling.step,
              outerRuling.phase || 0,
              sigma,
              topEdge,
              bottomEdge
            );
        }
      }

      if (spiral !== null) {
        value -= computeSpiralInk(spiral, x, y, sigma);
      }

      value += (random() - 0.5) * noise;
      luminance[row + x] = Math.max(0, Math.min(1, value));
    }
  }

  return { width, height, luminance };
};

/**
 * Эталонный центр горизонтальной линии в столбце: наклон, изгиб `bend` и уход
 * `drift`. Перспектива `perspective` не входит: её сдвиг зависит от строки
 * пикселя, а не от линии, и точного положения линии у неё нет — изгиб с
 * эталоном задаётся через `bend`.
 *
 * @param params — описание листа, тот же объект, что ушёл в
 *   `createSyntheticSheet`
 * @param index — номер линии на гребёнке: вдоль разлиновки линия лежит на
 *   `phase + index * step`
 * @param x — столбец кадра
 * @returns строка центра линии, дробная
 */
export const computeSyntheticLineY = (
  params: SyntheticSheetParams,
  index: number,
  x: number
): number => {
  const {
    step = DEFAULT_STEP,
    phase = 0,
    angle = 0,
    driftFrom = Number.POSITIVE_INFINITY,
    drift = 0,
    bend = computeNoShift,
  } = params;
  const center = phase + index * step;
  const straightY = center + x * Math.tan(angle * DEGREES_TO_RADIANS);
  const shift = center >= driftFrom ? drift : 0;

  return straightY + shift + bend(x, straightY);
};

/**
 * Эталонные концы горизонтальных линий на строке кадра: границы `margins`,
 * повёрнутые наклоном и сдвинутые изгибом `lineEndsBend`.
 *
 * @param params — описание листа
 * @param y — строка кадра
 * @returns крайние столбцы, где линии ещё рисуются
 */
export const computeSyntheticLineEnds = (
  params: SyntheticSheetParams,
  y: number
): SyntheticLineEnds => {
  const {
    width = DEFAULT_WIDTH,
    angle = 0,
    margins = DEFAULT_MARGINS,
    lineEndsBend = NO_LINE_ENDS_BEND,
  } = params;
  const { left: leftBend = computeNoShift, right: rightBend = computeNoShift } =
    lineEndsBend;
  const tiltShift = y * Math.tan(angle * DEGREES_TO_RADIANS);

  return {
    left: margins.left + leftBend(y) - tiltShift,
    right: width - margins.right + rightBend(y) - tiltShift,
  };
};

/**
 * Эталонный центр линии поля на строке кадра.
 *
 * @param params — описание листа
 * @param y — строка кадра
 * @returns столбец центра линии поля; `null` — линии поля нет
 */
export const computeSyntheticMarginLineX = (
  params: SyntheticSheetParams,
  y: number
): number | null => {
  const { angle = 0, marginLineX = null, marginLineBend = computeNoShift } = params;

  if (marginLineX === null) {
    return null;
  }

  return marginLineX + marginLineBend(y) - y * Math.tan(angle * DEGREES_TO_RADIANS);
};

/**
 * Эталонный центр вертикальной линии клетки на строке кадра.
 *
 * @param params — описание листа
 * @param index — номер вертикали на гребёнке: поперёк разлиновки она лежит на
 *   `phase + index * step`
 * @param y — строка кадра
 * @returns столбец центра вертикали, дробный
 */
export const computeSyntheticColumnX = (
  params: SyntheticSheetParams,
  index: number,
  y: number
): number => {
  const {
    step = DEFAULT_STEP,
    phase = 0,
    angle = 0,
    columnBend = computeNoShift,
  } = params;
  const straightX = phase + index * step - y * Math.tan(angle * DEGREES_TO_RADIANS);

  return straightX + columnBend(straightX, y);
};
