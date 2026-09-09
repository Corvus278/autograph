export type RadioGroupOption = {
  /**
   * Значение, которое уедет в колбэк при выборе.
   */
  value: string;

  /**
   * Подпись пункта.
   */
  label: string;
};

export type RadioGroupProps = {
  /**
   * Подпись группы.
   */
  label: string;

  /**
   * Выбранное значение.
   */
  value: string;

  /**
   * Пункты группы.
   */
  options: RadioGroupOption[];

  /**
   * Колбэк на выбор пункта.
   */
  onChange: (value: string) => void;

  /**
   * Группа недоступна.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
