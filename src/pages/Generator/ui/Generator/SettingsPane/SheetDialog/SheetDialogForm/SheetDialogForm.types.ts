import type { PaperMargins, PaperSheet } from '../../../../../lib/paper';
import type { ManualRuling } from '../sheetDraft';

export type SheetDialogFormProps = {
  /**
   * Правимый лист: из него форма берёт фотографию и начальный черновик.
   */
  sheet: PaperSheet;

  /**
   * Лист добавлен без разлиновки.
   */
  isBlank: boolean;

  /**
   * Идёт перемер: кнопка перемера недоступна, рядом — индикатор.
   */
  isRemeasuring: boolean;

  /**
   * Сообщение об ошибке перемера. `null` — ошибки нет.
   */
  remeasureError: string | null;

  /**
   * Колбэк на перемер листа в границах черновика.
   */
  onRemeasure: (bounds: PaperMargins, isBlank: boolean) => void;

  /**
   * Колбэк на сохранение черновика разлиновки.
   */
  onSave: (ruling: ManualRuling, isBlank: boolean) => void;

  /**
   * Колбэк на подтверждённое удаление листа.
   */
  onDelete: () => void;

  /**
   * Колбэк на закрытие без сохранения.
   */
  onCancel: () => void;
};
