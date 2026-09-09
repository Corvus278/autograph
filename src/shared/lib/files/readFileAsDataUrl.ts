/**
 * Читает файл как data URL. Картинки фона и сцены нужны генератору именно так:
 * снимок страницы делается из DOM, и ссылка на `blob:` в нём протухнет раньше,
 * чем пользователь нажмёт «Сохранить».
 */
export const readFileAsDataUrl = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const { result } = reader;

      if (typeof result === 'string') {
        resolve(result);

        return;
      }

      reject(new Error('Файл прочитан не как data URL'));
    });
    reader.addEventListener('error', () => {
      reject(new Error('Не удалось прочитать файл'));
    });
    reader.readAsDataURL(file);
  });
};
