import type { PaperTexture, TextureMap } from './paper.types';

/**
 * Читает blob как data URL: карта текстуры живёт вместе с профилем листа в
 * локальном хранилище, а ссылка на `blob:` не переживает перезагрузку.
 */
const readBlobAsDataUrl = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.addEventListener('load', () => {
      const { result } = reader;

      if (typeof result === 'string') {
        resolve(result);

        return;
      }

      reject(new Error('Карта текстуры прочитана не как data URL'));
    });
    reader.addEventListener('error', () => {
      reject(new Error('Не удалось прочитать карту текстуры'));
    });
    reader.readAsDataURL(blob);
  });
};

/**
 * Переносит пиксели на канву и отдаёт её как data URL. `OffscreenCanvas`
 * предпочтительнее: кодирование карты уместно в воркере, куда элемент
 * `canvas` не попадает.
 */
const drawToDataUrl = async (imageData: ImageData): Promise<string> => {
  const { width, height } = imageData;

  if (typeof OffscreenCanvas === 'undefined') {
    if (typeof document === 'undefined') {
      throw new Error(
        'Кодировать карту текстуры негде: нет ни OffscreenCanvas, ни document'
      );
    }

    const canvas = document.createElement('canvas');

    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Канва для карты текстуры недоступна');
    }

    context.putImageData(imageData, 0, 0);

    const dataUrl = canvas.toDataURL('image/png');

    // Карта на мегапиксели держит за собой буфер канвы до сборки мусора,
    // а data URL к этому моменту уже самостоятелен.
    canvas.width = 0;
    canvas.height = 0;

    return dataUrl;
  }

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Канва для карты текстуры недоступна');
  }

  context.putImageData(imageData, 0, 0);

  const blob = await canvas.convertToBlob({ type: 'image/png' });

  return await readBlobAsDataUrl(blob);
};

/**
 * Упаковывает отклонения в пиксели RGBA: 0 и 255 — отклонение на `amplitude`
 * в тёмную и светлую сторону. Отклонения крупнее размаха срезаются границей,
 * поэтому разлиновка и соринки остаются пятнами и не растягивают шкалу всей
 * карты.
 *
 * Нулевое отклонение попадает на 128: ровной середины у восьмибитной шкалы
 * нет, ей отвечает 127.5. Постоянное смещение в полпроцента размаха неустранимо
 * без второго канала и тише любого другого источника шума в цепочке.
 *
 * Вынесена отдельно от кодирования в PNG: сама упаковка — арифметика, и
 * проверяется она без браузера.
 *
 * @param map — карта отклонений от `extractTexture`
 * @returns пиксели RGBA, серые и непрозрачные
 */
export const toTexturePixels = (map: TextureMap): Uint8ClampedArray<ArrayBuffer> => {
  const { width, height, values, amplitude } = map;
  const count = width * height;
  const pixels = new Uint8ClampedArray(count * 4);

  for (let index = 0; index < count; index += 1) {
    const ratio = amplitude > 0 ? (values[index] || 0) / amplitude : 0;
    const clamped = Math.min(1, Math.max(-1, ratio));
    const channel = Math.round(((clamped + 1) / 2) * 255);
    const offset = index * 4;

    pixels[offset] = channel;
    pixels[offset + 1] = channel;
    pixels[offset + 2] = channel;
    pixels[offset + 3] = 255;
  }

  return pixels;
};

/**
 * Кодирует сырую карту отклонений в полутоновое изображение для шейдера.
 * Единственный шаг конвейера, которому нужен браузер: PNG кодирует канва.
 *
 * @param map — карта отклонений от `extractTexture`
 * @returns карта как data URL вместе с размахом для обратного разворота
 */
export const encodeTextureMap = async (map: TextureMap): Promise<PaperTexture> => {
  const { width, height, amplitude } = map;

  if (width <= 0 || height <= 0) {
    return { src: '', width: 0, height: 0, amplitude: 0 };
  }

  const src = await drawToDataUrl(new ImageData(toTexturePixels(map), width, height));

  return { src, width, height, amplitude };
};
