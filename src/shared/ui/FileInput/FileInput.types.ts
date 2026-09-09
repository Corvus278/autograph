export type FileInputProps = {
  /**
   * Подпись контрола.
   */
  label: string;

  /**
   * Значение атрибута `accept`: какие файлы предлагать в диалоге выбора.
   */
  accept: string;

  /**
   * Колбэк на выбор файла.
   */
  onSelect: (file: File) => void;

  /**
   * Сообщение об ошибке под контролом. `null` — ошибки нет.
   */
  error?: string | null;

  /**
   * Контрол недоступен.
   */
  isDisabled?: boolean;

  /**
   * Дополнительные классы.
   */
  className?: string;
};
