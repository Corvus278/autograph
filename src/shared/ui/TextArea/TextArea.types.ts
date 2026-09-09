export type TextAreaProps = {
  /**
   * Подпись контрола.
   */
  label: string;

  /**
   * Текущее содержимое поля.
   */
  value: string;

  /**
   * Колбэк на ввод текста.
   */
  onChange: (value: string) => void;

  /**
   * Высота поля в строках.
   */
  rows?: number;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
