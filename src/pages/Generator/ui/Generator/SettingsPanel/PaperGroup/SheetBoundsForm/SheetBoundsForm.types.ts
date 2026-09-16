import type { PaperMargins, PaperSheet } from '../../../../../lib/paper';

/**
 * Значения полей формы как их ввёл пользователь. Строки, а не числа: поле
 * бывает пустым, пока его правят.
 */
export type SheetBoundsFormValues = {
  /**
   * Отступ листа от верхнего края кадра.
   */
  top: string;

  /**
   * Отступ листа от правого края кадра.
   */
  right: string;

  /**
   * Отступ листа от нижнего края кадра.
   */
  bottom: string;

  /**
   * Отступ листа от левого края кадра.
   */
  left: string;
};

export type SheetBoundsFormProps = {
  /**
   * Правимый лист: из его контура и кадра форма берёт начальные значения.
   */
  sheet: PaperSheet;

  /**
   * Идёт перемер: кнопка недоступна.
   */
  isBusy: boolean;

  /**
   * Сообщение об ошибке перемера. `null` — ошибки нет.
   */
  error: string | null;

  /**
   * Колбэк на применение введённых границ — отступов от краёв кадра в
   * пикселях фотографии.
   */
  onApply: (bounds: PaperMargins) => void;
};
