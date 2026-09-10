import type { SheetImageData } from './paper.types';

/**
 * Длинная сторона уменьшенной копии по умолчанию. Свип угла проходит по
 * изображению четыре десятка раз, поэтому его цена линейна по числу пикселей:
 * на семистах точках длинной стороны свип укладывается в десятки миллисекунд,
 * на полном снимке телефона — в секунды. Разлиновка при этом остаётся
 * различимой: шаг тетрадной клетки на снимке листа целиком занимает не меньше
 * десятка точек уменьшенной копии.
 */
export const ANALYSIS_IMAGE_SIZE = 700;

/**
 * Уменьшает полутоновую выжимку усреднением по прямоугольникам исходника:
 * длинная сторона результата не превышает `maxSize`, пропорции сохраняются.
 * Усреднение, а не выборка каждой n-й точки: выборка даёт муар на разлиновке,
 * а именно её потом и ищут.
 *
 * Углы масштаб не меняет, поэтому на уменьшенной копии измеряют наклон. Длины
 * — меняет: шаг, фазу и поля меряют на исходном изображении.
 *
 * @param image — исходная выжимка
 * @param maxSize — предел длинной стороны в пикселях; ноль и меньше отключают уменьшение
 * @returns уменьшенная копия либо исходное изображение, если оно и так меньше предела
 */
export const downsampleSheetImage = (
  image: SheetImageData,
  maxSize: number
): SheetImageData => {
  const { width, height, luminance } = image;
  const longestSide = Math.max(width, height);

  if (maxSize <= 0 || longestSide <= maxSize || width < 2 || height < 2) {
    return image;
  }

  const scale = maxSize / longestSide;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));
  const values = new Float32Array(targetWidth * targetHeight);

  for (let targetY = 0; targetY < targetHeight; targetY += 1) {
    const sourceTop = Math.floor((targetY * height) / targetHeight);
    const sourceBottom = Math.max(
      sourceTop + 1,
      Math.floor(((targetY + 1) * height) / targetHeight)
    );

    for (let targetX = 0; targetX < targetWidth; targetX += 1) {
      const sourceLeft = Math.floor((targetX * width) / targetWidth);
      const sourceRight = Math.max(
        sourceLeft + 1,
        Math.floor(((targetX + 1) * width) / targetWidth)
      );
      let sum = 0;
      let count = 0;

      for (let y = sourceTop; y < sourceBottom; y += 1) {
        const row = y * width;

        for (let x = sourceLeft; x < sourceRight; x += 1) {
          sum += luminance[row + x] || 0;
          count += 1;
        }
      }

      values[targetY * targetWidth + targetX] = count > 0 ? sum / count : 0;
    }
  }

  return { width: targetWidth, height: targetHeight, luminance: values };
};
