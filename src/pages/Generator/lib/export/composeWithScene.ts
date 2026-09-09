import type { SceneComposeParams } from './export.types';
import { fitPageIntoScene } from './fitPageIntoScene';

/**
 * Тень под страницей: мягкая и почти без сдвига — задача не нарисовать
 * объёмный объект, а отделить лист от фона сцены.
 */
const SHADOW_COLOR = '#555555';
const SHADOW_BLUR = 5;
const SHADOW_OFFSET_Y = 2;

const loadImage = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.addEventListener('load', () => {
      resolve(image);
    });
    image.addEventListener('error', () => {
      reject(new Error('Не удалось загрузить изображение'));
    });
    image.src = src;
  });
};

/**
 * Вкладывает снимок страницы в сцену и отдаёт PNG композиции как data URL.
 * Размер результата — размер сцены: сцена задаёт кадр, страница в него
 * вписывается.
 */
export const composeWithScene = async (
  pageDataUrl: string,
  sceneSrc: string,
  params: SceneComposeParams
): Promise<string> => {
  const { rotate, shiftX, shiftY, scale, darken, hasShadow } = params;
  const [scene, page] = await Promise.all([loadImage(sceneSrc), loadImage(pageDataUrl)]);
  const canvas = document.createElement('canvas');

  canvas.width = scene.naturalWidth;
  canvas.height = scene.naturalHeight;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Браузер не дал контекст canvas');
  }

  context.drawImage(scene, 0, 0, canvas.width, canvas.height);

  const placement = fitPageIntoScene({
    pageWidth: page.naturalWidth,
    pageHeight: page.naturalHeight,
    sceneWidth: canvas.width,
    sceneHeight: canvas.height,
    scale,
  });

  context.save();
  context.translate(
    placement.x + placement.width / 2 + shiftX,
    placement.y + placement.height / 2 + shiftY
  );
  context.rotate((rotate * Math.PI) / 180);

  if (hasShadow) {
    context.shadowColor = SHADOW_COLOR;
    context.shadowBlur = SHADOW_BLUR;
    context.shadowOffsetY = SHADOW_OFFSET_Y;
  }

  context.drawImage(
    page,
    -placement.width / 2,
    -placement.height / 2,
    placement.width,
    placement.height
  );
  context.shadowColor = 'transparent';
  context.fillStyle = `rgba(0, 0, 0, ${darken})`;
  context.fillRect(
    -placement.width / 2,
    -placement.height / 2,
    placement.width,
    placement.height
  );
  context.restore();

  return canvas.toDataURL('image/png');
};
