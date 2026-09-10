import { deformGlyphPath } from '../glyph/deformGlyphPath';
import type { GlyphPathCommand } from '../glyph/glyph.types';
import { FALLBACK_FONT_METRICS } from '../measure/measureFontMetrics';
import type { LetterDistortion } from '../randomize/randomize.types';

import type {
  PageGlyphs,
  PageRenderParams,
  RenderContext,
  RenderFontMetrics,
  RenderLine,
  RenderWord,
} from './render.types';

/**
 * Сколько градусов в радиане: css-трансформации задаются в градусах, canvas
 * принимает радианы.
 */
const DEGREES_IN_RADIAN = 180 / Math.PI;

/**
 * Шаг seed между соседними буквами слова: у каждого вхождения буквы свой
 * контур. Взаимно простое с шагом слов число, чтобы seed букв соседних слов не
 * совпадали позиция в позицию.
 */
const LETTER_SEED_STEP = 7919;

/**
 * Какие слои страницы рисует проход. Проходы разделены, потому что чернила
 * модулируются шейдером и им нужен свой прозрачный слой, а фон обязан остаться
 * под ним нетронутым.
 */
type PageLayers = {
  /**
   * Рисуется ли фотография листа.
   */
  hasBackground: boolean;

  /**
   * Рисуются ли чернила.
   */
  hasInk: boolean;
};

const ALL_LAYERS: PageLayers = { hasBackground: true, hasInk: true };
const BACKGROUND_LAYER: PageLayers = { hasBackground: true, hasInk: false };
const INK_LAYER: PageLayers = { hasBackground: false, hasInk: true };

/**
 * Переводит градусы css-трансформаций в радианы canvas.
 */
const toRadians = (degrees: number): number => {
  return degrees / DEGREES_IN_RADIAN;
};

/**
 * Собирает значение css-свойства `font`. Семейство обязательно в кавычках:
 * имя с пробелом — а такое приходит с пользовательским шрифтом — без них
 * делает всё свойство невалидным, и присвоение молча не применяется.
 */
const buildFont = (fontSizePx: number, fontFamily: string): string => {
  return `${fontSizePx}px "${fontFamily}"`;
};

/**
 * Подставляет запасные доли вместо нулей и мусора: метрики могли не сняться,
 * а делить геометрию на ноль дороже, чем ошибиться в пропорции.
 */
const resolveMetrics = (metrics: RenderFontMetrics): RenderFontMetrics => {
  return {
    fontAscent: metrics.fontAscent || FALLBACK_FONT_METRICS.fontAscent,
    lineHeight: metrics.lineHeight || FALLBACK_FONT_METRICS.lineHeight,
  };
};

/**
 * Во сколько раз единицы шрифта меньше пикселей страницы.
 */
const glyphScale = (glyphs: PageGlyphs, fontSizePx: number): number => {
  return fontSizePx / (glyphs.source.unitsPerEm || 1);
};

/**
 * Стили букв слова по их позициям. Буквы, которых в карте нет, рисуются
 * шрифтом страницы без добавки к межбуквенному интервалу.
 */
const buildLetterStyles = (
  letters: LetterDistortion[]
): Map<number, LetterDistortion> => {
  return new Map(
    letters.map((letter) => {
      return [letter.index, letter];
    })
  );
};

/**
 * Ширины букв слова вместе с добавками к межбуквенному интервалу: на столько
 * сдвигается перо после каждой буквы.
 */
const measureLetterAdvances = (
  ctx: RenderContext,
  word: RenderWord,
  fontSizePx: number,
  baseFont: string
): number[] => {
  const { text, distortion } = word;
  const letterStyles = buildLetterStyles(distortion.letters);

  return [...text].map((character, index) => {
    const letter = letterStyles.get(index);
    const letterFont = letter?.fontFamily || null;

    if (letterFont) {
      ctx.font = buildFont(fontSizePx, letterFont);
    }

    const { width } = ctx.measureText(character);

    if (letterFont) {
      ctx.font = baseFont;
    }

    return width + (letter?.letterSpacing || 0);
  });
};

/**
 * Ширины букв слова, когда буквы рисуются контурами: продвижение глифа плюс
 * кернинг с соседом. Буква с подменённым шрифтом и буква, которой в шрифте
 * нет, меряются текстом — контуров для них нет.
 */
