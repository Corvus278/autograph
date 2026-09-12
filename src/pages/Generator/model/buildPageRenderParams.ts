import { SUBSTITUTE_FONTS } from '../config';
import type { BlockGeometry } from '../lib/calibrate/calibrate.types';
import { deriveCanonGeometry } from '../lib/calibrate/deriveGeometry';
import type { Page } from '../lib/paginate/paginate.types';
import { fitSheetToPage } from '../lib/paper';
import { buildDistortions } from '../lib/randomize/buildDistortions';
import { buildLineDistortions } from '../lib/randomize/buildLineDistortions';
import type { LineDistortion, WordDistortion } from '../lib/randomize/randomize.types';
import type { PageRenderParams, RenderLine, RenderPage } from '../lib/render';

import type { PageRenderInput } from './pageRender.types';

/**
 * Пустые искажения: нужны, когда слов или строк на странице больше, чем
 * описаний, — например, пока не досчиталась разбивка.
 */
const NO_WORD_DISTORTION: WordDistortion = {
  rotate: 0,
  skew: 0,
  translateY: 0,
  letters: [],
};
const NO_LINE_DISTORTION: LineDistortion = { rotate: 0, translateX: 0 };

/**
 * Шаг seed между соседними словами страницы. С запасом больше, чем шаг между
 * буквами внутри слова: иначе seed последних букв длинного слова совпали бы с
 * seed первых букв следующего, и два соседних слова написались бы одной рукой
 * посимвольно.
 */
const WORD_SEED_STEP = 1_000_003;

/**
 * Чётная по пользовательской нумерации страница — правая половина разворота.
 * Нумерация для пользователя начинается с единицы, поэтому чётной оказывается
 * нечётная позиция в массиве.
 *
 * @param pageIndex — номер страницы, считая с нуля
 * @returns отражается ли страница
 */
export const isMirroredPage = (pageIndex: number): boolean => {
  return (pageIndex + 1) % 2 === 0;
};

/**
 * Наклон блока на отражённой странице.
 *
 * Отражение переворачивает фотографию, а вместе с ней и наклон её разлиновки:
 * линия, шедшая вниз слева направо, после отражения идёт вниз справа налево.
 * Блок обязан наклониться в ту же сторону, иначе текст расходится с линиями
 * веером — на удвоенный угол к краям листа.
 *
 * @param skewAngle — наклон разлиновки экземпляра в градусах
 * @param isMirrored — страница отражена: правая половина разворота
 * @returns наклон блока текста в градусах
 */
export const mirrorSkewAngle = (skewAngle: number, isMirrored: boolean): number => {
  return isMirrored ? -skewAngle : skewAngle;
};

/**
 * Отступ блока на отражённой странице.
 *
 * Отражается не отдельный отступ, а вся разлиновка вместе с листом: линия поля
 * после отражения оказывается у противоположного края, и блок отступает от неё
 * на ту же величину, что и на нечётной странице. Отдельной настройки для этого
 * не нужно — величина выводится из того же `leftPadding`, что посчитала
 * автокалибровка.
 *
 * @param pageWidth — ширина листа в канонических пикселях
 * @param leftPadding — отступ блока на нечётной странице
 * @param blockWidth — ширина блока текста
 * @returns отступ блока от левого края отражённой страницы
 */
export const mirrorLeftPadding = (
  pageWidth: number,
  leftPadding: number,
  blockWidth: number
): number => {
  return Math.max(0, pageWidth - leftPadding - blockWidth);
};

/**
 * Слова страницы построчно. Пустая строка между абзацами остаётся пустым
 * списком: она ничего не рисует, но занимает свою высоту.
 *
 * @param page — страница с посчитанной раскладкой
 * @returns слова каждой строки в порядке отрисовки
 */
const splitLineWords = (page: Page): string[][] => {
  return page.lines.map(({ text }) => {
    return text ? text.split(' ') : [];
  });
};

