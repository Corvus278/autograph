export type SliderProps = {
  /**
   * Подпись контрола.
   */
  label: string;

  /**
   * Текущее значение параметра.
   */
  value: number;

  /**
   * Наименьшее допустимое значение.
   */
  min: number;

  /**
   * Наибольшее допустимое значение.
   */
  max: number;

  /**
   * Шаг изменения.
   */
  step: number;

  /**
   * Колбэк на изменение значения.
   */
  onChange: (value: number) => void;

  /**
   * Контрол недоступен.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
