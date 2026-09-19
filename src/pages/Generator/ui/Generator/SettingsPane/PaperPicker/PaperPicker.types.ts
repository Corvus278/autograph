export type PaperPickerProps = {
  /**
   * Колбэк на кнопку настройки своего листа: открывает диалог листа.
   */
  onSheetSettingsOpen: (sheetId: string) => void;
};
