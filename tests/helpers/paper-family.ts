import type { PaperFamily, PaperSheet, SheetRuling } from '@pages/Generator/lib/paper';

type SheetSize = Pick<PaperSheet, 'width' | 'height'>;

/**
 * Разлиновка листа-пустышки в пикселях его кадра: все поля найдены, линия поля
 * слева. Совпадает с каноном `buildFamily` — пустышка снята ровно в меру семьи.
 */
const LINED_SHEET_RULING: SheetRuling = {
  step: 40,
  firstLinePhase: 80,
  skewAngle: 0,
  margins: { top: 80, right: 40, bottom: 60, left: 60 },
  marginLineX: 60,
  marginLineSide: 'left',
};

const LINED_SHEET_SIZE: SheetSize = { width: 1600, height: 2000 };

/**
 * Разлиновка листа-модели для отрисовки и раскладки в пикселях кадра 200×400.
 * Нулевые поля слева и снизу — не «сторона не найдена»: это готовая
 * разлиновка, а не вывод детектора, и фолбэк к ней не применяется.
 */
const RENDER_SHEET_RULING: SheetRuling = {
  step: 40,
  firstLinePhase: 41.25,
  skewAngle: 0,
  margins: { top: 40, right: 100, bottom: 0, left: 0 },
  marginLineX: null,
  marginLineSide: null,
};

const RENDER_SHEET_SIZE: SheetSize = { width: 200, height: 400 };

/**
 * Экземпляр листа с заданной разлиновкой. Устаревшие поля заполняются из неё
 * же, с единичной нормировкой, — чтобы непереведённые потребители видели тот
 * же лист.
 *
 * @param id — идентификатор экземпляра
 * @param ruling — разлиновка в пикселях кадра
 * @param size — размеры кадра
 * @returns экземпляр без освещения и текстуры
 */
export const buildSheet = (
  id: string,
  ruling: SheetRuling = LINED_SHEET_RULING,
  size: SheetSize = LINED_SHEET_SIZE
): PaperSheet => {
  const { step, firstLinePhase, skewAngle } = ruling;

  return {
    id,
    label: id,
    src: `/${id}.jpg`,
    ...size,
    ruling,
    skewAngle,
    measuredStep: step,
    normalizeScale: 1,
    firstLinePhase,
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
    kind: 'lined',
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
 *
 * Кадр и разлиновка экземпляров совпадают с каноном семьи, поэтому числа
 * одни и те же, читать ли их из листа или из семьи.
 */
export const buildRenderFamily = (): PaperFamily => {
  return {
    id: 'lined',
    label: 'Линейка',
    kind: 'lined',
    width: 200,
    height: 400,
    ruling: {
      kind: 'lined',
      step: 40,
      firstLineOffset: 41.25,
      margins: { top: 40, right: 100, bottom: 0, left: 0 },
      marginLineX: null,
    },
    sheets: [
      buildSheet('sheet-0', RENDER_SHEET_RULING, RENDER_SHEET_SIZE),
      buildSheet('sheet-1', RENDER_SHEET_RULING, RENDER_SHEET_SIZE),
    ],
  };
};
