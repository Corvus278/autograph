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
 * Измеряет наклон разлиновки свипом по узкому диапазону углов: для каждого
 * угла изображение схлопывается в профиль средней яркости вдоль наклонных
 * линий, и берётся угол наибольшей контрастности профиля. Вершина уточняется
 * параболой по соседним отсчётам свипа, поэтому точность не упирается в шаг.
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
  const sampleCount = Math.max(2, Math.round((2 * maxAngle) / angleStep));
  const contrasts = new Float64Array(sampleCount + 1);
  let bestIndex = 0;

  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = -maxAngle + ((2 * maxAngle) / sampleCount) * index;
    const profile = buildShearedProfile(source, 'horizontal', angle, maxAngle);

    contrasts[index] = computeProfileContrast(profile.values);

    if ((contrasts[index] || 0) > (contrasts[bestIndex] || 0)) {
      bestIndex = index;
    }
  }

  if ((contrasts[bestIndex] || 0) <= 0) {
    return 0;
  }

  const spacing = (2 * maxAngle) / sampleCount;
  const isInside = bestIndex > 0 && bestIndex < sampleCount;
  const offset = isInside
    ? refinePeakOffset(
        contrasts[bestIndex - 1] || 0,
        contrasts[bestIndex] || 0,
        contrasts[bestIndex + 1] || 0
      )
    : 0;

  return -maxAngle + (bestIndex + offset) * spacing;
};
