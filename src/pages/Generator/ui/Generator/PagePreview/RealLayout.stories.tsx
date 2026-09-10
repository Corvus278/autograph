import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { expect, within } from 'storybook/test';

import { clearLayoutCache } from '../../../model/measureLayout';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';
import { usePageGeometry } from '../../../model/usePageGeometry';
import { usePageLayout } from '../../../model/usePageLayout';

/**
 * Проверки разбивки на настоящем измерителе. В jsdom их не поставить: layout
 * там не считается, а переносы у рукописного шрифта зависят от его метрик.
 */
const RealLayoutProbe: FC = () => {
  const pages = usePageLayout();
  const { geometry, fontFamily } = usePageGeometry();

  return (
    <div>
      <p data-testid="page-count">{pages.length}</p>

      <div
        style={{
          width: `${geometry?.blockWidth || 0}px`,
          fontFamily,
          fontSize: `${geometry?.fontSizePx || 0}px`,
        }}
      >
        {pages.map((page, pageIndex) => {
          return (
            <div key={pageIndex} data-testid="page-block">
              {page.lines.map((line, lineIndex) => {
                return (
                  <div key={lineIndex} data-testid="line">
                    {line.text || ' '}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LONG_TEXT = [
  'Рукописный текст переносится по словам, а не по буквам,',
  'поэтому длинный абзац разъезжается на несколько строк подряд.',
].join(' ');

/**
 * Слово, которое не влезет ни в одну строку. Нарочно длиннее любой мыслимой
 * строки: кегль и ширину блока выводит автокалибровка из разлиновки семьи, и
 * слово в шесть десятков букв на иных метриках шрифта в строку помещается —
 * проверять перенос на нём значило бы гадать.
 */
const UNBREAKABLE_WORD =
  'сверхдлинноенеразрывноесловокотороенепомещаетсяниводнустрокукакойбыкеглькакуюбыширинублокаикакойбышрифтдлянегониподобрали';

/**
 * Ставит стор в известное состояние: текст задаётся story, остальное — значения
 * по умолчанию. Ширина блока и кегль выводятся из разлиновки семьи, поэтому
 * руками не задаются.
 */
const applyText = (text: string, bottomMargin = 0) => {
  clearLayoutCache();
  useGeneratorStore.setState({ ...DEFAULT_GENERATOR_STATE, text, bottomMargin });
};

const meta = {
  component: RealLayoutProbe,
  beforeEach: () => {
    applyText(LONG_TEXT);
  },
} satisfies Meta<typeof RealLayoutProbe>;

export default meta;

type Story = StoryObj<typeof meta>;

export const WordWrap: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const lines = await canvas.findAllByTestId('line');

    await expect(lines.length).toBeGreaterThan(1);

    const rebuilt = lines
      .map((line: HTMLElement) => {
        return line.textContent ?? '';
      })
      .join(' ');

    await expect(rebuilt).toBe(LONG_TEXT);
  },
};

export const LongWordKeepsWhole: Story = {
  beforeEach: () => {
    applyText(`короткое ${UNBREAKABLE_WORD} хвост`);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const lines = await canvas.findAllByTestId('line');
    const texts = lines.map((line: HTMLElement) => {
      return line.textContent ?? '';
    });

    await expect(texts).toContain(UNBREAKABLE_WORD);
  },
};

export const EmptyParagraphKept: Story = {
  beforeEach: () => {
    applyText('первый абзац\n\nвторой абзац');
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const lines = await canvas.findAllByTestId('line');

    await expect(lines).toHaveLength(3);
    await expect(lines[1]?.textContent).toBe(' ');
  },
};

export const Pagination: Story = {
  /**
   * Нижнее поле съедает почти весь лист: под текст остаётся пара строк, и
   * длинный абзац наверняка разъезжается на несколько страниц.
   */
  beforeEach: () => {
    applyText(LONG_TEXT, 1800);
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const pageCount = await canvas.findByTestId('page-count');

    await expect(Number(pageCount.textContent)).toBeGreaterThan(1);
  },
};

export const SinglePage: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const pageCount = await canvas.findByTestId('page-count');

    await expect(pageCount.textContent).toBe('1');
  },
};
