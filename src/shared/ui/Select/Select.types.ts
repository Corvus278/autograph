export type SelectOption = {
  /**
   * Значение, которое уедет в колбэк при выборе.
   */
  value: string;

  /**
   * Подпись пункта в списке.
   */
  label: string;
};

export type SelectProps = {
  /**
   * Подпись контрола.
   */
  label: string;

  /**
   * Выбранное значение.
   */
  value: string;

  /**
   * Пункты списка.
   */
  options: SelectOption[];

  /**
   * Колбэк на выбор пункта.
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
