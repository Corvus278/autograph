import { mulberry32, randomInt } from '@shared/lib/random';

import { normalizeInkColor, pickInkColor } from './inkPalette';
import { pickSheetSequence, toPageSeed } from './pickSheetSequence';
import type { BuildRunRecipeParams, RunRecipe } from './recipe.types';

/**
 * Качество кодирования JPEG. Фиксировано константой: качество входит в
 * рецепт, а плавающее значение сделало бы скриншотные эталоны
 * невоспроизводимыми.
 */
export const JPEG_QUALITY = 0.92;

/**
 * Во сколько раз снимок крупнее страницы в предпросмотре. Тройка — нижняя
 * граница требования: резкий растр экранного размера читается как отрисовка,
 * повышенное разрешение с последующей мягкостью — как фотография.
 */
export const RENDER_SCALE = 3;

/**
 * Амплитуда смещения контрольных точек контура в долях em. Порядок сотых:
 * заметно при сравнении двух вхождений буквы, но буква остаётся узнаваемой.
 */
export const CONTOUR_AMPLITUDE = 0.02;

/**
 * Размер ячейки решётки шума в долях em: четверть em по итогу спайка S1 —
 * более мелкая решётка рвёт штрих, более крупная сдвигает букву целиком
 * вместо изменения формы.
 */
export const CONTOUR_CELL_SIZE = 0.25;

/**
 * Соль подпотока вариативности контуров: у каждой постраничной величины своя.
 */
const CONTOUR_SALT = 0x27_d4_eb_2f;

/**
 * Верхняя граница производных seed. Ограничена 32 битами: `mulberry32`
 * работает с 32-битным состоянием, более длинное число всё равно усечётся.
 */
const MAX_SEED = 2_147_483_647;

/**
 * Границы частот побуквенной обработки. Дальше трёх искажения становятся
 * настолько редкими, что почерк выглядит набранным.
 */
const MIN_FREQUENCY = 1;
const MAX_FREQUENCY = 3;

/**
 * Собирает рецепт прогона: из одного seed выводит экземпляры листов по
 * страницам, цвет чернил, параметры почерка, вариативности контуров и оптики.
 * Иных источников случайности у отрисовки нет — на одном seed прогон
 * повторяется целиком.
 *
 * Случайность разведена по подпотокам. Общий поток seed отдаёт только то, что
 * одно на прогон: цвет чернил и параметры почерка. Постраничное — лист и seed
 * контуров — берётся из подпотока своей страницы. Поэтому дописанная в текст
 * страница не сдвигает уже выбранное: рецепты на три и на тридцать страниц
 * совпадают по цвету, почерку и по первым трём страницам.
 *
 * Семью листов рецепт не подменяет: экземпляры выбираются только внутри
 * переданной. Заданное пользователем — цвет чернил и частоты побуквенной
 * обработки — доходит до рецепта как есть; из seed выводится только то, что
 * пользователь не задал. Цвету достаточно валидного `#rrggbb` в любом
 * регистре, всё остальное считается «цвет не задан» (см.
 * `normalizeInkColor`).
 *
 * Чего рецепт не обещает: что новый seed обязательно даст другую
 * последовательность листов. При запрете соседних повторов семья из двух
 * экземпляров допускает всего две последовательности, так что совпадение с
 * прошлым прогоном там ожидаемо. Цвет и параметры почерка при новом seed
 * меняются.
 *
 * @param params — seed прогона и заданное пользователем окружение
 * @returns рецепт прогона
 */
export const buildRunRecipe = ({
  seed,
  family,
  pageCount,
  flags,
  inkColor,
  wordFrequency,
  letterFrequency,
}: BuildRunRecipeParams): RunRecipe => {
  const random = mulberry32(seed);
  /**
   * Из потока черпается всё, даже когда пользователь задал значение сам:
   * пропуск черпания сдвинул бы дальнейшую последовательность, и фиксация
   * цвета или частоты меняла бы заодно почерк и листы.
   */
  const paletteColor = pickInkColor(random);
  const handwritingSeed = randomInt(random, 0, MAX_SEED);
  const seededWordFrequency = randomInt(random, MIN_FREQUENCY, MAX_FREQUENCY);
  const seededLetterFrequency = randomInt(random, MIN_FREQUENCY, MAX_FREQUENCY);
  const pages = pickSheetSequence(seed, family.sheets, pageCount).map(
    (sheet, pageIndex) => {
      return {
        pageIndex,
        sheetId: sheet.id,
        contourSeed: randomInt(
          mulberry32(toPageSeed(seed, pageIndex, CONTOUR_SALT)),
          0,
          MAX_SEED
        ),
      };
    }
  );

  return {
    seed,
    familyId: family.id,
    inkColor: normalizeInkColor(inkColor) || paletteColor,
    pages,
    handwriting: {
      seed: handwritingSeed,
      flags,
      wordFrequency: wordFrequency || seededWordFrequency,
      letterFrequency: letterFrequency || seededLetterFrequency,
    },
    contour: {
      amplitude: CONTOUR_AMPLITUDE,
      cellSize: CONTOUR_CELL_SIZE,
    },
    optics: {
      jpegQuality: JPEG_QUALITY,
      renderScale: RENDER_SCALE,
    },
  };
};
