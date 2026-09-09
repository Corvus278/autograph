export type ColorInputProps = {
  /**
   * Подпись контрола.
   */
  label: string;

  /**
   * Выбранный цвет в формате `#rrggbb`.
   */
  value: string;

  /**
   * Колбэк на изменение цвета.
   */
  onChange: (value: string) => void;

  /**
   * Контрол недоступен.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
