export type BoundsFieldProps = {
  /**
   * Подпись поля.
   */
  label: string;

  /**
   * Введённое значение как есть: пока поле правят, оно бывает пустым.
   */
  value: string;

  /**
   * Колбэк на правку значения.
   */
  onChange: (value: string) => void;
};
