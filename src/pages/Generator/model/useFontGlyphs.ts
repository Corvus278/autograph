import { withBasePath } from '@shared/lib/url';
import { useEffect, useState } from 'react';

import { HANDWRITING_FONTS } from '../config';
import type { GlyphSource } from '../lib/glyph';
import { loadFontGlyphs } from '../lib/glyph';

/**
 * Путь к файлу встроенного шрифта. `null` — шрифт не из пака: свой шрифт
 * приходит файлом в браузер, а не лежит на сайте, и контуров для него нет —
 * такой текст рисуется обычным `fillText`.
 *
 * @param family — семейство шрифта страницы
 * @returns путь к `.ttf`; `null` — шрифт не встроенный
 */
export const findFontUrl = (family: string): string | null => {
  const isBuiltIn = HANDWRITING_FONTS.some((font) => {
    return font.family === family;
  });

  return isBuiltIn ? withBasePath(`/fonts/${family}.ttf`) : null;
};

/**
 * Контуры шрифта страницы.
 *
 * Пока шрифт не разобрался, отдаётся `null`: страница рисуется буквами шрифта
 * и после загрузки перерисовывается контурами. Разбор идёт один раз на
 * семейство — файл кэшируется в `lib/glyph`.
 *
 * @param fontFamily — семейство шрифта страницы
 * @returns источник контуров; `null` — контуров нет
 */
export const useFontGlyphs = (fontFamily: string): GlyphSource | null => {
  const [source, setSource] = useState<GlyphSource | null>(null);
  const url = findFontUrl(fontFamily);

  useEffect(() => {
    if (!url) {
      setSource(null);

      return;
    }

    let isCancelled = false;

    const applySource = async () => {
      try {
        const loaded = await loadFontGlyphs(fontFamily, url);

        if (!isCancelled) {
          setSource(loaded);
        }
      } catch {
        if (!isCancelled) {
          setSource(null);
        }
      }
    };

    void applySource();

    return () => {
      isCancelled = true;
    };
  }, [fontFamily, url]);

  return source;
};
