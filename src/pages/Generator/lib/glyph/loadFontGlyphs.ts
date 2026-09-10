import { parse } from 'opentype.js';

import type { GlyphOutline, GlyphSource } from './glyph.types';
import { mapCommandPoints } from './glyphCommands';

/**
 * Разобранные шрифты по имени семейства. Файл читается и разбирается один раз
 * на семейство: разбор `.ttf` заметно дороже самой деформации.
 */
const sourceCache = new Map<string, Promise<GlyphSource>>();

/**
 * Собирает источник контуров из содержимого файла шрифта. Обращений к сети и к
 * DOM не делает — годится и для воркера, и для теста.
 *
 * @param fontData — содержимое `.ttf`
 * @returns источник контуров. Бросает, если формат не разбирается
 */
export const createGlyphSource = (fontData: ArrayBuffer): GlyphSource => {
  const font = parse(fontData);
  const outlines = new Map<string, GlyphOutline>();

  return {
    unitsPerEm: font.unitsPerEm,

    getGlyph: (char: string): GlyphOutline | null => {
      const cached = outlines.get(char);

      if (cached) {
        return cached;
      }

      if (font.charToGlyphIndex(char) === 0) {
        return null;
      }

      const glyph = font.charToGlyph(char);

      /**
       * Команды копируются: путь принадлежит разобранному шрифту, а вызывающая
       * сторона вправе считать выданные контуры своими.
       */
      const outline: GlyphOutline = {
        char,
        advanceWidth: glyph.advanceWidth || 0,
        commands: glyph.path.commands.map((command) => {
          return mapCommandPoints(command, (x, y) => {
            return { x, y };
          });
        }),
      };

      outlines.set(char, outline);

      return outline;
    },

    getKerning: (leftChar: string, rightChar: string): number => {
      const isPairPresent =
        font.charToGlyphIndex(leftChar) !== 0 && font.charToGlyphIndex(rightChar) !== 0;

      if (!isPairPresent) {
        return 0;
      }

      return font.getKerningValue(
        font.charToGlyph(leftChar),
        font.charToGlyph(rightChar)
      );
    },
  };
};

/**
 * Читает файл шрифта и разбирает его.
 */
const fetchGlyphSource = async (url: string): Promise<GlyphSource> => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Не удалось загрузить шрифт: ${url}`);
  }

  return createGlyphSource(await response.arrayBuffer());
};

/**
 * Отдаёт контуры глифов шрифта. Повторный вызов для того же семейства отдаёт
 * тот же источник, не обращаясь к сети; неудачная загрузка из кэша выбрасывается
 * и повторяется при следующем вызове.
 *
 * @param family — имя семейства, под которым шрифт зарегистрирован в приложении
 * @param url — адрес файла `.ttf`
 * @returns источник контуров
 */
export const loadFontGlyphs = (family: string, url: string): Promise<GlyphSource> => {
  const cached = sourceCache.get(family);

  if (cached) {
    return cached;
  }

  const loading = fetchGlyphSource(url).catch((error: unknown) => {
    sourceCache.delete(family);

    throw error;
  });

  sourceCache.set(family, loading);

  return loading;
};

/**
 * Забывает разобранные шрифты. Нужен там, где шрифт под тем же именем
 * подменяется — например, пользовательский `.ttf`.
 */
export const clearFontGlyphsCache = (): void => {
  sourceCache.clear();
};
