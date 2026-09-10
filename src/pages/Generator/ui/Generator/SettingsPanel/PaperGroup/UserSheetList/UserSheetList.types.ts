import type { PaperSheet } from '../../../../../lib/paper';

export type UserSheetListProps = {
  /**
   * Загруженные пользователем экземпляры текущей семьи.
   */
  sheets: PaperSheet[];

  /**
   * Колбэк на удаление экземпляра.
   */
  onRemove: (sheetId: string) => void;
};
