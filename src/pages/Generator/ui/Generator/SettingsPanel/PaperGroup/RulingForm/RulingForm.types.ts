import type { PaperMargins, PaperRuling, PaperSheet } from '../../../../../lib/paper';

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
   * Экземпляр, характеристики которого правятся.
   */
  sheet: PaperSheet;

  /**
   * Канон семьи: из него берутся поля, пока пользователь не задал свои.
   */
  ruling: PaperRuling;

  /**
   * Колбэк на применение введённой разлиновки.
   */
  onApply: (ruling: ManualRuling) => void;
};
