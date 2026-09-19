/**
 * @vitest-environment jsdom
 */
import { clearLayoutCache } from '@pages/Generator/model/measureLayout';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageLayout } from '@pages/Generator/model/usePageLayout';
import { TextPane } from '@pages/Generator/ui/Generator/TextPane';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { MonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { buildRenderFamily } from './helpers/paper-family';

type HarnessProps = {
  /**
   * Фабрика измерителей-моделей: jsdom не считает размеров.
   */
  factory: MonospaceMeasurerFactory;
};

/**
 * Число страниц приходит в поле текста из раскладки, как на экране генератора.
 */
const Harness: FC<HarnessProps> = (props) => {
  const { factory } = props;
  const pages = usePageLayout(factory.create);

  return <TextPane pageCount={pages.length} />;
};

const FAMILY = buildRenderFamily();

/**
 * Ширина символа модели в долях кегля: блок семьи-модели держит десять
 * символов в строке.
 */
const CHAR_WIDTH = 0.2;

/**
 * Запас снизу в шагах разлиновки, оставляющий на странице две строки.
 */
const TWO_LINE_BOTTOM_MARGIN = 7;

const NBSP = ' ';

beforeEach(() => {
  clearLayoutCache();
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    text: 'раз два',
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
    bottomMargin: TWO_LINE_BOTTOM_MARGIN,
  });
  useGeneratorStore.getState().selectRealismLevel('even');
});

afterEach(() => {
  cleanup();
});

describe('поле текста', () => {
  it('ввод обновляет счётчик знаков и число страниц', async () => {
    const user = userEvent.setup();

    render(
      <Harness factory={createMonospaceMeasurerFactory({ charWidth: CHAR_WIDTH })} />
    );

    await waitFor(() => {
      expect(screen.getByText(`1${NBSP}страница`)).toBeDefined();
    });
    expect(screen.getByText(`7${NBSP}знаков`)).toBeDefined();

    const field = screen.getByRole('textbox', { name: 'Текст' });

    await user.click(field);
    await user.keyboard(' три четыре пять шесть');

    await waitFor(() => {
      expect(screen.getByText(`2${NBSP}страницы`)).toBeDefined();
    });
    expect(screen.getByText(`29${NBSP}знаков`)).toBeDefined();
    expect(useGeneratorStore.getState().text).toBe('раз два три четыре пять шесть');
  });

  it('пишет число знаков с разрядами и согласует слово', () => {
    useGeneratorStore.setState({ text: 'а'.repeat(1241) });

    render(<TextPane pageCount={5} />);

    expect(screen.getByText(`1${NBSP}241${NBSP}знак`)).toBeDefined();
    expect(screen.getByText(`5${NBSP}страниц`)).toBeDefined();
  });
});
