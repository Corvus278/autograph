import type { PaperFamily, PaperRuling, PaperSheet } from '../lib/paper/paper.types';

import type { PaperSheetProfiles, PhotoSize } from './config.types';

/**
 * Пикселей на миллиметр в каноне семьи. Канон меряется в пикселях, а бумага —
 * в миллиметрах, поэтому масштаб задаётся один раз и здесь: при десяти
 * пикселях на миллиметр клетка в пять миллиметров получает ровно пятьдесят
 * пикселей, а канонический лист выходит одного порядка с фотографиями
 * пресет-пака — коэффициент нормировки у них остаётся рядом с единицей.
 */
export const CANONICAL_PX_PER_MM = 10;

/**
 * Переводит миллиметры в канонические пиксели семьи.
 *
 * @param millimeters — длина в миллиметрах
 * @returns длина в канонических пикселях
 */
const toCanonicalPx = (millimeters: number): number => {
  return millimeters * CANONICAL_PX_PER_MM;
};

/**
 * Размеры страницы школьной тетради: разворот A4, сложенный пополам. Ширина
 * чуть больше половины длинной стороны A4, потому что край уходит в сшивку.
 */
const SHEET_WIDTH_MM = 165;
const GRID_SHEET_HEIGHT_MM = 210;
const LINED_SHEET_HEIGHT_MM = 205;

/**
 * Сторона клетки в тетради в клетку — пять миллиметров: единственный размер,
 * который встречается в школьных тетрадях.
 */
const GRID_CELL_MM = 5;

/**
 * Шаг линейки — восемь миллиметров: размер тетради в широкую линейку, в
 * которой пишут начиная со средней школы. Узкая линейка встречается только в
 * прописях, её в пресет-пак не берём.
 */
const LINED_STEP_MM = 8;

/**
 * Поля листа в миллиметрах. Клетка обрывается ближе к краю, чем линейка:
 * сетка печатается почти во весь лист, а линейка оставляет заметный запас
 * сверху и снизу.
 */
const GRID_MARGIN_MM = { top: 10, right: 8, bottom: 10, left: 8 };
const LINED_MARGIN_MM = { top: 15, right: 8, bottom: 12, left: 10 };

/**
 * Отступ вертикальной линии поля от левого края в тетради в линейку. В клетку
 * линию поля не печатают — её отчерчивают вручную, поэтому у семьи в клетку
 * линии поля нет.
 */
const LINED_MARGIN_LINE_MM = 25;

/**
 * Число экземпляров в каждой предустановленной семье. Четыре — нижняя граница
 * требования: на меньшем числе правило «соседние страницы не получают один
 * экземпляр» вырождается в чередование двух фотографий.
 */
const PRESET_SHEET_COUNT = 4;

/**
 * Размеры фотографий пресет-пака в пикселях. Нужны до загрузки артефакта
 * профилей: по ним считается высота страницы, а картинка ещё не пришла.
 */
const GRID_PHOTO_SIZE = { width: 1600, height: 2050 };
const LINED_PHOTO_SIZE = { width: 1550, height: 2000 };

/**
 * Каноническая разлиновка семьи в клетку.
 */
export const GRID_RULING: PaperRuling = {
  kind: 'grid',
  step: toCanonicalPx(GRID_CELL_MM),
  firstLineOffset: toCanonicalPx(GRID_MARGIN_MM.top),
  margins: {
    top: toCanonicalPx(GRID_MARGIN_MM.top),
    right: toCanonicalPx(GRID_MARGIN_MM.right),
    bottom: toCanonicalPx(GRID_MARGIN_MM.bottom),
    left: toCanonicalPx(GRID_MARGIN_MM.left),
  },
  marginLineX: null,
};

/**
 * Каноническая разлиновка семьи в линейку.
 */
export const LINED_RULING: PaperRuling = {
  kind: 'lined',
  step: toCanonicalPx(LINED_STEP_MM),
  firstLineOffset: toCanonicalPx(LINED_MARGIN_MM.top),
  margins: {
    top: toCanonicalPx(LINED_MARGIN_MM.top),
    right: toCanonicalPx(LINED_MARGIN_MM.right),
    bottom: toCanonicalPx(LINED_MARGIN_MM.bottom),
    left: toCanonicalPx(LINED_MARGIN_MM.left),
  },
  marginLineX: toCanonicalPx(LINED_MARGIN_LINE_MM),
};

/**
 * Идентификаторы предустановленных семей. По ним артефакт профилей находит,
 * какие измерения к какой семье относятся.
 */
export const GRID_FAMILY_ID = 'grid';
export const LINED_FAMILY_ID = 'lined';

