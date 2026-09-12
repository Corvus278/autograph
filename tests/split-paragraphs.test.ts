import { splitParagraphs } from '@pages/Generator/lib/split/splitParagraphs';
import type { Line } from '@pages/Generator/lib/split/splitParagraphs.types';
import { describe, expect, it } from 'vitest';

import { createMonospaceMeasurer } from './helpers/monospace-measurer';

/**
 * Символ — половина кегля, кегль — двадцать пикселей: символ занимает десять
 * пикселей, и ширина 100 держит ровно десять символов.
 */
const measure = createMonospaceMeasurer({ charWidth: 0.5 });

const OPTIONS = { width: 100, fontSizePx: 20, measure };

const toTexts = (lines: Line[]): string[] => {
  return lines.map(({ text }) => {
    return text;
  });
};

describe('splitParagraphs', () => {
  it('переносит по границам слов', () => {
    const { lines } = splitParagraphs('раз два три четыре', OPTIONS);

    expect(toTexts(lines)).toEqual(['раз два', 'три четыре']);
  });

  it('переводит ширину в пиксели по кеглю страницы', () => {
    const { lines } = splitParagraphs('раз два три четыре', {
      ...OPTIONS,
      fontSizePx: 15,
    });

    expect(toTexts(lines)).toEqual(['раз два три', 'четыре']);
  });

  it('не разрывает слово длиннее строки', () => {
    const { lines } = splitParagraphs('короткое сверхдлинноеслово хвост', OPTIONS);

    expect(toTexts(lines)).toEqual(['короткое', 'сверхдлинноеслово', 'хвост']);
  });

  it('сохраняет пустую строку между абзацами', () => {
    const { lines } = splitParagraphs('раз\n\nдва', OPTIONS);

    expect(lines).toEqual([
      { text: 'раз', paragraphIndex: 0 },
      { text: '', paragraphIndex: 1 },
      { text: 'два', paragraphIndex: 2 },
    ]);
  });

  it('считает абзац из одного пробела пустым', () => {
    const { lines } = splitParagraphs(' ', OPTIONS);

    expect(lines).toEqual([{ text: '', paragraphIndex: 0 }]);
  });

  it('нумерует абзацы, из которых получены строки', () => {
    const { lines } = splitParagraphs('раз два три четыре\nпять', OPTIONS);

    expect(
      lines.map(({ paragraphIndex }) => {
        return paragraphIndex;
      })
    ).toEqual([0, 0, 1]);
  });
});

describe('splitParagraphs с продолжением', () => {
  const TEXT = 'раз два три четыре пять шесть';

  it('останавливается на заданном числе строк у начала следующего слова', () => {
    const { lines, end } = splitParagraphs(TEXT, { ...OPTIONS, maxLines: 1 });

    expect(toTexts(lines)).toEqual(['раз два']);
    expect(end).toBe(TEXT.indexOf('три'));
  });

  it('продолжает с середины абзаца теми же строками, что и разбивка целиком', () => {
    const whole = splitParagraphs(TEXT, OPTIONS);
    const head = splitParagraphs(TEXT, { ...OPTIONS, maxLines: 1 });
    const tail = splitParagraphs(TEXT, { ...OPTIONS, start: head.end });

    expect([...head.lines, ...tail.lines]).toEqual(whole.lines);
    expect(tail.lines[0]).toEqual({ text: 'три четыре', paragraphIndex: 0 });
  });

  it('на границе абзаца поглощает перевод строки и сохраняет номер абзаца', () => {
    const text = 'раз\n\nдва три';
    const first = splitParagraphs(text, { ...OPTIONS, maxLines: 1 });
    const second = splitParagraphs(text, { ...OPTIONS, start: first.end, maxLines: 1 });
    const third = splitParagraphs(text, { ...OPTIONS, start: second.end });

    expect(first.end).toBe(text.indexOf('\n') + 1);
    expect(second.lines).toEqual([{ text: '', paragraphIndex: 1 }]);
    expect(third.lines).toEqual([{ text: 'два три', paragraphIndex: 2 }]);
  });

  it('сообщает, что текст разобран, позицией за его концом', () => {
    const { end } = splitParagraphs(TEXT, OPTIONS);
    const { end: headEnd } = splitParagraphs(TEXT, { ...OPTIONS, maxLines: 1 });

    expect(end).toBeGreaterThan(TEXT.length);
    expect(headEnd).toBeLessThanOrEqual(TEXT.length);
  });

  it('по строке за вызов собирает все строки текста, включая пустые абзацы в конце', () => {
    const text = 'раз два три\n\nчетыре пять шесть семь\n';
    const whole = splitParagraphs(text, OPTIONS);
    const collected: Line[] = [];
    let start = 0;

    while (start <= text.length) {
      const { lines, end } = splitParagraphs(text, { ...OPTIONS, start, maxLines: 1 });

      expect(end).toBeGreaterThan(start);
      collected.push(...lines);
      start = end;
    }

    expect(collected).toEqual(whole.lines);
    expect(whole.lines.at(-1)).toEqual({ text: '', paragraphIndex: 3 });
  });
});
