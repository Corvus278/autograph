/**
 * @vitest-environment jsdom
 */
import type { PaperFamily } from '@pages/Generator/lib/paper';
import { clearLayoutCache } from '@pages/Generator/model/measureLayout';
import { selectPageSheetId } from '@pages/Generator/model/recipeSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageLayout } from '@pages/Generator/model/usePageLayout';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { PageNav } from '@pages/Generator/ui/Generator/PageNav';
import { PagePreview } from '@pages/Generator/ui/Generator/PagePreview';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { findCalls, getCanvasFrame } from './helpers/canvas-recorder';
import type { MonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { createMonospaceMeasurerFactory } from './helpers/monospace-measurer';
import { buildRenderFamily, buildSheet } from './helpers/paper-family';

/**
 * Повторяет сборку экрана генератора, но с измерителем-моделью: настоящих
 * размеров jsdom не считает, а проверяем мы разбивку и состав отрисованного, а
 * не вёрстку.
 */
type HarnessProps = {
  /**
   * Фабрика измерителей-шпионов.
   */
  factory: MonospaceMeasurerFactory;
};

const Harness: FC<HarnessProps> = (props) => {
  const { factory } = props;
  const pages = usePageLayout(factory.create);
  const source = usePageRender(pages);

  return (
    <>
      <PagePreview source={source} />

      <PageNav pageCount={pages.length} />
    </>
  );
};

const FAMILY = buildRenderFamily();

/**
 * Ширина символа измерителя-модели в долях кегля. Кегль семьи-модели на
 * запасных метриках jsdom — 40 · 0,55 / 0,48 ≈ 45,8 пикселя, символ — около
 * 9,2 пикселя: блок в сто пикселей держит десять символов и не держит
 * одиннадцать.
 */
const CHAR_WIDTH = 0.2;

/**
 * Запас снизу в шагах разлиновки, оставляющий на странице ровно две строки:
 * верхний отступ блока у семьи-модели нулевой, нижнего поля нет, шаг строк на
 * линейке равен шагу разлиновки — (400 − 0 − 0 − 8 · 40) / 40 = 2.
 */
const TWO_LINE_BOTTOM_MARGIN = 8;

/**
 * Поправка кегля в долях шага: четверть шага семьи-модели — десять пикселей.
 */
const FONT_SIZE_CORRECTION = 0.25;

const createFactory = (): MonospaceMeasurerFactory => {
  return createMonospaceMeasurerFactory({ charWidth: CHAR_WIDTH });
};

/**
 * Узел canvas страницы: на нём рисует предпросмотр.
 *
 * @returns узел предпросмотра
 */
const getPageCanvas = (): HTMLCanvasElement => {
  const canvas = screen.getByTestId('page-canvas');

  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Предпросмотр рисует не на canvas');
  }

  return canvas;
};

/**
 * Слова, отрисованные на странице, в порядке отрисовки.
 *
 * @returns тексты, попавшие в снимок
 */
const getDrawnWords = (): unknown[] => {
  return findCalls(getCanvasFrame(getPageCanvas()), 'fillText').map(([text]) => {
    return text;
  });
};

/**
 * Отступ блока текста от левого края листа: рендерер сдвигает на него начало
 * координат перед отрисовкой строк.
 *
 * @returns отступ в канонических пикселях семьи
 */
const getBlockLeftPadding = (): unknown => {
  const [translate] = findCalls(getCanvasFrame(getPageCanvas()), 'translate');

  return translate?.[0];
};

const renderHarness = async (factory: MonospaceMeasurerFactory) => {
  render(<Harness factory={factory} />);

  await waitFor(() => {
    expect(getDrawnWords().length).toBeGreaterThan(0);
  });
};

/**
 * Семья-модель с теми же идентификаторами листов, но с другим нижним полем у
 * их разлиновки: правка листа, при которой идентификатор остаётся прежним.
 *
 * @returns семья с изменённой разлиновкой листов
 */
const buildFamilyWithEditedRuling = (): PaperFamily => {
  return {
    ...FAMILY,
    sheets: FAMILY.sheets.map((sheet) => {
      return buildSheet(
        sheet.id,
        { ...sheet.ruling, margins: { ...sheet.ruling.margins, bottom: 80 } },
        { width: sheet.width, height: sheet.height }
      );
    }),
  };
};

beforeEach(() => {
  clearLayoutCache();
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    text: 'раз два три четыре пять шесть',
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
  });
});

afterEach(() => {
  cleanup();
});