/**
 * Экземпляры семьи без измерений: фотографии на месте, характеристики —
 * нейтральные. Такая семья работает и без артефакта профилей, только текст
 * ложится по канону семьи, а не по конкретной фотографии.
 *
 * Нормировка при этом не единица, а масштаб, при котором фотография
 * закрывает канонический лист целиком: вход по условию обрезан по краям листа,
 * поэтому без измерений разумно считать, что кадр — это и есть лист. Из того
 * же масштаба выводятся шаг и фаза в пикселях фотографии: они обязаны быть
 * согласованы с нормировкой, иначе разлиновка фотографии не села бы на канон.
 *
 * @param familyId — идентификатор семьи, к которой принадлежат экземпляры
 * @param labelPrefix — подпись семьи в списке экземпляров
 * @param ruling — канон семьи: из него берутся шаг и отступ первой линии
 * @param page — размеры канонического листа семьи в пикселях
 * @param size — размеры фотографий семьи в пикселях
 * @returns экземпляры семьи по порядку номеров файлов
 */
const buildPlainSheets = (
  familyId: string,
  labelPrefix: string,
  ruling: PaperRuling,
  page: PhotoSize,
  size: PhotoSize
): PaperSheet[] => {
  const sheets: PaperSheet[] = [];
  const normalizeScale = Math.max(page.width / size.width, page.height / size.height);

  for (let number = 1; number <= PRESET_SHEET_COUNT; number += 1) {
    sheets.push({
      id: `${familyId}-${number}`,
      label: `${labelPrefix} ${number}`,
      src: `/paper/${familyId}/${number}.jpg`,
      width: size.width,
      height: size.height,
      skewAngle: 0,
      measuredStep: ruling.step / normalizeScale,
      normalizeScale,
      firstLinePhase: ruling.firstLineOffset / normalizeScale,
      lighting: null,
      texture: null,
    });
  }

  return sheets;
};

/**
 * Размеры канонического листа семей в пикселях. Отдельными константами: тот же
 * размер идёт и в семью, и в нормировку её экземпляров без измерений.
 */
const GRID_PAGE_SIZE: PhotoSize = {
  width: toCanonicalPx(SHEET_WIDTH_MM),
  height: toCanonicalPx(GRID_SHEET_HEIGHT_MM),
};
const LINED_PAGE_SIZE: PhotoSize = {
  width: toCanonicalPx(SHEET_WIDTH_MM),
  height: toCanonicalPx(LINED_SHEET_HEIGHT_MM),
};

/**
 * Предустановленные семьи без измерений. Отдельной константой, потому что это
 * же значение служит запасным путём, когда артефакт профилей не загрузился.
 */
const PLAIN_FAMILIES: PaperFamily[] = [
  {
    id: GRID_FAMILY_ID,
    label: 'В клетку',
    ...GRID_PAGE_SIZE,
    ruling: GRID_RULING,
    sheets: buildPlainSheets(
      GRID_FAMILY_ID,
      'Клетка',
      GRID_RULING,
      GRID_PAGE_SIZE,
      GRID_PHOTO_SIZE
    ),
  },
  {
    id: LINED_FAMILY_ID,
    label: 'В линейку',
    ...LINED_PAGE_SIZE,
    ruling: LINED_RULING,
    sheets: buildPlainSheets(
      LINED_FAMILY_ID,
      'Линейка',
      LINED_RULING,
      LINED_PAGE_SIZE,
      LINED_PHOTO_SIZE
    ),
  },
];

/**
 * Собирает предустановленные семьи, подставляя посчитанные скриптом сборки
 * характеристики экземпляров. Разлиновка при этом всегда берётся из констант:
 * канон — решение, а не измерение, и от содержимого артефакта не зависит.
 *
 * Семья, которой в артефакте нет, остаётся с экземплярами без измерений —
 * пресеты доступны сразу, даже если артефакт ещё не собран.
 *
 * @param profiles — характеристики экземпляров по идентификатору семьи
 * @returns предустановленные семьи листов
 */
export const buildPaperFamilies = (profiles: PaperSheetProfiles): PaperFamily[] => {
  return PLAIN_FAMILIES.reduce<PaperFamily[]>((acc, family) => {
    const measured = profiles[family.id];

    acc.push(measured && measured.length > 0 ? { ...family, sheets: measured } : family);

    return acc;
  }, []);
};

/**
 * Предустановленные семьи без артефакта профилей: с ними генератор открывается
 * до того, как загрузится `public/paper/profiles.json`.
 */
export const PRESET_PAPER_FAMILIES: PaperFamily[] = buildPaperFamilies({});
