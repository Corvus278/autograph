import type { ParameterRange } from '../../../../../config';
import type { GeneratorGeometryCorrection } from '../../../../../model/generator.types';

/**
 * Слайдер одной поправки геометрии.
 */
export type GeometrySliderOption = {
  /**
   * Поле поправки, которым управляет слайдер.
   */
  field: keyof GeneratorGeometryCorrection;

  /**
   * Подпись слайдера.
   */
  label: string;

  /**
   * Границы и шаг поправки в долях шага разлиновки.
   */
  range: ParameterRange;
};