const measureGlyphAdvances = (
  ctx: RenderContext,
  word: RenderWord,
  glyphs: PageGlyphs,
  fontSizePx: number,
  baseFont: string
): number[] => {
  const { text, distortion } = word;
  const letterStyles = buildLetterStyles(distortion.letters);
  const { source } = glyphs;
  const scale = glyphScale(glyphs, fontSizePx);
  const characters = [...text];

  return characters.map((character, index) => {
    const letter = letterStyles.get(index);
    const letterFont = letter?.fontFamily || null;
    const letterSpacing = letter?.letterSpacing || 0;
    const glyph = letterFont ? null : source.getGlyph(character);

    if (!glyph) {
      if (letterFont) {
        ctx.font = buildFont(fontSizePx, letterFont);
      }

      const { width } = ctx.measureText(character);

      if (letterFont) {
        ctx.font = baseFont;
      }

      return width + letterSpacing;
    }

    const nextCharacter = characters[index + 1];
    const kerning = nextCharacter ? source.getKerning(character, nextCharacter) : 0;

    return (glyph.advanceWidth + kerning) * scale + letterSpacing;
  });
};

/**
 * Ширины букв слова: по контурам, если они есть, иначе текстом. Пустой список —
 * слово рисуется целиком, и мерить его по буквам незачем.
 */
const measureAdvances = (
  ctx: RenderContext,
  word: RenderWord,
  glyphs: PageGlyphs | null,
  fontSizePx: number,
  baseFont: string
): number[] => {
  if (glyphs) {
    return measureGlyphAdvances(ctx, word, glyphs, fontSizePx, baseFont);
  }

  if (word.distortion.letters.length === 0) {
    return [];
  }

  return measureLetterAdvances(ctx, word, fontSizePx, baseFont);
};

/**
 * Ширина пробела между словами. Контуры меряют его продвижением глифа: у
 * рукописных шрифтов пробел заметно уже среднего символа, и мерить его текстом,
 * когда всё остальное считается по контурам, значило бы расставить слова по
 * одной ширине, а буквы — по другой.
 */
const measureSpace = (
  ctx: RenderContext,
  glyphs: PageGlyphs | null,
  fontSizePx: number
): number => {
  const spaceGlyph = glyphs?.source.getGlyph(' ');

  if (!glyphs || !spaceGlyph) {
    return ctx.measureText(' ').width;
  }

  return spaceGlyph.advanceWidth * glyphScale(glyphs, fontSizePx);
};

/**
 * Кладёт контур глифа в путь и заливает его.
 *
 * Координаты переводятся в пиксели страницы прямо здесь, без собственного
 * преобразования контекста: ось `y` в шрифте смотрит вверх, а в канве вниз, и
 * отдельный переворот системы координат вывернул бы вместе с глифом и
 * трансформации слова.
 *
 * @param ctx — контекст рисования
 * @param commands — команды пути в единицах шрифта
 * @param x — левый край глифа в пикселях страницы
 * @param scale — сколько пикселей страницы в единице шрифта
 */
const fillGlyphPath = (
  ctx: RenderContext,
  commands: readonly GlyphPathCommand[],
  x: number,
  scale: number
): void => {
  ctx.beginPath();

  for (const command of commands) {
    switch (command.type) {
      case 'M': {
        ctx.moveTo(x + command.x * scale, -command.y * scale);
        break;
      }

      case 'L': {
        ctx.lineTo(x + command.x * scale, -command.y * scale);
        break;
      }

      case 'Q': {
        ctx.quadraticCurveTo(
          x + command.x1 * scale,
          -command.y1 * scale,
          x + command.x * scale,
          -command.y * scale
        );
        break;
      }

      case 'C': {
        ctx.bezierCurveTo(
          x + command.x1 * scale,
          -command.y1 * scale,
          x + command.x2 * scale,
          -command.y2 * scale,
          x + command.x * scale,
          -command.y * scale
        );
        break;
      }

      case 'Z': {
        ctx.closePath();
        break;
      }

      default: {
        throw new Error(`Неизвестная команда контура: ${JSON.stringify(command)}`);
      }
    }
  }

  ctx.fill();
};

/**
 * Рисует слово контурами шрифта: каждая буква — свой путь.
 *
 * Вариативность отключается целиком, а не сводится к нулевой амплитуде: при
 * выключенном флаге деформация не вызывается, и в путь идут исходные контуры
 * шрифта.
 */
