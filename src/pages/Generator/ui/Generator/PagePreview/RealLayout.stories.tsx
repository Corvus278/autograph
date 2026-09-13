import type { Meta, StoryObj } from '@storybook/react-vite';
import type { FC } from 'react';
import { expect, within } from 'storybook/test';

import { HANDWRITING_FONTS } from '../../../config';
import { createDomMeasurer } from '../../../lib/measure/createDomMeasurer';
import { WRAP_WIDTH_SLACK } from '../../../lib/paginate/paginate';
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
  const { sheetGeometry, fontFamily } = usePageGeometry();

  return (
    <div>
      <p data-testid="page-count">{pages.length}</p>

      <div
        style={{
          width: `${sheetGeometry?.blockWidth || 0}px`,
          fontFamily,
          fontSize: `${sheetGeometry?.fontSizePx || 0}px`,
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
 * строки: кегль и ширину блока выводит автокалибровка из разлиновки листа, и
 * слово в шесть десятков букв на иных метриках шрифта в строку помещается —
 * проверять перенос на нём значило бы гадать.
 */
const UNBREAKABLE_WORD =
  'сверхдлинноенеразрывноесловокотороенепомещаетсяниводнустрокукакойбыкеглькакуюбыширинублокаикакойбышрифтдлянегониподобрали';

/**
 * Запас снизу в шагах разлиновки, при котором под текст остаётся одна строка.
 * Лист по умолчанию — клетка без измерений высотой около сорока двух шагов:
 * верхний отступ и нижнее поле забирают ещё три, а строка в клетку занимает
 * два шага. Тридцать семь шагов оставляют меньше двух строк при любых
 * метриках шрифта.
 */
const ONE_LINE_BOTTOM_MARGIN = 37;

/**
 * Шрифт, с которым генератор открывается.
 */
const DEFAULT_FONT = HANDWRITING_FONTS[0]?.family || '';

/**
 * Кегли проверки линейности: мельче и крупнее кегля, на котором меряет
 * измеритель, и не кратные ему — совпадение на кратном кегле могло бы быть
 * совпадением округлений.
 */
const LINEARITY_FONT_SIZES_PX = [23.7, 61.3];

/**
 * Ставит стор в известное состояние: текст задаётся story, остальное — значения
 * по умолчанию. Ширина блока и кегль выводятся из разлиновки листа, поэтому
 * руками не задаются.
 *
 * @param text — текст генератора
 * @param bottomMargin — запас снизу в шагах разлиновки
 */
const applyText = (text: string, bottomMargin = 0) => {
  clearLayoutCache();
  useGeneratorStore.setState({ ...DEFAULT_GENERATOR_STATE, text, bottomMargin });
};

/**
 * Ширина строки, набранной шрифтом в заданном кегле, как её раскладывает
 * браузер. Меряется отдельным элементом, мимо измерителя: проверяется именно
 * измеритель.
 *
 * @param text — строка
 * @param fontFamily — семейство шрифта
 * @param fontSizePx — кегль в пикселях
 * @returns ширина строки в пикселях
 */
const measureRenderedWidth = (
  text: string,
  fontFamily: string,
  fontSizePx: number
): number => {
  const element = document.createElement('span');

  element.style.cssText = 'position: absolute; left: -10000px; white-space: pre';
  element.style.fontFamily = fontFamily;
  element.style.fontSize = `${fontSizePx}px`;
  element.textContent = text;
  document.body.append(element);

  const range = document.createRange();

  range.selectNodeContents(element);

  const width = [...range.getClientRects()].reduce((total, rect) => {
    return total + rect.width;
  }, 0);

  element.remove();

  return width;
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
   * Запас снизу съедает почти весь лист: под текст остаётся одна строка, и
   * длинный абзац наверняка разъезжается на несколько страниц.
   */
  beforeEach: () => {
    applyText(LONG_TEXT, ONE_LINE_BOTTOM_MARGIN);
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

/**
 * Ширина в долях кегля переводится в пиксели умножением на кегль страницы.
 * Браузер раскладывает строку почти линейно по кеглю, но не везде точно: Linux
 * Chromium ставит глифы целыми пикселями и расходится с пересчётом до 0,9 %.
 * Допуск — запас, который разбивка оставляет от ширины блока
 * (`WRAP_WIDTH_SLACK`): расхождение сверх него вывело бы строку за блок.
 * Проверяется на длинной строке — на ней расхождение набегает сильнее всего.
 */
export const WidthScalesWithFontSize: Story = {
  play: async () => {
    await document.fonts.load(`16px "${DEFAULT_FONT}"`);
    await expect(document.fonts.check(`16px "${DEFAULT_FONT}"`)).toBe(true);

    const measurer = createDomMeasurer({ fontFamily: DEFAULT_FONT });
    const share = measurer.measureWidth(LONG_TEXT);

    measurer.destroy();

    await expect(share).toBeGreaterThan(0);

    for (const fontSizePx of LINEARITY_FONT_SIZES_PX) {
      const renderedWidth = measureRenderedWidth(LONG_TEXT, DEFAULT_FONT, fontSizePx);

      const expectedWidth = share * fontSizePx;

      await expect(Math.abs(renderedWidth - expectedWidth)).toBeLessThanOrEqual(
        expectedWidth * WRAP_WIDTH_SLACK
      );
    }
  },
};
