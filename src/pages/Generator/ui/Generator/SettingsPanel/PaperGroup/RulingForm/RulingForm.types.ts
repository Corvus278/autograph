import type { PaperMargins, SheetRuling } from '../../../../../lib/paper';

/**
 * Разлиновка, заданная руками. Все длины — в пикселях фотографии: пользователь
 * меряет их по своему снимку, а не по канону семьи.
 */
export type ManualRuling = {
  /**
   * Шаг разлиновки: расстояние между соседними линиями.
   */
  step: number;

  /**
   * Смещение первой линии от верха фотографии.
   */
  firstLinePhase: number;

  /**
   * Поля листа.
   */
  margins: PaperMargins;
};

/**
 * Значения полей формы как их ввёл пользователь. Строки, а не числа: поле
 * бывает пустым, пока его правят.
 */
export type RulingFormValues = {
  /**
   * Шаг разлиновки.
   */
  step: string;

  /**
   * Смещение первой линии от верха фотографии.
   */
  firstLinePhase: string;

  /**
   * Верхнее поле.
   */
  marginTop: string;

  /**
   * Правое поле.
   */
  marginRight: string;

  /**
   * Нижнее поле.
   */
  marginBottom: string;

  /**
   * Левое поле.
   */
  marginLeft: string;
};

export type RulingFormProps = {
  /**
   * Разлиновка правимого экземпляра: из неё форма берёт начальные значения.
   */
  ruling: SheetRuling;

  /**
   * Колбэк на применение введённой разлиновки.
   */
  onApply: (ruling: ManualRuling) => void;
};
