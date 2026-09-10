import { fitSheetToPage } from '../lib/paper';

import { buildPageRenderParams } from './buildPageRenderParams';
import { mirrorLightingField } from './mirrorLightingField';
import type { PageRenderTask, PageTaskInput } from './pageTask.types';

/**
 * Собирает задание на отрисовку страницы.
 *
 * Ресурсы в параметры не кладутся: фотография листа, карта текстуры и контуры
 * шрифта остаются адресами и подставляются уже там, где страница рисуется.
 * Иначе задание не прошло бы через границу воркера — картинка и замыкания над
 * разобранным шрифтом structured clone не переживают.
 *
 * Освещение при этом едет в параметрах как есть: это сетка чисел, и отразить
 * её вместе с листом дешевле здесь, чем гонять признак отражения дальше.
 *
 * @param input — состояние генератора, раскладка страницы и её ресурсы
 * @returns задание на отрисовку
 */
export const buildPageTask = (input: PageTaskInput): PageRenderTask => {
  const { family, sheet, isBackgroundHidden, isMirrored, runSeed, font, quality } = input;
  const sheetLighting = sheet?.lighting || null;
  const lighting = isMirrored ? mirrorLightingField(sheetLighting) : sheetLighting;
  const hasBackground = Boolean(sheet) && !isBackgroundHidden;

  return {
    params: buildPageRenderParams({
      page: input.page,
      family,
      sheet,
      sheetImage: null,
      metrics: input.metrics,
      correction: input.correction,
      isMirrored,
      inkColor: input.inkColor,
      fontFamily: input.fontFamily,
      flags: input.flags,
      wordFrequency: input.wordFrequency,
      letterFrequency: input.letterFrequency,
      seed: input.seed,
      ink: { lighting, texture: null, seed: runSeed },
      glyphs: null,
      scale: input.scale,
    }),
    sheet:
      hasBackground && sheet
        ? {
            src: sheet.src,
            width: sheet.width,
            height: sheet.height,
            isMirrored,
            placement: fitSheetToPage(sheet, family, isMirrored),
          }
        : null,
    textureSrc: sheet?.texture?.src || null,
    font,
    pageWidth: family.width,
    pageHeight: family.height,
    quality,
  };
};
