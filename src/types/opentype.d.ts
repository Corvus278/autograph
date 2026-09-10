/**
 * Пакет `opentype.js` поставляется без типов, а `@types/opentype.js` описывает
 * версию 1 с другим API. Здесь описана только та часть, которой пользуется
 * адаптер: разбор файла шрифта и контуры глифов.
 *
 * Команды пути описаны типом ядра: их форма — и есть тот контракт, ради
 * которого пакет берётся. Своя копия описания разошлась бы с ним молча.
 */
declare module 'opentype.js' {
  import type { GlyphPathCommand } from '@pages/Generator/lib/glyph/glyph.types';

  /**
   * Путь глифа. Команды совпадают по форме с командами модуля, поэтому адаптеру
   * достаточно перебрать их, не приводя типы.
   */
  export type OpenTypePath = {
    /**
     * Команды пути в единицах шрифта.
     */
    commands: GlyphPathCommand[];
  };

  /**
   * Глиф шрифта.
   */
  export type OpenTypeGlyph = {
    /**
     * Номер глифа в шрифте. Ноль — глиф-заглушка `.notdef`.
     */
    index: number;

    /**
     * Продвижение пера после глифа в единицах шрифта.
     */
    advanceWidth?: number;

    /**
     * Контуры глифа.
     */
    path: OpenTypePath;
  };

  /**
   * Разобранный файл шрифта.
   */
  export type OpenTypeFont = {
    /**
     * Единиц шрифта на em.
     */
    unitsPerEm: number;

    /**
     * Глиф символа. Для отсутствующего символа отдаёт `.notdef`.
     */
    charToGlyph: (char: string) => OpenTypeGlyph;

    /**
     * Номер глифа символа. Ноль — символа в шрифте нет.
     */
    charToGlyphIndex: (char: string) => number;

    /**
     * Кернинг пары глифов в единицах шрифта.
     */
    getKerningValue: (left: OpenTypeGlyph, right: OpenTypeGlyph) => number;
  };

  /**
   * Разбирает содержимое файла шрифта. Бросает на неподдерживаемом формате.
   */
  export function parse(buffer: ArrayBuffer): OpenTypeFont;
}
