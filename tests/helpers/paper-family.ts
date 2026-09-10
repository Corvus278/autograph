import type { PaperFamily, PaperSheet } from '@pages/Generator/lib/paper';

/**
 * Экземпляр листа-пустышка: рецепту важен только идентификатор, остальные
 * характеристики он не читает.
 */
export const buildSheet = (id: string): PaperSheet => {
  return {
    id,
    label: id,
    src: `/${id}.jpg`,
    width: 1600,
    height: 2000,
    skewAngle: 0,
    measuredStep: 40,
    normalizeScale: 1,
    firstLinePhase: 0,
    lighting: null,
    texture: null,
  };
};

/**
 * Семья из заданного числа экземпляров с идентификаторами `sheet-0`, `sheet-1`
 * и так далее.
 */
export const buildFamily = (sheetCount: number): PaperFamily => {
  const sheets: PaperSheet[] = [];

  for (let index = 0; index < sheetCount; index += 1) {
    sheets.push(buildSheet(`sheet-${index}`));
  }

  return {
    id: 'lined',
    label: 'Линейка',
    width: 1600,
    height: 2000,
    ruling: {
      kind: 'lined',
      step: 40,
      firstLineOffset: 80,
      margins: { top: 80, right: 40, bottom: 60, left: 60 },
      marginLineX: 60,
    },
    sheets,
  };
};

/**
 * Семья-модель для отрисовки и раскладки.
 *
 * Числа подобраны так, чтобы геометрия считалась в уме на запасных метриках
 * шрифта, которыми обходится jsdom: ширина блока выходит ровно сотней пикселей —
 * десять символов измерителя-модели, — а верхний отступ блока обращается в
 * ноль, поэтому высота под текст равна высоте листа без нижнего поля.
 */
export const buildRenderFamily = (): PaperFamily => {
  return {
    id: 'lined',
    label: 'Линейка',
    width: 200,
    height: 400,
    ruling: {
      kind: 'lined',
      step: 40,
      firstLineOffset: 41.25,
      margins: { top: 40, right: 100, bottom: 0, left: 0 },
      marginLineX: null,
    },
    sheets: [buildSheet('sheet-0'), buildSheet('sheet-1')],
  };
};