describe('разбивка на строки и страницы', () => {
  it('переносит текст по ширине блока', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    expect(getDrawnWords()).toEqual(['раз', 'два', 'три', 'четыре', 'пять', 'шесть']);
    expect(screen.queryByRole('navigation', { name: 'Страницы' })).toBeNull();
  });

  it('разбивает на страницы по вместимости листа', async () => {
    const factory = createFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    expect(getDrawnWords()).toEqual(['раз', 'два', 'три', 'четыре']);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('показывает выбранную страницу', async () => {
    const factory = createFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    act(() => {
      useGeneratorStore.getState().goToPage(1);
    });

    await waitFor(() => {
      expect(getDrawnWords()).toEqual(['пять', 'шесть']);
    });
  });

  it('страница раскладки несёт лист, доставшийся ей в прогоне', async () => {
    const factory = createFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });

    const { result } = renderHook(() => {
      return usePageLayout(factory.create);
    });

    await waitFor(() => {
      expect(result.current).toHaveLength(2);
    });

    const state = useGeneratorStore.getState();

    expect(
      result.current.map(({ sheetId }) => {
        return sheetId;
      })
    ).toEqual([selectPageSheetId(state, 0), selectPageSheetId(state, 1)]);
  });
});

describe('разворот чётных страниц', () => {
  it('отодвигает блок от отражённой линии поля', async () => {
    const factory = createFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    expect(getBlockLeftPadding()).toBeCloseTo(FAMILY.ruling.margins.left);

    act(() => {
      useGeneratorStore.getState().goToPage(1);
    });

    /**
     * Блок отражается вместе с листом: слева от него остаётся столько же,
     * сколько на нечётной странице оставалось справа.
     */
    await waitFor(() => {
      expect(getBlockLeftPadding()).toBeCloseTo(FAMILY.ruling.margins.right);
    });
  });
});

describe('кэш разбивки', () => {
  it('не измеряет заново при изменении цвета чернил', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    act(() => {
      useGeneratorStore.getState().setInkColor('#ff0000');
    });

    await waitFor(() => {
      expect(getDrawnWords().length).toBeGreaterThan(0);
    });

    expect(factory.createCalls()).toBe(measuresBefore);
  });

  it('не измеряет заново при повторной раскладке с теми же параметрами', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    cleanup();
    await renderHarness(factory);

    expect(factory.createCalls()).toBe(measuresBefore);
  });

  it('измеряет заново при изменении поправки кегля', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    act(() => {
      useGeneratorStore
        .getState()
        .setGeometryCorrection({ fontSizePx: FONT_SIZE_CORRECTION });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(measuresBefore + 1);
    });
  });

  it('берёт готовую разбивку из кэша при возврате к прежним параметрам', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    act(() => {
      useGeneratorStore
        .getState()
        .setGeometryCorrection({ fontSizePx: FONT_SIZE_CORRECTION });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(2);
    });

    act(() => {
      useGeneratorStore.getState().setGeometryCorrection({ fontSizePx: 0 });
    });

    await waitFor(() => {
      expect(getDrawnWords().length).toBeGreaterThan(0);
    });

    expect(factory.createCalls()).toBe(2);
  });

  it('раскладывает заново, когда в семью добавлен свой лист', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    /**
     * Лист подмешивается в семью без закрепления: сдвигается раздача листов
     * по страницам, а выбор пользователя остаётся прежним.
     */
    act(() => {
      useGeneratorStore.setState({
        userSheets: [
          { familyId: FAMILY.id, sheet: buildSheet('user-1'), isAnalyzed: true },
        ],
      });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(measuresBefore + 1);
    });
  });

  it('раскладывает заново при правке разлиновки листа без смены идентификатора', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    const measuresBefore = factory.createCalls();

    act(() => {
      useGeneratorStore.setState({ presetFamilies: [buildFamilyWithEditedRuling()] });
    });

    await waitFor(() => {
      expect(factory.createCalls()).toBe(measuresBefore + 1);
    });
  });
});

describe('снимок страницы', () => {
  it('не содержит элементов интерфейса', async () => {
    const factory = createFactory();

    useGeneratorStore.setState({ bottomMargin: TWO_LINE_BOTTOM_MARGIN });
    await renderHarness(factory);

    const pageNode = screen.getByTestId('page');

    expect(pageNode.querySelectorAll('button')).toHaveLength(0);
    expect(pageNode.querySelectorAll('nav')).toHaveLength(0);
    expect(pageNode.querySelectorAll('input')).toHaveLength(0);
    expect(pageNode.querySelectorAll('canvas')).toHaveLength(1);
  });

  it('рисует лист и текст, и ничего кроме', async () => {
    const factory = createFactory();

    await renderHarness(factory);

    const drawn = new Set(
      getCanvasFrame(getPageCanvas()).map((call) => {
        return call.name;
      })
    );

    expect([...drawn].sort()).toEqual([
      'fillStyle',
      'fillText',
      'font',
      'restore',
      'save',
      'scale',
      'translate',
    ]);
  });
});
