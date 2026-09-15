import { ANALYSIS_IMAGE_SIZE, downsampleSheetImage } from './downsampleSheetImage';
import type { SheetImageData } from './paper.types';
import { buildShearedProfile, refinePeakOffset } from './sheetProfile';

/**
 * Половина диапазона свипа в градусах. Заказчик ограничил вход обрезанными по
 * краям листами: перспективы там почти нет, а остаточный наклон в один-два
 * градуса есть всегда. Более широкий диапазон только удорожает свип и добавляет
 * ложных вершин на текстуре бумаги.
 */
export const MAX_SKEW_ANGLE = 2;

/**
 * Шаг свипа в градусах. Десятая доля градуса на кадре шириной в тысячу точек —
 * это сдвиг линии почти на два пикселя, то есть уже заметное размытие профиля.
 * Более мелкий шаг вершину не уточняет: между отсчётами она достраивается
 * параболой.
 */
export const SKEW_ANGLE_STEP = 0.1;

/**
 * Доля лучшей резкости вертикалей, ниже которой угол, найденный по
 * горизонтальным линиям, считается уведённым изгибом. На синтетических листах
 * с прогибом до трети шага угол, не уведённый изгибом, оставляет вертикалям от
 * 0,78 их лучшей резкости, уведённый — не больше 0,12: половина лежит в этом
 * разрыве. У листа без вертикалей резкость столбцов — зерно бумаги, от угла она
 * почти не зависит, и отношение остаётся у единицы.
 */
const VERTICAL_SMEAR_RATIO = 0.5;

/**
 * Настройки поиска наклона разлиновки.
 */
export type SkewDetectionOptions = {
  /**
   * Половина диапазона свипа в градусах.
   */
  maxAngle?: number;

  /**
   * Шаг свипа в градусах.
   */
  angleStep?: number;

  /**
   * Предел длинной стороны уменьшенной копии, на которой идёт свип. Ноль и
   * меньше отключают уменьшение.
   */
  maxAnalysisSize?: number;
};

/**
 * Итог свипа по одной оси.
 */
type AxisSweep = {
  /**
   * Угол наибольшей контрастности профиля в градусах, уточнённый параболой.
   */
  angle: number;

  /**
   * Контрастность профиля в лучшем отсчёте свипа.
   */
  contrast: number;
};

/**
 * Контрастность профиля: среднее квадрата перепада между соседними бинами.
 *
 * Перепад, а не разброс самих яркостей: неравномерное освещение растягивает
 * профиль по всей его длине и раздувает разброс одинаково на любом угле, а
 * перепад соседей его почти не замечает. Зато резкие провалы линий, ради
 * которых свип и затевается, дают перепад тем больший, чем точнее угол.
 *
 * @param values — профиль средней яркости
 * @returns контрастность; ноль на профиле короче двух бинов
 */
const computeProfileContrast = (values: Float64Array): number => {
  if (values.length < 2) {
    return 0;
  }

  let sum = 0;

  for (let index = 1; index < values.length; index += 1) {
    sum += ((values[index] || 0) - (values[index - 1] || 0)) ** 2;
  }

  return sum / (values.length - 1);
};

/**
 * Свип по одной оси: для каждого угла изображение схлопывается в профиль
 * средней яркости вдоль наклонных линий этой оси, и берётся угол наибольшей
 * контрастности. Вершина уточняется параболой по соседним отсчётам свипа,
 * поэтому точность не упирается в шаг.
 *
 * @param source — уменьшенная копия фотографии
 * @param axis — ось линий: горизонтальные линии разлиновки или вертикали
 * @param maxAngle — половина диапазона свипа в градусах
 * @param angleStep — шаг свипа в градусах
 * @returns итог свипа; `null` — контрастности нет ни на одном угле
 */
