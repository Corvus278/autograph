/**
 * Отдаёт data URL пользователю как файл. Ссылку создаём и кликаем сами:
 * снимок страницы живёт только в памяти, скачивать нечего, кроме него.
 */
export const downloadDataUrl = (dataUrl: string, fileName: string): void => {
  const link = document.createElement('a');

  link.href = dataUrl;
  link.download = fileName;
  link.click();
};
