import { downloadDataUrl } from './downloadDataUrl';

/**
 * Отдаёт блоб пользователю как файл.
 *
 * Через адрес объекта, а не через data URL: архив пачки весит десятки
 * мегабайт, и перекодирование его в строку удвоило бы расход памяти вкладки на
 * ровном месте.
 *
 * Адрес освобождается следующим тиком: браузер к этому моменту уже забрал
 * содержимое по клику, а объект не остаётся висеть в памяти до перезагрузки.
 *
 * @param blob — содержимое файла
 * @param fileName — имя, под которым файл сохранится
 */
export const downloadBlob = (blob: Blob, fileName: string): void => {
  const objectUrl = URL.createObjectURL(blob);

  downloadDataUrl(objectUrl, fileName);

  globalThis.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 0);
};
