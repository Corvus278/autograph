import type { PaperFamily, PaperSheet, RulingDetection } from './paper.types';

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
 * @param sheet — остальные характеристики экземпляра
 * @returns экземпляр с посчитанным коэффициентом нормировки
 */
export const buildNormalizedSheet = (
  detection: Pick<RulingDetection, 'step' | 'firstLinePhase'>,
  family: Pick<PaperFamily, 'ruling'>,
  sheet: Omit<PaperSheet, 'measuredStep' | 'normalizeScale' | 'firstLinePhase'>
): PaperSheet => {
  return {
    ...sheet,
    measuredStep: detection.step,
    normalizeScale: computeNormalizeScale(detection.step, family.ruling.step),
    firstLinePhase: detection.firstLinePhase,
  };
};
