import type { DistortionFlags } from '../../../../../lib/randomize/randomize.types';

/**
 * Переключатель одного вида искажений.
 */
export type DistortionOption = {
  /**
   * Поле в наборе флагов, которым управляет переключатель.
   */
  flag: keyof DistortionFlags;

  /**
   * Подпись переключателя.
   */
  label: string;
};