const sweepAxis = (
  source: SheetImageData,
  axis: 'horizontal' | 'vertical',
  maxAngle: number,
  angleStep: number
): AxisSweep | null => {
  const sampleCount = Math.max(2, Math.round((2 * maxAngle) / angleStep));
  const contrasts = new Float64Array(sampleCount + 1);
  let bestIndex = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = -maxAngle + ((2 * maxAngle) / sampleCount) * index;
    const profile = buildShearedProfile(source, axis, angle, maxAngle);

    contrasts[index] = computeProfileContrast(profile.values);

    if ((contrasts[index] || 0) > (contrasts[bestIndex] || 0)) {
      bestIndex = index;
    }
  }

  const contrast = contrasts[bestIndex] || 0;

  if (contrast <= 0) {
    return null;
  }

  const spacing = (2 * maxAngle) / sampleCount;
  const isInside = bestIndex > 0 && bestIndex < sampleCount;
  const offset = isInside
    ? refinePeakOffset(
        contrasts[bestIndex - 1] || 0,
        contrast,
        contrasts[bestIndex + 1] || 0
      )
    : 0;

  return { angle: -maxAngle + (bestIndex + offset) * spacing, contrast };
};

/**
 * Наклон по одним горизонтальным линиям, без сверки по вертикалям: угол, с
 * которым сверяется итог `detectSkewAngle`, — поправка по вертикалям не должна
 * восстанавливать линии хуже него.
 *
 * @param image — полутоновая выжимка фотографии листа
 * @param options — настройки свипа
 * @returns наклон в градусах; `0` на изображении без разлиновки
 */
export const detectRowSkewAngle = (
  image: SheetImageData,
  options: SkewDetectionOptions = {}
): number => {
  const {
    maxAngle = MAX_SKEW_ANGLE,
    angleStep = SKEW_ANGLE_STEP,
    maxAnalysisSize = ANALYSIS_IMAGE_SIZE,
  } = options;

  if (maxAngle <= 0 || angleStep <= 0) {
    return 0;
  }

  const rows = sweepAxis(
    downsampleSheetImage(image, maxAnalysisSize),
    'horizontal',
    maxAngle,
    angleStep
  );

  return rows ? rows.angle : 0;
};

/**
 * Измеряет наклон разлиновки свипом по узкому диапазону углов — по
 * горизонтальным линиям, со сверкой по вертикалям.
 *
 * Свип по линиям меряет их резкость во всём кадре и на изогнутом листе тянется
 * к наклону крутой половины линии. Вертикали — линия поля, концы линий, линии
 * клетки — от изгиба горизонтальных линий не зависят. Если угол, найденный по
 * линиям, размывает вертикали меньше чем до половины их лучшей резкости, он
 * уведён изгибом, и берётся угол вертикалей. Иначе остаётся угол линий:
 * линейная часть изгиба уходит в сам изгиб.
 *
 * Фотография не выправляется — наклон только измеряется: выпрямление это
 * пересемплирование, оно размывает текстуру бумаги.
 *
 * Свип идёт по уменьшенной копии: углы масштаб не меняет, а цена свипа линейна
 * по числу точек.
 *
 * @param image — полутоновая выжимка фотографии листа
 * @param options — настройки свипа
 * @returns наклон в градусах, положительный — линии идут вниз слева направо; `0` на изображении без разлиновки
 */
export const detectSkewAngle = (
  image: SheetImageData,
  options: SkewDetectionOptions = {}
): number => {
  const {
    maxAngle = MAX_SKEW_ANGLE,
    angleStep = SKEW_ANGLE_STEP,
    maxAnalysisSize = ANALYSIS_IMAGE_SIZE,
  } = options;

  if (maxAngle <= 0 || angleStep <= 0) {
    return 0;
  }

  const source = downsampleSheetImage(image, maxAnalysisSize);
  const rows = sweepAxis(source, 'horizontal', maxAngle, angleStep);

  if (!rows) {
    return 0;
  }

  const columns = sweepAxis(source, 'vertical', maxAngle, angleStep);

  if (!columns) {
    return rows.angle;
  }

  const smearedContrast = computeProfileContrast(
    buildShearedProfile(source, 'vertical', rows.angle, maxAngle).values
  );

  return smearedContrast < VERTICAL_SMEAR_RATIO * columns.contrast
    ? columns.angle
    : rows.angle;
};
