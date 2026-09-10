import { readBlobAsDataUrl } from './readBlobAsDataUrl';

/**
 * Читает файл как data URL. Картинки фона и сцены нужны генератору именно так:
 * снимок страницы делается из DOM, и ссылка на `blob:` в нём протухнет раньше,
 * чем пользователь нажмёт «Сохранить».
 *
 * @param file — выбранный пользователем файл
 * @returns data URL содержимого
 */
export const readFileAsDataUrl = (file: File): Promise<string> => {
  return readBlobAsDataUrl(file);
};