/**
 * Собирает страницу для рендерера: слова и строки со своими искажениями.
 *
 * @param page — страница с посчитанной раскладкой
 * @param input — параметры искажений почерка
 * @returns страница, готовая к отрисовке
 */
const buildRenderPage = (page: Page, input: PageRenderInput): RenderPage => {
  const { flags, wordFrequency, letterFrequency, seed } = input;
  const lineWords = splitLineWords(page);
  const wordDistortions = buildDistortions(lineWords.flat(), {
    flags,
    wordFrequency,
    letterFrequency,
    seed,
    substituteFonts: SUBSTITUTE_FONTS,
  });
  const lineDistortions = buildLineDistortions(page.lines.length, { flags, seed });
  const lines: RenderLine[] = [];
  let wordOffset = 0;

  lineWords.forEach((words, lineIndex) => {
    lines.push({
      words: words.map((text, index) => {
        return {
          text,
          distortion: wordDistortions[wordOffset + index] || NO_WORD_DISTORTION,
          seed: seed + (wordOffset + index) * WORD_SEED_STEP,
        };
      }),
      distortion: lineDistortions[lineIndex] || NO_LINE_DISTORTION,
    });
    wordOffset += words.length;
  });

  return { lines };
};

/**
 * Геометрия блока по разлиновке семьи, метрикам шрифта и ручной поправке.
 * Отдельной функцией, потому что тем же расчётом пользуется раскладка: разойдись
 * они — переносы посчитались бы по одной ширине блока, а отрисовались по другой.
 * Поправка в долях шага переводится в пиксели по шагу канона семьи.
 *
 * @param input — семья, метрики и поправка
 * @returns геометрия блока в канонических пикселях семьи
 * @deprecated sheet-native-ruling — геометрия страницы: `selectBlockGeometry`
 */
export const buildBlockGeometry = (
  input: Pick<PageRenderInput, 'family' | 'metrics' | 'correction'>
): BlockGeometry => {
  const { family, metrics, correction } = input;

  return deriveCanonGeometry(
    { ...family.ruling, pageWidth: family.width },
    metrics,
    correction
  );
};

/**
 * Собирает параметры отрисовки страницы из состояния генератора и посчитанной
 * раскладки.
 *
 * Кегль сюда приходит уже в пикселях: em — единица DOM, и живёт она только на
 * границе с измерителем текста, а рендереру нужны пиксели страницы.
 *
 * Блок наклоняется на угол разлиновки выбранного экземпляра: фотография не
 * выправляется, текст выкладывается вдоль её наклона. На отражённой странице
 * наклон разлиновки переворачивается вместе с фотографией, и блок идёт за ним.
 *
 * Фотография при этом ложится не во всю страницу, а прямоугольником, который
 * считает `lib/paper/fitSheetToPage.ts`: её разлиновка приводится к канону
 * семьи, по которому посчитана раскладка.
 *
 * @param input — состояние генератора, раскладка и разрешение
 * @returns параметры отрисовки страницы
 */
export const buildPageRenderParams = (input: PageRenderInput): PageRenderParams => {
  const { page, family, sheet, sheetImage, metrics, isMirrored, scale } = input;
  const geometry = buildBlockGeometry(input);
  const leftPadding = isMirrored
    ? mirrorLeftPadding(family.width, geometry.leftPadding, geometry.blockWidth)
    : geometry.leftPadding;

  return {
    page: buildRenderPage(page, input),
    background:
      sheetImage && sheet
        ? { image: sheetImage, ...fitSheetToPage(sheet, family, isMirrored) }
        : null,
    inkColor: input.inkColor,
    ink: input.ink,
    glyphs: input.glyphs,
    fontFamily: input.fontFamily,
    geometry: {
      fontSizePx: geometry.fontSizePx,
      lineSpacing: geometry.lineSpacing,
      topOffset: geometry.topOffset,
      leftPadding,
      blockWidth: geometry.blockWidth,
      blockRotate: mirrorSkewAngle(sheet?.skewAngle || 0, isMirrored),
      fontMetrics: metrics,
    },
    scale,
  };
};
