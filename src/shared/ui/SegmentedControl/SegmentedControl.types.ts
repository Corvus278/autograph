export type SegmentedControlOption = {
  /**
   * Значение, которое уедет в колбэк при выборе.
   */
  value: string;

  /**
   * Подпись сегмента.
   */
  label: string;
};

export type SegmentedControlProps = {
  /**
   * Доступное имя группы. Видимую подпись рисует секция, в которой группа
   * стоит.
   */
  label: string;

  /**
   * Выбранное значение.
   */
  value: string;

  /**
   * Сегменты по порядку.
   */
  options: SegmentedControlOption[];

  /**
   * Колбэк на выбор сегмента.
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
