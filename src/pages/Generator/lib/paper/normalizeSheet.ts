import type { PaperFamily, PaperSheet, RulingDetection } from './paper.types';
import { buildSheetRuling } from './sheetRuling';

/**
 * Измерения, из которых собирается экземпляр: шаг и фаза есть всегда, поля и
 * линия поля — только если детектор до них дошёл.
 */
type SheetDetection = Pick<RulingDetection, 'step' | 'firstLinePhase'> &
  Partial<Pick<RulingDetection, 'margins' | 'marginLineX' | 'marginLineSide'>>;

/**
 * Коэффициент приведения экземпляра к канону семьи.
 *
 * @param measuredStep — шаг разлиновки, измеренный на фотографии
 * @param canonicalStep — шаг разлиновки семьи
 * @returns множитель, переводящий пиксели фотографии в канонические
 */
export const computeNormalizeScale = (
  measuredStep: number,
  canonicalStep: number
): number => {
  const hasUsableSteps = measuredStep > 0 && canonicalStep > 0;

  if (!hasUsableSteps) {
    return 1;
  }

  return canonicalStep / measuredStep;
};

/**
 * Переводит длину из пикселей фотографии в канонические пиксели семьи.
 *
 * @param sheet — экземпляр с посчитанным коэффициентом нормировки
 * @param photoLength — длина в пикселях фотографии
 * @returns длина в канонических пикселях семьи
 */
export const toCanonicalLength = (sheet: PaperSheet, photoLength: number): number => {
  return photoLength * sheet.normalizeScale;
};

/**
 * Переводит длину из канонических пикселей семьи в пиксели фотографии.
 *
 * @param sheet — экземпляр с посчитанным коэффициентом нормировки
 * @param canonicalLength — длина в канонических пикселях семьи
 * @returns длина в пикселях фотографии
 */
export const toPhotoLength = (sheet: PaperSheet, canonicalLength: number): number => {
  return canonicalLength / sheet.normalizeScale;
};

/**
 * Собирает экземпляр семьи из результата измерений фотографии: нормировка
 * считается по шагу семьи, поэтому раскладка от экземпляра не зависит.
 *
 * @param detection — измеренная на фотографии разлиновка
 * @param family — семья, к канону которой приводится экземпляр
 * @param sheet — остальные характеристики экземпляра; наклон идёт и в разлиновку
 * @returns экземпляр с разлиновкой и посчитанным коэффициентом нормировки
 */
export const buildNormalizedSheet = (
  detection: SheetDetection,
  family: Pick<PaperFamily, 'ruling'>,
  sheet: Omit<PaperSheet, 'ruling' | 'measuredStep' | 'normalizeScale' | 'firstLinePhase'>
): PaperSheet => {
  return {
    ...sheet,
    ruling: buildSheetRuling({ ...detection, skewAngle: sheet.skewAngle }),
    measuredStep: detection.step,
    normalizeScale: computeNormalizeScale(detection.step, family.ruling.step),
    firstLinePhase: detection.firstLinePhase,
  };
};
