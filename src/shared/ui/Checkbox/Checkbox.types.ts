export type CheckboxProps = {
  /**
   * Подпись рядом с флажком.
   */
  label: string;

  /**
   * Флажок включён.
   */
  isChecked: boolean;

  /**
   * Колбэк на переключение.
   */
  onChange: (isChecked: boolean) => void;

  /**
   * Контрол недоступен.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