const drawWordGlyphs = (
  ctx: RenderContext,
  word: RenderWord,
  x: number,
  advances: number[],
  glyphs: PageGlyphs,
  fontSizePx: number,
  baseFont: string
): void => {
  const { text, distortion, seed } = word;
  const letterStyles = buildLetterStyles(distortion.letters);
  const { source, hasVariance } = glyphs;
  const scale = glyphScale(glyphs, fontSizePx);
  let cursorX = x;

  [...text].forEach((character, index) => {
    const letterFont = letterStyles.get(index)?.fontFamily || null;
    const glyph = letterFont ? null : source.getGlyph(character);

    if (glyph) {
      const commands = hasVariance
        ? deformGlyphPath(glyph.commands, {
            unitsPerEm: source.unitsPerEm,
            advanceWidth: glyph.advanceWidth,
            seed: seed + index * LETTER_SEED_STEP,
          })
        : glyph.commands;

      fillGlyphPath(ctx, commands, cursorX, scale);
    } else {
      if (letterFont) {
        ctx.font = buildFont(fontSizePx, letterFont);
      }

      ctx.fillText(character, cursorX, 0);

      if (letterFont) {
        ctx.font = baseFont;
      }
    }

    cursorX += advances[index] || 0;
  });
};

/**
 * Рисует слово буквами шрифта: целиком, если ни одна буква не выбивается, и
 * по одной, если у букв свои интервалы или своё начертание.
 */
const drawWordText = (
  ctx: RenderContext,
  word: RenderWord,
  x: number,
  advances: number[],
  fontSizePx: number,
  baseFont: string
): void => {
  const { text, distortion } = word;
  const { letters } = distortion;

  if (letters.length === 0) {
    ctx.fillText(text, x, 0);

    return;
  }

  const letterStyles = buildLetterStyles(letters);
  let cursorX = x;

  [...text].forEach((character, index) => {
    const letterFont = letterStyles.get(index)?.fontFamily || null;

    if (letterFont) {
      ctx.font = buildFont(fontSizePx, letterFont);
    }

    ctx.fillText(character, cursorX, 0);

    if (letterFont) {
      ctx.font = baseFont;
    }

    cursorX += advances[index] || 0;
  });
};

/**
 * Рисует слово от точки `x` на базовой линии текущей строки и возвращает его
 * ширину — от неё отсчитывается следующее слово.
 *
 * Поворот и скос применяются вокруг горизонтального центра слова на базовой
 * линии; порядок трансформаций тот же, что в css-строке
 * `rotate() skew() translateY()`.
 *
 * Слово, начинающееся за правой границей блока, не рисуется: раскладка
 * считается тем же `blockWidth`, поэтому такое слово означает рассинхрон, и
 * выпустить его за край листа хуже, чем не показать.
 */
const drawWord = (
  ctx: RenderContext,
  word: RenderWord,
  x: number,
  glyphs: PageGlyphs | null,
  fontSizePx: number,
  baseFont: string,
  blockWidth: number
): number => {
  const { text, distortion } = word;
  const { rotate, skew, translateY, letters } = distortion;

  if (text.length === 0) {
    return 0;
  }

  const isMeasuredByLetter = Boolean(glyphs) || letters.length > 0;
  const advances = measureAdvances(ctx, word, glyphs, fontSizePx, baseFont);
  const width = isMeasuredByLetter
    ? advances.reduce((sum, advance) => {
        return sum + advance;
      }, 0)
    : ctx.measureText(text).width;

  if (blockWidth > 0 && x >= blockWidth) {
    return width;
  }

  const originX = x + width / 2;

  ctx.save();
  ctx.translate(originX, 0);

  if (rotate !== 0) {
    ctx.rotate(toRadians(rotate));
  }

  if (skew !== 0) {
    ctx.transform(1, 0, Math.tan(toRadians(skew)), 1, 0, 0);
  }

  if (translateY !== 0) {
    ctx.translate(0, translateY);
  }

  ctx.translate(-originX, 0);

  if (glyphs) {
    drawWordGlyphs(ctx, word, x, advances, glyphs, fontSizePx, baseFont);
  } else {
    drawWordText(ctx, word, x, advances, fontSizePx, baseFont);
  }

  ctx.restore();

  return width;
};

/**
 * Рисует строку: базовая линия уже посчитана, слова кладутся слева направо
 * через пробел.
 *
 * Поворот и сдвиг строки применяются вокруг середины блока: строка занимает
 * всю его ширину, и от точки поворота зависит, качается она или разъезжается
 * веером.
 */
