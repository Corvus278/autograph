/**
 * Читает блоб как data URL.
 *
 * Именно data URL, а не `blob:`-ссылка: адрес объекта живёт до тех пор, пока
 * его не освободили, и протухает раньше, чем пользователь дожмёт «Сохранить»;
 * содержимое в строке не протухает никогда.
 *
 * @param blob — содержимое файла
 * @returns data URL содержимого
 */
export const readBlobAsDataUrl = (blob: Blob): Promise<string> => {
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
    reader.readAsDataURL(blob);
  });
};
