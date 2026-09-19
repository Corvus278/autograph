import type { ParameterRange } from '../../../../../config';
import type { ValueFormatter } from '../../../../../lib/format';
import type { GeneratorSceneParams } from '../../../../../model/generator.types';

/**
 * Слайдер одного числового параметра вложения в сцену.
 */
export type SceneSliderOption = {
  /**
   * Параметр, которым управляет слайдер.
   */
  field: keyof Omit<GeneratorSceneParams, 'hasSceneShadow'>;

  /**
   * Подпись слайдера.
   */
  label: string;

  /**
   * Границы и шаг параметра.
   */
  range: ParameterRange;

  /**
   * Подпись значения с единицей.
   */
  formatValue: ValueFormatter;
};
