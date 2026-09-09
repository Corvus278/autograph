import { splitParagraphs } from '@pages/Generator/lib/split/splitParagraphs';
import { describe, expect, it } from 'vitest';

import { createMonospaceMeasurer } from './helpers/monospace-measurer';

/**
 * Ширина символа — 10 пикселей, поэтому ширина 100 держит ровно 10 символов.
 */
const measure = createMonospaceMeasurer({ charWidth: 10 });

describe('splitParagraphs', () => {
  it('переносит по границам слов', () => {
    const lines = splitParagraphs('раз два три четыре', { width: 100, measure });

    expect(
      lines.map(({ text }) => {
        return text;
      })
    ).toEqual(['раз два', 'три четыре']);
  });

  it('не разрывает слово длиннее строки', () => {
    const lines = splitParagraphs('короткое сверхдлинноеслово хвост', {
      width: 100,
      measure,
    });

    expect(
      lines.map(({ text }) => {
        return text;
      })
    ).toEqual(['короткое', 'сверхдлинноеслово', 'хвост']);
  });

  it('сохраняет пустую строку между абзацами', () => {
    const lines = splitParagraphs('раз\n\nдва', { width: 100, measure });

    expect(lines).toEqual([
      { text: 'раз', paragraphIndex: 0 },
      { text: '', paragraphIndex: 1 },
      { text: 'два', paragraphIndex: 2 },
    ]);
  });

  it('считает абзац из одного пробела пустым', () => {
    const lines = splitParagraphs(' ', { width: 100, measure });

    expect(lines).toEqual([{ text: '', paragraphIndex: 0 }]);
  });

  it('нумерует абзацы, из которых получены строки', () => {
    const lines = splitParagraphs('раз два три четыре\nпять', {
      width: 100,
      measure,
    });

    expect(
      lines.map(({ paragraphIndex }) => {
        return paragraphIndex;
      })
    ).toEqual([0, 0, 1]);
  });
});
