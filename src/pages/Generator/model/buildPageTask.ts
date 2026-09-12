import { buildPageRenderParams, isMirroredPage } from './buildPageRenderParams';
import { getPageCalibration } from './geometrySelectors';
import { mirrorLightingField } from './mirrorLightingField';
import type { PageRenderTask, PageTaskInput } from './pageTask.types';

/**
 * Масштаб снимка: страница рисуется в кадре своего листа один к одному. Выше
 * разрешения фотографии детализации взять неоткуда, а ниже — значило бы
 * выбросить уже снятую текстуру бумаги.
 */
const FRAME_SCALE = 1;

/**
 * Собирает задание на отрисовку страницы.
 *
 * Страница равна кадру доставшегося ей листа — и тогда, когда фон скрыт: иначе
 * скрытие фона меняло бы размер снимка и положение текста на нём. Геометрия
 * считается по разлиновке страницы (`getPageCalibration`) — той же, по
 * которой страница разложена.
 *
 * Ресурсы в параметры не кладутся: фотография листа, карта текстуры и контуры
 * шрифта остаются адресами и подставляются уже там, где страница рисуется.
 * Иначе задание не прошло бы через границу воркера — картинка и замыкания над
 * разобранным шрифтом structured clone не переживают.
 *
 * Освещение при этом едет в параметрах как есть: это сетка чисел, и отразить
 * её вместе с листом дешевле здесь, чем гонять признак отражения дальше.
 *
 * @param input — состояние генератора, раскладка страницы, её лист и ресурсы
 * @returns задание на отрисовку
 */
export const buildPageTask = (input: PageTaskInput): PageRenderTask => {
  const { page, family, sheet, pageIndex, isBackgroundHidden, runSeed, font, quality } =
    input;
  const isMirrored = isMirroredPage(pageIndex);
  const lighting = isMirrored ? mirrorLightingField(sheet.lighting) : sheet.lighting;

  return {
    params: buildPageRenderParams({
      page,
      calibration: getPageCalibration(family, sheet, pageIndex),
      sheetImage: null,
      metrics: input.metrics,
      correction: input.correction,
      inkColor: input.inkColor,
      fontFamily: input.fontFamily,
      flags: input.flags,
      wordFrequency: input.wordFrequency,
      letterFrequency: input.letterFrequency,
      seed: input.seed,
      ink: { lighting, texture: null, seed: runSeed },
      glyphs: null,
      scale: FRAME_SCALE,
    }),
    sheet: isBackgroundHidden
      ? null
      : { src: sheet.src, width: sheet.width, height: sheet.height, isMirrored },
    textureSrc: sheet.texture?.src || null,
    font,
    pageWidth: sheet.width,
    pageHeight: sheet.height,
    quality,
  };
};
