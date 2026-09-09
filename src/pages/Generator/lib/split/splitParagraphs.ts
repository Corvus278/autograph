import type { Line, SplitParagraphsOptions } from './splitParagraphs.types';

/**
 * Режет абзац на строки жадно: слово добавляется в текущую строку, пока она
 * помещается в ширину. Слово, которое не помещается целиком, занимает
 * отдельную строку — переносов внутри слова генератор не делает.
 */
const splitParagraph = (
  paragraph: string,
  paragraphIndex: number,
  options: SplitParagraphsOptions
): Line[] => {
  const { width, measure } = options;
  const words = paragraph.trim().split(/\s+/);
  const lines: Line[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (!current || measure.measureWidth(candidate) <= width) {
      current = candidate;

      continue;
    }

    lines.push({ text: current, paragraphIndex });
    current = word;
  }

  lines.push({ text: current, paragraphIndex });

  return lines;
};

/**
 * Разбивает текст на строки: сначала на абзацы по переводам строк, затем
 * каждый абзац — по ширине блока. Пустой абзац даёт пустую строку, чтобы
 * отбивка между абзацами сохранилась в отрисовке.
 */
export const splitParagraphs = (
  text: string,
  options: SplitParagraphsOptions
): Line[] => {
  const paragraphs = text.split('\n');

  return paragraphs.reduce<Line[]>((lines, paragraph, paragraphIndex) => {
    if (!paragraph.trim()) {
      lines.push({ text: '', paragraphIndex });

      return lines;
    }

    lines.push(...splitParagraph(paragraph, paragraphIndex, options));

    return lines;
  }, []);
};
