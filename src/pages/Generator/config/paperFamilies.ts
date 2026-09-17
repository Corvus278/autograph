import { withBasePath } from '@shared/lib/url';

import type { PaperFamily, PaperSheet } from '../lib/paper/paper.types';
import { buildSheetRuling } from '../lib/paper/sheetRuling';

import type { PaperSheetProfiles, PhotoSize } from './config.types';

/**
 * Размеры страницы школьной тетради: разворот A4, сложенный пополам. Ширина
 * чуть больше половины длинной стороны A4, потому что край уходит в сшивку.
 */
const SHEET_WIDTH_MM = 165;
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
 * Сколько шагов разлиновки укладывается в кадр листа без измерений. Доли
 * выведены из миллиметровых размеров тетради: 165 мм ширины на клетку в 5 мм
 * и 205 мм высоты на шаг линейки в 8 мм. Клетка мерится по ширине, линейка —
 * по высоте: вдоль этой стороны у каждой из них шаг и задан.
 */
const GRID_STEPS_ACROSS = SHEET_WIDTH_MM / GRID_CELL_MM;
const LINED_STEPS_DOWN = Math.floor(LINED_SHEET_HEIGHT_MM / LINED_STEP_MM);

/**
 * Число экземпляров в каждой предустановленной семье. Четыре — нижняя граница
 * требования: на меньшем числе правило «соседние страницы не получают один
 * экземпляр» вырождается в чередование двух фотографий.
 */
const PRESET_SHEET_COUNT = 4;

/**
 * Размеры фотографий пресет-пака в пикселях. Нужны до загрузки артефакта
 * профилей: страница равна кадру листа, а картинка ещё не пришла.
 */
const GRID_PHOTO_SIZE = { width: 1600, height: 2050 };
const LINED_PHOTO_SIZE = { width: 1550, height: 2000 };

/**
 * Идентификаторы предустановленных семей. По ним артефакт профилей находит,
 * какие измерения к какой семье относятся.
 */
export const GRID_FAMILY_ID = 'grid';
export const LINED_FAMILY_ID = 'lined';

/**
 * Экземпляры семьи без измерений: фотографии на месте, разлиновка —
 * синтезированная. Шаг — доля кадра, поля — фолбэком, линии поля нет: такая
 * семья рисуется и без артефакта профилей, только строки ложатся на
 * приблизительную разлиновку, а не на линии конкретной фотографии.
 *
 * Фаза нулевая: где на снимке линии, без измерения неизвестно, и любая другая
 * фаза была бы такой же догадкой. Первая строка всё равно садится на линию
 * синтезированной разлиновки — верхнее поле фолбэка опускается до неё.
 *
 * @param familyId — идентификатор семьи, к которой принадлежат экземпляры
 * @param labelPrefix — подпись семьи в списке экземпляров
 * @param size — размеры фотографий семьи в пикселях
 * @param step — шаг синтезированной разлиновки в пикселях фотографии
 * @returns экземпляры семьи по порядку номеров файлов
 */
const buildPlainSheets = (
  familyId: string,
  labelPrefix: string,
  size: PhotoSize,
  step: number
): PaperSheet[] => {
  const sheets: PaperSheet[] = [];
  const ruling = buildSheetRuling({ step, firstLinePhase: 0, skewAngle: 0 }, size);

  for (let number = 1; number <= PRESET_SHEET_COUNT; number += 1) {
    sheets.push({
      id: `${familyId}-${number}`,
      label: `${labelPrefix} ${number}`,
      src: withBasePath(`/paper/${familyId}/${number}.jpg`),
      width: size.width,
      height: size.height,
      ruling,
      lighting: null,
      texture: null,
    });
  }

  return sheets;
};

/**
 * Предустановленные семьи без измерений. Отдельной константой, потому что это
 * же значение служит запасным путём, когда артефакт профилей не загрузился.
 */
const PLAIN_FAMILIES: PaperFamily[] = [
  {
    id: GRID_FAMILY_ID,
    label: 'В клетку',
    kind: 'grid',
    sheets: buildPlainSheets(
      GRID_FAMILY_ID,
      'Клетка',
      GRID_PHOTO_SIZE,
      GRID_PHOTO_SIZE.width / GRID_STEPS_ACROSS
    ),
  },
  {
    id: LINED_FAMILY_ID,
    label: 'В линейку',
    kind: 'lined',
    sheets: buildPlainSheets(
      LINED_FAMILY_ID,
      'Линейка',
      LINED_PHOTO_SIZE,
      LINED_PHOTO_SIZE.height / LINED_STEPS_DOWN
    ),
  },
];

/**
 * Собирает предустановленные семьи, подставляя посчитанные скриптом сборки
 * экземпляры: разлиновка каждого берётся из артефакта как есть.
 *
 * Семья, которой в артефакте нет, остаётся с экземплярами без измерений —
 * пресеты доступны сразу, даже если артефакт ещё не собран.
 *
 * @param profiles — характеристики экземпляров по идентификатору семьи
 * @returns предустановленные семьи листов
 */
export const buildPaperFamilies = (profiles: PaperSheetProfiles): PaperFamily[] => {
  return PLAIN_FAMILIES.map((family) => {
    const measured = profiles[family.id];

    return measured && measured.length > 0 ? { ...family, sheets: measured } : family;
  });
};

/**
 * Предустановленные семьи без артефакта профилей: с ними генератор открывается
 * до того, как загрузится `public/paper/profiles.json`.
 */
export const PRESET_PAPER_FAMILIES: PaperFamily[] = buildPaperFamilies({});
