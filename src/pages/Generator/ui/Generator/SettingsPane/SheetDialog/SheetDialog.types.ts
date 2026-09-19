export type SheetDialogProps = {
  /**
   * Лист, диалог которого открыт. `null` — диалог закрыт.
   */
  sheetId: string | null;

  /**
   * Колбэк на смену открытого листа: закрытие (`null`) и автооткрытие, когда
   * на добавленной фотографии не нашлась разлиновка.
   */
  onSheetIdChange: (sheetId: string | null) => void;
};
