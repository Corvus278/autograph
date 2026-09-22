import type {
  PaperMargins,
  RulingKind,
  RulingPerspective,
  SheetImageData,
  SheetOutline,
  SheetPoint,
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
 * Полоса печатного текста поперёк кадра: строки штрихов с заданным шагом.
 * Нужна как ловушка для поиска периода — текст даёт настоящий период по
 * высоте, но только внутри своей полосы, и шаг его строк неотличим от
 * правдоподобного шага разлиновки.
 */
export type SyntheticTextBand = {
  /**
   * Верхний край полосы, строка кадра.
   */
  top: number;

  /**
   * Нижний край полосы, строка кадра.
   */
  bottom: number;

  /**
   * Левый край полосы, столбец кадра.
   */
  left: number;

  /**
   * Правый край полосы, столбец кадра.
   */
  right: number;

  /**
   * Шаг строк текста по высоте. Первая строка отступает от верха полосы на
   * полшага: встань она на край, полоса обрезала бы её наполовину, и период у
   * края сбился бы.
   */
  step: number;

  /**
   * Высота штриха.
   */
  strokeHeight: number;

  /**
   * Шаг штрихов по ширине строки.
   */
  pitch: number;

  /**
   * Ширина штриха.
   */
  strokeWidth: number;

  /**
   * Насколько штрих темнее бумаги, от 0 до 1. Не задана — глубина, которой
   * хватает, чтобы полосу не отсекла сила сигнала: ловушка должна спорить с
   * разлиновкой на равных.
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
 * Вертикаль клетки, нарисованная глубже остальных: у тетради так выходит сгиб,
 * край печати или дважды пропечатанная линия.
 */
export type SyntheticDeepColumn = {
  /**
   * Насколько вертикаль темнее бумаги, от 0 до 1. Берётся вместо
   * `lineDarkness`, а не поверх неё: иначе глубина зависела бы от того, какой
   * контраст у остальной клетки, и лист терял бы смысл опоры.
   */
  darkness: number;

  /**
   * Столбец поперёк разлиновки. Глубже рисуется ближайшая к нему вертикаль
   * гребёнки, поэтому глубокая вертикаль всегда стоит ровно на фазе — иначе
   * лист не отличал бы одиночную черту от линии клетки, а просто показывал
   * вертикаль не на месте.
   */
  x: number;
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
 * Сторона листа, наружу от которой лежит полоса поверхности.
 */
export type SyntheticSide = 'top' | 'right' | 'bottom' | 'left';

/**
 * Полоса поверхности вдоль одной стороны листа: обложка тетради или соседний
 * лист, видный за спиралью.
 */
export type SyntheticSurfaceBand = {
  /**
   * Сторона листа, наружу от которой лежит полоса.
   */
  side: SyntheticSide;

  /**
   * Толщина полосы наружу от стороны листа. Дальше неё — яркость поверхности.
   */
  width: number;

  /**
   * Яркость полосы, от 0 до 1.
   */
  brightness: number;
};

/**
 * Поверхность вокруг листа: всё, что видно за его контуром.
 */
export type SyntheticSurface = {
  /**
   * Контур листа в пикселях кадра. За ним бумаги нет: линии разлиновки,
   * поля и линия поля туда не рисуются.
   */
  outline: SheetOutline;

  /**
   * Радиус скругления углов листа. Ноль — углы прямые.
   */
  cornerRadius?: number;

  /**
   * Яркость поверхности за пределами полос, от 0 до 1.
   */
  brightness?: number;

  /**
   * Размах равномерного шума яркости поверхности: зерно стола отличается от
   * зерна бумаги.
   */
  grain?: number;

  /**
   * Полоса обложки. Не задана — обложки нет.
   */
  cover?: SyntheticSurfaceBand;

  /**
   * Полоса соседнего листа — она светлее бумаги, и поиск края, идущий снаружи
   * внутрь, принял бы её за сам лист. Не задана — соседнего листа нет.
   */
  neighbour?: SyntheticSurfaceBand;

  /**
   * Доля яркости, теряемая в углах кадра: мягкая виньетка объектива. Ноль —
   * виньетки нет.
   */
  vignette?: number;
};

/**
 * Перспектива разлиновки: линии сходятся по ширине кадра и меняют шаг по его
 * высоте. Горизонтальная линия с координатой `U` лежит на `Y(x, U)`.
 */
export type SyntheticRulingPerspective = {
  /**
   * Схождение линий по ширине кадра, 1/px.
   */
  convergenceX: number;

  /**
   * Изменение шага по высоте кадра, 1/px.
   */
  convergenceY: number;

  /**
   * Начало отсчёта по ширине. Не задано — середина кадра.
   */
  originX?: number;

  /**
   * Начало отсчёта по высоте. Не задано — середина кадра.
   */
  originY?: number;
};

/**
 * Стороны листа в точке кадра: столбцы боковых сторон на её высоте и строки
 * верхней и нижней сторон в её столбце.
 */
type SyntheticSheetEdges = {
  /**
   * Столбец левой стороны листа.
   */
  left: number;

  /**
   * Столбец правой стороны листа.
   */
  right: number;

  /**
   * Строка верхней стороны листа.
   */
  top: number;

  /**
   * Строка нижней стороны листа.
   */
  bottom: number;
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
   * Снос линии поля по `x`: доля шага, на которую она уходит вправо от верхней
   * границы области с линиями к нижней. Так черта поля получает собственный
   * наклон, не равный наклону разлиновки, — как на тетради, где поле напечатано
   * отдельным прогоном и к линиям не привязано. Складывается с
   * `marginLineBend`. Точное положение — `computeSyntheticMarginLineX`.
   */
  marginLineDrift?: number;

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

  /**
   * Прямоугольник кадра, внутри которого различима лишь каждая вторая
   * горизонтальная линия: у линий с нечётным номером на гребёнке остаётся доля
   * `contrast` от их глубины. Так снят дальний край тетради в клетку, где
   * разрешения снимка уже не хватает на каждую линию, и период разлиновки в
   * этой части кадра вдвое больше шага линий.
   *
   * Вертикали клетки прямоугольник не задевает: период меряется по
   * горизонтальным линиям, а погашенные заодно вертикали сдвинули бы и замер
   * наклона, к «через одну» отношения не имеющий.
   */
  everySecondLineArea?: SyntheticArea | null;

  /**
   * Прямоугольник, внутри которого от всех чернил остаётся доля `contrast`:
   * блик, замазка или наклейка поверх листа. В отличие от `lowContrastArea`,
   * гасит и линию поля: ради этого и заводится — линия под пятном обязана
   * пропасть из полос целиком, а не побледнеть вместе с разлиновкой.
   */
  blotArea?: SyntheticArea | null;

  /**
   * Одна вертикаль клетки глубже остальных. Не задана — клетка ровная.
   */
  deepColumn?: SyntheticDeepColumn | null;

  /**
   * Полоса печатного текста поверх бумаги. Не задана — текста нет.
   */
  textBand?: SyntheticTextBand | null;

  /**
   * Поверхность вокруг листа. Не задана — лист занимает весь кадр.
   */
  surface?: SyntheticSurface | null;

  /**
   * Перспектива горизонтальных линий. Не задана — линии идут через равный шаг.
   * Поле `perspective` этим не заменяется: оно разводит концы линий без
   * эталона, а здесь у каждой линии есть точное место — `computeSyntheticLineY`.
   */
  rulingPerspective?: SyntheticRulingPerspective | null;

  /**
   * Доля прироста шага разлиновки по кадру от верхней крайней линии к нижней:
   * `0.25` — у нижней шаг на четверть больше, чем у верхней. Отрицательная доля
   * растит шаг кверху. Мера та же, что у детектора перспективы: местный шаг на
   * крайних линиях, а не расстояние между двумя соседними.
   *
   * Доля, а не `convergenceY` в 1/px: гарантия спеки записана в процентах, и
   * тест, задающий дрейф числом из спеки, не считает перевод в уме.
   */
  stepDrift?: number;

  /**
   * Доля, на которую линии сходятся по ширине кадра: `0.2` — у правого края
   * кадра промежуток между двумя линиями на пятую часть меньше, чем у левого.
   * Отрицательная доля сводит линии влево. Промежуток меняется по ширине
   * одинаково у всех пар линий, поэтому доля не зависит от того, по какой паре
   * её мерить.
   */
  lineConvergence?: number;
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
 * Снос линии поля в строке кадра: доля шага, набранная линейно от верхней
 * границы области с линиями к нижней. Отсчёт по строкам кадра, а не вдоль
 * разлиновки: черта со своим наклоном разлиновке не подчиняется, и её место в
 * строке не зависит от того, какая линия эту строку пересекла.
 *
 * Нулевой снос отдаёт ровно ноль, не выражение: прибавление ноля растр не
 * трогает, а деление на нулевую высоту области дало бы `NaN` там, где сноса
 * нет вовсе.
 *
 * @param drift — снос по всей области в долях шага
 * @param step — шаг разлиновки
 * @param topEdge — верхняя граница области с линиями
 * @param bottomEdge — нижняя граница области с линиями
 * @param y — строка кадра
 * @returns сдвиг линии поля вправо в пикселях
 */
const computeMarginLineDrift = (
  drift: number,
  step: number,
  topEdge: number,
  bottomEdge: number,
  y: number
): number => {
  if (drift === 0) {
    return 0;
  }

  return (drift * step * (y - topEdge)) / (bottomEdge - topEdge);
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

/**
 * Глубина линии по её месту на гребёнке: единица — линия видна целиком.
 */
type SyntheticLineDepth = (center: number) => number;

/**
 * Полная глубина: линия, у которой глубина не задана, видна целиком. Множитель
 * ровно единица, поэтому растр листа без погашенных линий не меняется ни в
 * одном пикселе.
 *
 * @returns единица
 */
const computeFullDepth = (): number => {
  return 1;
};

const computeCombInk = (
  coordinate: number,
  step: number,
  phase: number,
  sigma: number,
  from: number,
  to: number,
  driftFrom = Number.POSITIVE_INFINITY,
  drift = 0,
  depthAt: SyntheticLineDepth = computeFullDepth
): number => {
  const center = Math.round((coordinate - phase) / step) * step + phase;

  if (center < from || center > to) {
    return 0;
  }

  const shift = center >= driftFrom ? drift : 0;

  return depthAt(center) * computeInk(coordinate - center - shift, sigma);
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
 * @param depthAt — глубина линии по её месту на прямой гребёнке
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
  offsetAt: (center: number) => number,
  depthAt: SyntheticLineDepth = computeFullDepth
): number => {
  const nearest = Math.round((coordinate - phase) / step);
  let closest = Number.POSITIVE_INFINITY;
  let closestCenter = phase;

  for (let index = nearest - 1; index <= nearest + 1; index += 1) {
    const center = index * step + phase;

    if (center >= from && center <= to) {
      const shift = center >= driftFrom ? drift : 0;
      const distance = coordinate - center - shift - offsetAt(center);

      if (Math.abs(distance) < Math.abs(closest)) {
        closest = distance;
        closestCenter = center;
      }
    }
  }

  return depthAt(closestCenter) * computeInk(closest, sigma);
};

/**
 * Глубина вертикалей клетки, у которой одна линия темнее прочих. Глубина
 * задана долей от `lineDarkness`, потому что отрисовка множит её на неё же;
 * без разлиновки доля неопределима, и лист остаётся ровным.
 *
 * @param deepColumn — глубокая вертикаль
 * @param lineDarkness — глубина остальных линий
 * @param step — шаг разлиновки
 * @returns глубина вертикали по её месту на гребёнке
 */
const createDeepColumnDepth = (
  deepColumn: SyntheticDeepColumn,
  lineDarkness: number,
  step: number
): SyntheticLineDepth => {
  if (lineDarkness === 0) {
    return computeFullDepth;
  }

  return (center: number): number => {
    return Math.abs(center - deepColumn.x) < step / 2
      ? deepColumn.darkness / lineDarkness
      : 1;
  };
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
 * Глубина линий внутри прямоугольника «через одну»: у линий с нечётным номером
 * на гребёнке остаётся доля `contrast`. Номер отсчитывается от фазы, а не от
 * края прямоугольника, поэтому гаснут те же линии, что и в соседнем кадре с
 * другими границами прямоугольника, — «через одну» не зависит от того, где
 * прямоугольник начался.
 *
 * @param area — прямоугольник кадра и доля глубины гаснущих линий
 * @param step — шаг гребёнки
 * @param phase — фаза гребёнки
 * @returns глубина линии по её месту на гребёнке
 */
const createHalvedDepth = (
  area: SyntheticArea,
  step: number,
  phase: number
): SyntheticLineDepth => {
  return (center) => {
    return Math.abs(Math.round((center - phase) / step)) % 2 === 0 ? 1 : area.contrast;
  };
};

const DEFAULT_TEXT_DARKNESS = 0.5;

/**
 * Пробел между словами: примерно каждый седьмой штрих пропущен. Без пропусков
 * полоса была бы правильной сеткой, а не текстом. Номер штриха гоняется через
 * целочисленный хэш, а не через общий поток шума: пропуск обязан зависеть
 * только от места штриха, иначе растр менялся бы от порядка обхода пикселей.
 *
 * @param row — номер строки текста
 * @param column — номер штриха в строке
 * @returns `true`, если штриха на этом месте нет
 */
const isTextStrokeSkipped = (row: number, column: number): boolean => {
  const mixed = Math.imul(row, 73_856_093) ^ Math.imul(column, 19_349_663);

  return (Math.imul(mixed, 0x27_d4_eb_2d) >>> 0) % 7 === 0;
};

/**
 * Чернила полосы текста в точке кадра: ближайший штрих ближайшей строки с
 * краями, размытыми той же гауссианой, что у линии разлиновки.
 *
 * @param band — полоса текста
 * @param x — столбец пикселя
 * @param y — строка пикселя
 * @param sigma — сигма размытого края
 * @returns глубина чернил от 0 до 1
 */
const computeTextBandInk = (
  band: SyntheticTextBand,
  x: number,
  y: number,
  sigma: number
): number => {
  const {
    top,
    bottom,
    left,
    right,
    step,
    pitch,
    strokeWidth,
    strokeHeight,
    darkness = DEFAULT_TEXT_DARKNESS,
  } = band;

  if (x < left || x > right || y < top || y > bottom) {
    return 0;
  }

  const firstRow = top + step / 2;
  const row = Math.round((y - firstRow) / step);
  const column = Math.round((x - left) / pitch);

  if (isTextStrokeSkipped(row, column)) {
    return 0;
  }

  const overY = Math.abs(y - (firstRow + row * step)) - strokeHeight / 2;
  const overX = Math.abs(x - (left + column * pitch)) - strokeWidth / 2;

  return (
    darkness *
    computeInk(Math.max(0, overY), sigma) *
    computeInk(Math.max(0, overX), sigma)
  );
};

const DEFAULT_SURFACE_BRIGHTNESS = 0.3;

/**
 * Координата вдоль линий `U` в точке кадра. Формула перспективы записана здесь
 * своя, а не взята из `lib/paper`: синтетика — эталон для измерений, и общая
 * запись сделала бы проверку попадания на линии круговой.
 *
 * @param perspective — перспектива разлиновки; `null` — равный шаг
 * @param tangent — тангенс наклона разлиновки
 * @param x — столбец кадра
 * @param y — строка кадра
 * @returns координата вдоль линий
 */
const computeLineCoordinate = (
  perspective: RulingPerspective | null,
  tangent: number,
  x: number,
  y: number
): number => {
  if (perspective === null) {
    return y - x * tangent;
  }

  const { originX, originY, convergenceX, convergenceY } = perspective;
  const offsetX = x - originX;
  const weight = 1 + convergenceX * offsetX + convergenceY * (y - originY);

  return originY - originX * tangent + (y - originY - offsetX * tangent) / weight;
};

/**
 * Высота линии с координатой `u` в столбце `x` — обращение
 * `computeLineCoordinate`.
 *
 * @param perspective — перспектива разлиновки; `null` — равный шаг
 * @param tangent — тангенс наклона разлиновки
 * @param x — столбец кадра
 * @param u — координата вдоль линий
 * @returns строка линии в столбце
 */
const computeLineHeight = (
  perspective: RulingPerspective | null,
  tangent: number,
  x: number,
  u: number
): number => {
  if (perspective === null) {
    return u + x * tangent;
  }

  const { originX, originY, convergenceX, convergenceY } = perspective;
  const offsetX = x - originX;
  const offset = u - originY + originX * tangent;

  return (
    originY +
    (offset * (1 + convergenceX * offsetX) + offsetX * tangent) /
      (1 - offset * convergenceY)
  );
};

/**
 * Строка центра горизонтальной линии, стоящей на гребёнке в месте `center`:
 * перспектива, уход `drift` и изгиб вместе. Одна запись и для отрисовки, и для
 * эталона — иначе они разошлись бы на долю пикселя и тест ловил бы не изгиб.
 *
 * @param perspective — перспектива разлиновки; `null` — равный шаг
 * @param tangent — тангенс наклона разлиновки
 * @param center — место линии на гребёнке
 * @param x — столбец кадра
 * @param driftFrom — место на гребёнке, с которого линии уходят на `drift`
 * @param drift — уход линий от `driftFrom`
 * @param bend — изгиб линии в точке, где она прошла бы без него
 * @returns строка центра линии
 */
const computeLineCenterY = (
  perspective: RulingPerspective | null,
  tangent: number,
  center: number,
  x: number,
  driftFrom: number,
  drift: number,
  bend: SyntheticField
): number => {
  const lineY = computeLineHeight(perspective, tangent, x, center);
  const shift = center >= driftFrom ? drift : 0;

  return lineY + shift + bend(x, lineY);
};

/**
 * Чернила гребёнки в перспективе: расстояние до линии меряется по высоте
 * кадра, а не вдоль координаты `U`, — местный шаг по кадру меняется, и в `U`
 * гауссиана линии расплывалась бы к одному краю листа и сжималась к другому.
 *
 * @param coordinate — координата пикселя вдоль линий
 * @param y — строка пикселя
 * @param step — шаг гребёнки
 * @param phase — фаза гребёнки
 * @param sigma — сигма гауссианы линии
 * @param from — наименьшее место линии на гребёнке, которое рисуется
 * @param to — наибольшее место линии на гребёнке, которое рисуется
 * @param lineYAt — строка центра линии по её месту на гребёнке
 * @param depthAt — глубина линии по её месту на гребёнке
 * @returns глубина чернил от 0 до 1
 */
const computePerspectiveCombInk = (
  coordinate: number,
  y: number,
  step: number,
  phase: number,
  sigma: number,
  from: number,
  to: number,
  lineYAt: (center: number) => number,
  depthAt: SyntheticLineDepth = computeFullDepth
): number => {
  const nearest = Math.round((coordinate - phase) / step);
  let closest = Number.POSITIVE_INFINITY;
  let closestCenter = phase;

  for (let index = nearest - 1; index <= nearest + 1; index += 1) {
    const center = index * step + phase;

    if (center >= from && center <= to) {
      const distance = y - lineYAt(center);

      if (Math.abs(distance) < Math.abs(closest)) {
        closest = distance;
        closestCenter = center;
      }
    }
  }

  return depthAt(closestCenter) * computeInk(closest, sigma);
};

/**
 * Столбец боковой стороны листа на высоте `y`.
 *
 * @param top — верхний конец стороны
 * @param bottom — нижний конец стороны
 * @param y — строка кадра
 * @returns столбец стороны
 */
const computeSheetSideX = (top: SheetPoint, bottom: SheetPoint, y: number): number => {
  const span = bottom.y - top.y;

  return span === 0 ? top.x : top.x + ((bottom.x - top.x) * (y - top.y)) / span;
};

/**
 * Строка горизонтальной стороны листа в столбце `x`.
 *
 * @param left — левый конец стороны
 * @param right — правый конец стороны
 * @param x — столбец кадра
 * @returns строка стороны
 */
const computeSheetSideY = (left: SheetPoint, right: SheetPoint, x: number): number => {
  const span = right.x - left.x;

  return span === 0 ? left.y : left.y + ((right.y - left.y) * (x - left.x)) / span;
};

/**
 * Стороны листа в точке кадра.
 *
 * @param outline — контур листа
 * @param x — столбец кадра
 * @param y — строка кадра
 * @returns столбцы боковых сторон и строки верхней и нижней
 */
const computeSheetEdges = (
  outline: SheetOutline,
  x: number,
  y: number
): SyntheticSheetEdges => {
  const { topLeft, topRight, bottomRight, bottomLeft } = outline;

  return {
    left: computeSheetSideX(topLeft, bottomLeft, y),
    right: computeSheetSideX(topRight, bottomRight, y),
    top: computeSheetSideY(topLeft, topRight, x),
    bottom: computeSheetSideY(bottomLeft, bottomRight, x),
  };
};

/**
 * Точка за контуром листа: за одной из сторон или за скруглением угла.
 *
 * @param edges — стороны листа в этой точке
 * @param cornerRadius — радиус скругления углов
 * @param x — столбец кадра
 * @param y — строка кадра
 * @returns `true`, если точка лежит на поверхности, а не на бумаге
 */
const isOutsideSheet = (
  edges: SyntheticSheetEdges,
  cornerRadius: number,
  x: number,
  y: number
): boolean => {
  const insideX = Math.min(x - edges.left, edges.right - x);
  const insideY = Math.min(y - edges.top, edges.bottom - y);

  if (insideX < 0 || insideY < 0) {
    return true;
  }

  if (insideX >= cornerRadius || insideY >= cornerRadius) {
    return false;
  }

  return Math.hypot(cornerRadius - insideX, cornerRadius - insideY) > cornerRadius;
};

/**
 * Насколько точка отстоит от стороны листа наружу. Отрицательное — точка с
 * другой стороны листа или внутри него.
 *
 * @param edges — стороны листа в этой точке
 * @param side — сторона листа
 * @param x — столбец кадра
 * @param y — строка кадра
 * @returns расстояние наружу от стороны
 */
const computeOutwardDistance = (
  edges: SyntheticSheetEdges,
  side: SyntheticSide,
  x: number,
  y: number
): number => {
  switch (side) {
    case 'top': {
      return edges.top - y;
    }

    case 'right': {
      return x - edges.right;
    }

    case 'bottom': {
      return y - edges.bottom;
    }

    case 'left': {
      return edges.left - x;
    }

    default: {
      throw new Error(`Unknown side: ${side}`);
    }
  }
};

/**
 * Яркость поверхности в точке за контуром: полоса обложки или соседнего листа,
 * если точка попала в неё, иначе — сама поверхность.
 *
 * @param surface — поверхность вокруг листа
 * @param edges — стороны листа в этой точке
 * @param x — столбец кадра
 * @param y — строка кадра
 * @returns яркость от 0 до 1
 */
const computeSurfaceBrightness = (
  surface: SyntheticSurface,
  edges: SyntheticSheetEdges,
  x: number,
  y: number
): number => {
  const { brightness = DEFAULT_SURFACE_BRIGHTNESS, cover, neighbour } = surface;
  const band = [cover, neighbour].find((item) => {
    if (!item) {
      return false;
    }

    const distance = computeOutwardDistance(edges, item.side, x, y);

    return distance > 0 && distance <= item.width;
  });

  return band ? band.brightness : brightness;
};

/**
 * Множитель виньетки: единица в середине кадра, наибольшая потеря — в углах.
 *
 * @param vignette — доля яркости, теряемая в углах кадра
 * @param widthShare — доля ширины от −1 у левого края до 1 у правого
 * @param heightShare — доля высоты от −1 у верха до 1 у низа
 * @returns множитель яркости
 */
const computeVignetteScale = (
  vignette: number,
  widthShare: number,
  heightShare: number
): number => {
  return 1 - (vignette * (widthShare ** 2 + heightShare ** 2)) / 2;
};

/**
 * Эталонный контур листа в форме модели. Без поверхности — весь кадр: лист
 * снят обрезанным по краям.
 *
 * @param params — описание листа
 * @returns четыре угла листа в пикселях кадра
 */
export const computeSyntheticOutline = (params: SyntheticSheetParams): SheetOutline => {
  const { width = DEFAULT_WIDTH, height = DEFAULT_HEIGHT, surface = null } = params;

  if (surface !== null) {
    return surface.outline;
  }

  return {
    topLeft: { x: 0, y: 0 },
    topRight: { x: width, y: 0 },
    bottomRight: { x: width, y: height },
    bottomLeft: { x: 0, y: height },
  };
};

/**
 * Схождение по высоте из доли прироста шага. Линия с координатой `v` вдоль
 * линий, отсчитанной от начала отсчёта, стоит на `v / (1 − q·v)`, поэтому
 * местный шаг по кадру растёт как `1 / (1 − q·v)²`. Приравняв отношение шагов
 * на концах области с линиями к `1 + d`, получаем `q` в одно действие.
 *
 * @param drift — доля прироста шага от верхней крайней линии к нижней
 * @param top — координата верхней крайней линии от начала отсчёта
 * @param bottom — координата нижней крайней линии от начала отсчёта
 * @returns схождение по высоте, 1/px
 */
const computeDriftConvergence = (drift: number, top: number, bottom: number): number => {
  if (drift === 0) {
    return 0;
  }

  const ratio = Math.sqrt(1 + drift);

  return (ratio - 1) / (ratio * bottom - top);
};

/**
 * Схождение по ширине из доли схождения линий. Промежуток между любыми двумя
 * линиями в столбце `x` множится на `1 + q·(x − originX)`, поэтому отношение
 * промежутков у правого и левого краёв кадра равно `1 − c`.
 *
 * @param convergence — доля, на которую промежуток у правого края меньше, чем
 *   у левого
 * @param width — ширина кадра
 * @param originX — начало отсчёта по ширине
 * @returns схождение по ширине, 1/px
 */
const computeWidthConvergence = (
  convergence: number,
  width: number,
  originX: number
): number => {
  if (convergence === 0) {
    return 0;
  }

  return -convergence / (width - convergence * originX);
};

/**
 * Эталонная перспектива разлиновки в форме модели: начало отсчёта разрешено до
 * чисел, чтобы сравнение с измеренной перспективой шло без домысливания.
 * Заданная напрямую `rulingPerspective` сильнее долей `stepDrift` и
 * `lineConvergence`: доли — короткая запись той же модели, а не поправка
 * поверх неё.
 *
 * @param params — описание листа
 * @returns перспектива; `null` — линии идут через равный шаг
 */
export const computeSyntheticPerspective = (
  params: SyntheticSheetParams
): RulingPerspective | null => {
  const {
    width = DEFAULT_WIDTH,
    height = DEFAULT_HEIGHT,
    step = DEFAULT_STEP,
    phase = 0,
    angle = 0,
    margins = DEFAULT_MARGINS,
    stepDrift = 0,
    lineConvergence = 0,
    rulingPerspective = null,
  } = params;

  if (rulingPerspective !== null) {
    const {
      convergenceX,
      convergenceY,
      originX = width / 2,
      originY = height / 2,
    } = rulingPerspective;

    return { originX, originY, convergenceX, convergenceY };
  }

  if (stepDrift === 0 && lineConvergence === 0) {
    return null;
  }

  const originX = width / 2;
  const originY = height / 2;
  /**
   * Координата вдоль линий отсчитывается от начала отсчёта: у линии,
   * проходящей через него, она равна `originY − originX·tg(angle)`.
   */
  const base = originY - originX * Math.tan(angle * DEGREES_TO_RADIANS);
  /**
   * Дрейф отсчитывается между крайними нарисованными линиями, а не между
   * краями области с линиями: детектор перспективы меряет его там же, и
   * заказанная тестом доля совпадает с измеренной без поправки на отрезанный
   * фазой хвост области.
   */
  const topLine = Math.ceil((margins.top - phase) / step) * step + phase;
  const bottomLine = Math.floor((height - margins.bottom - phase) / step) * step + phase;

  return {
    originX,
    originY,
    convergenceX: computeWidthConvergence(lineConvergence, width, originX),
    convergenceY: computeDriftConvergence(stepDrift, topLine - base, bottomLine - base),
  };
};

/**
 * Рисует полутоновый лист с заданной разлиновкой: шагом, фазой, наклоном,
 * дрейфом шага по высоте и схождением линий по ширине, полями, линией поля,
 * изгибом линий и границ, помехами у края, зерном и неравномерным
 * освещением. Нужен затем, чтобы измерения проверялись против
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
    marginLineDrift = 0,
    lineEndsBend = NO_LINE_ENDS_BEND,
    spiral = null,
    blotArea = null,
    deepColumn = null,
    outerRuling = null,
    lowContrastArea = null,
    everySecondLineArea = null,
    textBand = null,
    surface = null,
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
  const perspectiveModel = computeSyntheticPerspective(params);
  const bendField = bend || computeNoShift;
  const halvedDepth =
    everySecondLineArea === null
      ? computeFullDepth
      : createHalvedDepth(everySecondLineArea, step, phase);
  const columnDepthAt =
    deepColumn === null
      ? computeFullDepth
      : createDeepColumnDepth(deepColumn, lineDarkness, step);
  const surfaceCornerRadius = surface === null ? 0 : surface.cornerRadius || 0;
  const surfaceGrain = surface === null ? 0 : surface.grain || 0;
  const surfaceVignette = surface === null ? 0 : surface.vignette || 0;

  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    const heightShare = (2 * y) / height - 1;
    const rowDarkness = lineDarkness * (1 - fade * Math.abs(heightShare));
    const rowLeftEdge = leftEdge + leftEndBend(y);
    const rowRightEdge = rightEdge + rightEndBend(y);
    const rowMarginLineX =
      marginLineX === null
        ? null
        : marginLineX +
          marginLineBend(y) +
          computeMarginLineDrift(marginLineDrift, step, topEdge, bottomEdge, y);

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
      const edges = surface === null ? null : computeSheetEdges(surface.outline, x, y);
      const surfaceValue =
        surface !== null &&
        edges !== null &&
        isOutsideSheet(edges, surfaceCornerRadius, x, y)
          ? computeSurfaceBrightness(surface, edges, x, y)
          : null;
      const isOnPaper = surfaceValue === null;
      let value = surfaceValue === null ? 1 - lighting * shade : surfaceValue;

      if (kind !== 'blank' && isOnPaper) {
        const isAcrossInside = acrossLines >= rowLeftEdge && acrossLines <= rowRightEdge;
        const lineDepthAt =
          everySecondLineArea !== null && isInsideArea(everySecondLineArea, x, y)
            ? halvedDepth
            : computeFullDepth;

        if (isAcrossInside) {
          let lineInk = 0;

          if (perspectiveModel !== null) {
            lineInk = computePerspectiveCombInk(
              computeLineCoordinate(perspectiveModel, tangent, x, y),
              y,
              step,
              phase,
              sigma,
              topEdge,
              bottomEdge,
              (center) => {
                return computeLineCenterY(
                  perspectiveModel,
                  tangent,
                  center,
                  x,
                  driftFrom,
                  drift,
                  bendField
                );
              },
              lineDepthAt
            );
          } else if (bend === null) {
            lineInk = computeCombInk(
              alongLines - perspectiveShift,
              step,
              phase,
              sigma,
              topEdge,
              bottomEdge,
              driftFrom,
              drift,
              lineDepthAt
            );
          } else {
            lineInk = computeBentCombInk(
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
              },
              lineDepthAt
            );
          }

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
                  width - columnMargins.right,
                  Number.POSITIVE_INFINITY,
                  0,
                  columnDepthAt
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
                  },
                  columnDepthAt
                );

          value -= lineDarkness * contrast * columnInk;
        }
      }

      if (rowMarginLineX !== null && isAlongInside && isOnPaper) {
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

      if (textBand !== null && isOnPaper) {
        value -= computeTextBandInk(textBand, x, y, sigma);
      }

      if (spiral !== null) {
        value -= computeSpiralInk(spiral, x, y, sigma);
      }

      if (blotArea !== null && isOnPaper && isInsideArea(blotArea, x, y)) {
        const paper = 1 - lighting * shade;

        value = paper - (paper - value) * blotArea.contrast;
      }

      if (surfaceVignette !== 0) {
        value *= computeVignetteScale(surfaceVignette, (2 * x) / width - 1, heightShare);
      }

      value += (random() - 0.5) * (isOnPaper ? noise : surfaceGrain);
      luminance[row + x] = Math.max(0, Math.min(1, value));
    }
  }

  return { width, height, luminance };
};

/**
 * Эталонный центр горизонтальной линии в столбце: наклон, перспектива
 * `rulingPerspective`, изгиб `bend` и уход `drift`. Перспектива `perspective`
 * не входит: её сдвиг зависит от строки пикселя, а не от линии, и точного
 * положения линии у неё нет — линия с эталоном задаётся через
 * `rulingPerspective` и `bend`.
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

  return computeLineCenterY(
    computeSyntheticPerspective(params),
    Math.tan(angle * DEGREES_TO_RADIANS),
    phase + index * step,
    x,
    driftFrom,
    drift,
    bend
  );
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
  const {
    angle = 0,
    height = DEFAULT_HEIGHT,
    margins = DEFAULT_MARGINS,
    marginLineBend = computeNoShift,
    marginLineDrift = 0,
    marginLineX = null,
    step = DEFAULT_STEP,
  } = params;

  if (marginLineX === null) {
    return null;
  }

  const drift = computeMarginLineDrift(
    marginLineDrift,
    step,
    margins.top,
    height - margins.bottom,
    y
  );

  return (
    marginLineX + marginLineBend(y) + drift - y * Math.tan(angle * DEGREES_TO_RADIANS)
  );
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

/**
 * Лист калибровки поиска линии поля: гребёнка и область с линиями заданы до
 * числа, чтобы потребитель не повторял их литералами, а брал из самого листа.
 */
export type SyntheticCalibrationSheet = SyntheticSheetParams & {
  /**
   * Высота кадра.
   */
  height: number;

  /**
   * Границы области с линиями.
   */
  margins: PaperMargins;

  /**
   * Смещение линий по модулю шага.
   */
  phase: number;

  /**
   * Шаг разлиновки.
   */
  step: number;

  /**
   * Ширина кадра.
   */
  width: number;
};

/**
 * Лист калибровки с чертой поля: её место и снос тоже заданы до числа.
 */
export type SyntheticMarginLineSheet = SyntheticCalibrationSheet & {
  /**
   * Снос черты по всей области в долях шага.
   */
  marginLineDrift: number;

  /**
   * Место черты у верхней границы области с линиями.
   */
  marginLineX: number;
};

/**
 * Глубина черты поля у листов калибровки: вдвое больше глубины разлиновки.
 * Отношение взято из живых снимков, где черта глубже децили соседних
 * вертикалей в полтора — два с четвертью раза.
 */
const CALIBRATION_MARGIN_LINE_DARKNESS = 0.7;

/**
 * Лист калибровки с пятном: прямоугольник пятна задан до числа, чтобы
 * потребитель знал, какие полосы обязаны потерять узел.
 */
export type SyntheticBlottedSheet = SyntheticCalibrationSheet & {
  /**
   * Пятно поверх листа.
   */
  blotArea: SyntheticArea;
};

/**
 * Лист калибровки с глубокой вертикалью: её место и глубина заданы до числа.
 */
export type SyntheticDeepColumnSheet = SyntheticCalibrationSheet & {
  /**
   * Вертикаль, нарисованная глубже остальных.
   */
  deepColumn: SyntheticDeepColumn;
};

/**
 * Общая основа листов калибровки: клетка, зерно, свет и контраст вертикалей у
 * листа с чертой поля и у листа без неё обязаны совпадать до числа, иначе
 * отрицательный класс отсекает сила сигнала, а не барьер глубины.
 *
 * Шаг крупный, а черта стоит между вертикалями: у измерения глубины вертикали
 * остаётся полшага чистого фона с каждой стороны, и соседняя линия в окно не
 * попадает.
 */
const CALIBRATION_SHEET_BASE: SyntheticCalibrationSheet = {
  width: 600,
  height: 800,
  step: 40,
  phase: 20,
  kind: 'grid',
  margins: { top: 60, right: 60, bottom: 60, left: 60 },
  lineDarkness: 0.35,
  marginLineDarkness: CALIBRATION_MARGIN_LINE_DARKNESS,
  noise: 0.02,
  lighting: 0.2,
  seed: 23,
};

/**
 * Лист с чертой поля, идущей под своим наклоном: за область с линиями она
 * уходит вправо на полтора шага. Профиль столбцов во всю высоту такую черту
 * размывает — на ней и проверяется полосовой поиск.
 *
 * Полтора шага — с запасом больше живого разброса: на снимках тетради, где
 * поле напечатано отдельным прогоном, черта уходит на шаг с небольшим.
 *
 * Черта стоит в четверти шага от вертикали клетки в обоих концах области:
 * попади её конец ровно на вертикаль, глубина в этом месте удвоилась бы, и
 * замер мерил бы сумму двух линий.
 */
export const DRIFTING_MARGIN_LINE_SHEET: SyntheticMarginLineSheet = {
  ...CALIBRATION_SHEET_BASE,
  marginLineX: 110,
  marginLineDrift: 1.5,
};

/**
 * Отрицательный класс калибровки: тот же лист без черты поля. Вертикали клетки
 * на нём одной глубины, поэтому кандидат в линию поля обязан упереться в
 * барьер, а не в разницу контраста.
 */
export const ABSENT_MARGIN_LINE_SHEET: SyntheticCalibrationSheet = {
  ...CALIBRATION_SHEET_BASE,
  marginLineX: null,
};

/**
 * Пятно поверх листа калибровки: четыре полосы подряд в середине области, по
 * ширине — от черты со сносом до вертикали клетки на фазе, с запасом шире окна
 * продолжения трассы с обеих сторон.
 *
 * Высота пятна — четыре полосы по полтора шага, отсчитанные от верхней границы
 * области. С полосами детектора они не совпадают: он режет кадр на равные
 * полосы от `y = 0`, и разбивок у него две. Трасса режет этот кадр на тринадцать
 * полос по 61,54 px — пятно накрывает три из них целиком и в две соседние
 * заходит краем. Полосовая ступень, охват которой пятно и сторожит, режет его
 * на сорок полос по 20 px — пятно накрывает около двенадцати подряд. Важна не
 * разбивка, а доля высоты: под пятном обязана скрыться такая её часть, чтобы
 * профиль во всю высоту перестал брать барьер по соседям, — иначе лист-фантом
 * ниже проверял бы не полосовую ступень, а всё ту же первую.
 */
const CALIBRATION_BLOT_AREA: SyntheticArea = {
  left: 115,
  top: 300,
  right: 175,
  bottom: 539,
  contrast: 0.03,
};

/**
 * Лист со снесённой чертой, пропавшей под пятном в четырёх полосах подряд.
 *
 * Пятно гасит и разлиновку: останься вертикали клетки видны, трасса в этих
 * полосах перескочила бы на соседнюю вертикаль вместо того, чтобы потерять
 * черту, и лист проверял бы не пропажу, а подмену.
 */
export const BLOTTED_MARGIN_LINE_SHEET: SyntheticMarginLineSheet & SyntheticBlottedSheet =
  {
    ...DRIFTING_MARGIN_LINE_SHEET,
    blotArea: CALIBRATION_BLOT_AREA,
  };

/**
 * Лист без черты поля, у которого одна вертикаль клетки глубже остальных
 * ровно вдвое — как черта на листе со сносом. По глубине такой кандидат от
 * черты неотличим, и связать его может только фаза гребёнки: вертикаль стоит
 * на ней точно, а не рядом.
 *
 * Глубокая вертикаль стоит в крайней трети области, где и ищется линия поля,
 * и в том же месте кадра, что черта листа со сносом: лист, где кандидат
 * отсекался бы не фазой, а краем области поиска, опорой различителя не был бы.
 */
export const DEEP_COLUMN_SHEET: SyntheticDeepColumnSheet = {
  ...ABSENT_MARGIN_LINE_SHEET,
  deepColumn: { x: 140, darkness: CALIBRATION_MARGIN_LINE_DARKNESS },
};

/**
 * Тот же фантом под тем же пятном, что и черта: в профиле во всю высоту он
 * разбавлен пропажей и барьер по соседям не берёт, а по полосам, где виден,
 * стоит вровень с чертой и по глубине, и по охвату. Отличить его от черты
 * можно только фазой гребёнки — на этом листе и проверяется различитель.
 */
export const BLOTTED_DEEP_COLUMN_SHEET: SyntheticDeepColumnSheet & SyntheticBlottedSheet =
  {
    ...DEEP_COLUMN_SHEET,
    blotArea: CALIBRATION_BLOT_AREA,
  };