const drawLine = (
  ctx: RenderContext,
  line: RenderLine,
  baselineY: number,
  spaceWidth: number,
  glyphs: PageGlyphs | null,
  fontSizePx: number,
  baseFont: string,
  blockWidth: number
): void => {
  const { words, distortion } = line;
  const { rotate, translateX } = distortion;

  if (words.length === 0) {
    return;
  }

  const originX = blockWidth / 2;

  ctx.save();
  ctx.translate(0, baselineY);
  ctx.translate(originX, 0);

  if (rotate !== 0) {
    ctx.rotate(toRadians(rotate));
  }

  if (translateX !== 0) {
    ctx.translate(translateX, 0);
  }

  ctx.translate(-originX, 0);

  let cursorX = 0;

  words.forEach((word, index) => {
    if (index > 0) {
      cursorX += spaceWidth;
    }

    cursorX += drawWord(ctx, word, cursorX, glyphs, fontSizePx, baseFont, blockWidth);
  });

  ctx.restore();
};

/**
 * Рисует перечисленные слои страницы в контекст.
 */
const drawPage = (
  ctx: RenderContext,
  params: PageRenderParams,
  layers: PageLayers
): void => {
  const { page, background, inkColor, glyphs, fontFamily, geometry, scale } = params;
  const {
    fontSizePx,
    lineSpacing,
    topOffset,
    leftPadding,
    blockWidth,
    blockRotate,
    fontMetrics,
  } = geometry;
  const { fontAscent, lineHeight } = resolveMetrics(fontMetrics);
  const baseFont = buildFont(fontSizePx, fontFamily);

  ctx.save();
  ctx.scale(scale, scale);

  if (layers.hasBackground && background) {
    ctx.drawImage(
      background.image,
      background.x,
      background.y,
      background.width,
      background.height
    );
  }

  if (layers.hasInk) {
    ctx.save();

    if (blockRotate !== 0) {
      ctx.rotate(toRadians(blockRotate));
    }

    ctx.translate(leftPadding, topOffset);

    ctx.fillStyle = inkColor;
    ctx.textBaseline = 'alphabetic';
    ctx.font = baseFont;

    const spaceWidth = measureSpace(ctx, glyphs, fontSizePx);
    const lineStep = fontSizePx * lineHeight + lineSpacing;
    const firstBaselineY = fontAscent * fontSizePx;

    page.lines.forEach((line, index) => {
      drawLine(
        ctx,
        line,
        firstBaselineY + index * lineStep,
        spaceWidth,
        glyphs,
        fontSizePx,
        baseFont,
        blockWidth
      );
    });

    ctx.restore();
  }

  ctx.restore();
};

/**
 * Рисует страницу в контекст: сначала фотография листа, поверх неё — чернила.
 * Ничего не очищает и ничего не измеряет в DOM: вход полностью описывает
 * результат, поэтому два вызова с одними параметрами дают одну и ту же
 * картинку.
 *
 * Шаг строк и базовые линии считаются по метрикам шрифта теми же формулами,
 * которыми `lib/calibrate` выводит геометрию из разлиновки: базовая линия
 * лежит на подъёме строчного бокса от верха строки, а межстрочная добавка —
 * внешний отступ строки и внутрь бокса не идёт. Разойдись формулы — базовые
 * линии не сядут на линии листа.
 *
 * Разрешение задаётся одним параметром `scale`: предпросмотр и экспорт идут
 * этим же путём и отличаются только им.
 *
 * @param ctx — контекст рисования; состояние восстанавливается к исходному
 * @param params — что рисовать, чем и в каком разрешении
 */
export const renderPageToCanvas = (
  ctx: RenderContext,
  params: PageRenderParams
): void => {
  drawPage(ctx, params, ALL_LAYERS);
};

/**
 * Рисует только фотографию листа: чернила лягут отдельным слоем и вернутся
 * сюда уже промодулированными.
 *
 * @param ctx — контекст страницы
 * @param params — параметры отрисовки
 */
export const drawPageBackground = (
  ctx: RenderContext,
  params: PageRenderParams
): void => {
  drawPage(ctx, params, BACKGROUND_LAYER);
};

/**
 * Рисует только чернила. Контекст обычно принадлежит прозрачному слою: шейдеру
 * нужны чернила без листа под ними, иначе он промодулирует и фотографию,
 * которая уже несёт своё освещение.
 *
 * @param ctx — контекст слоя чернил
 * @param params — параметры отрисовки
 */
export const drawPageInk = (ctx: RenderContext, params: PageRenderParams): void => {
  drawPage(ctx, params, INK_LAYER);
};
