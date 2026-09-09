import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { expect, within } from 'storybook/test';

import { clearLayoutCache } from '../../../model/measureLayout';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../model/useGeneratorStore';
import { usePageLayout } from '../../../model/usePageLayout';

/**
 * Проверки разбивки на настоящем измерителе. В jsdom их не поставить: layout
 * там не считается, а переносы у рукописного шрифта зависят от его метрик.
 */
type RealLayoutProbeProps = {
  /**
   * Высота листа в пикселях; `null` — предела нет.
   */
  backgroundHeight: number | null;
};

const RealLayoutProbe: FC<RealLayoutProbeProps> = (props) => {
  const { backgroundHeight } = props;
  const pages = usePageLayout(backgroundHeight);

  return (
    <div>
      <p data-testid="page-count">{pages.length}</p>

      <div style={{ width: '446px', fontFamily: 'Abram', fontSize: '1.6em' }}>
        {pages.map((page, pageIndex) => {
          return (
            <div key={pageIndex} data-testid="page-block">
              {page.lines.map((line, lineIndex) => {
                return (
                  <div key={lineIndex} data-testid="line">
                    {line.text || ' '}
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

const meta = {
  component: RealLayoutProbe,
  args: { backgroundHeight: 896 },
  beforeEach: () => {
    clearLayoutCache();
    useGeneratorStore.setState({
      ...DEFAULT_GENERATOR_STATE,
      text: LONG_TEXT,
      blockWidth: 446,
      topOffset: 0,
      bottomMargin: 0,
    });
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
    clearLayoutCache();
    useGeneratorStore.setState({
      ...DEFAULT_GENERATOR_STATE,
      text: 'короткое сверхдлинноенеразрывноесловокотороенепомещается хвост',
      blockWidth: 200,
      topOffset: 0,
      bottomMargin: 0,
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const lines = await canvas.findAllByTestId('line');
    const texts = lines.map((line: HTMLElement) => {
      return line.textContent ?? '';
    });

    await expect(texts).toContain('сверхдлинноенеразрывноесловокотороенепомещается');
  },
};

export const EmptyParagraphKept: Story = {
  beforeEach: () => {
    clearLayoutCache();
    useGeneratorStore.setState({
      ...DEFAULT_GENERATOR_STATE,
      text: 'первый абзац\n\nвторой абзац',
      blockWidth: 446,
      topOffset: 0,
      bottomMargin: 0,
    });
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const lines = await canvas.findAllByTestId('line');

    await expect(lines).toHaveLength(3);
    await expect(lines[1]?.textContent).toBe(' ');
  },
};

export const Pagination: Story = {
  /**
   * Высота под текст — примерно на две строки: при межстрочном интервале по
   * умолчанию строка занимает около тридцати пикселей.
   */
  args: { backgroundHeight: 60 },
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
