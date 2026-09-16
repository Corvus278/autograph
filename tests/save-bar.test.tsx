/**
 * @vitest-environment jsdom
 */
import type { LayoutPage } from '@pages/Generator/lib/paginate/paginate.types';
import type {
  PageRenderTask,
  RunRenderPlan,
} from '@pages/Generator/model/pageTask.types';
import { buildPageSheetSequence } from '@pages/Generator/model/recipeSelectors';
import { useExportPage } from '@pages/Generator/model/useExportPage';
import type { ExportDeps } from '@pages/Generator/model/useExportPage.types';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { useRunRender } from '@pages/Generator/model/useRunRender';
import { SaveBar } from '@pages/Generator/ui/Generator/SaveBar';
import { Button } from '@shared/ui/Button';
import {
  act,
  cleanup,
  render,
  renderHook,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildRenderFamily } from './helpers/paper-family';

type HarnessProps = {
  /**
   * Подменённые зависимости экспорта.
   */
  deps: Partial<ExportDeps>;

  /**
   * План отрисовки прогона; `null` — страница ещё не готова.
   */
  plan: RunRenderPlan | null;
};

/**
 * Задание-пустышка: с подменённой растеризацией параметры отрисовки никто не
 * читает, но сохранение обязано их дождаться. Лист пуст намеренно — иначе
 * сохранение полезло бы за фотографией, которой в jsdom взяться неоткуда.
 */
const TASK: PageRenderTask = {
  params: {
    page: { lines: [] },
    background: null,
    inkColor: '#000000',
    ink: { lighting: null, texture: null, seed: 1 },
    glyphs: null,
    fontFamily: 'Abram',
    geometry: {
      fontSizePx: 20,
      lineSpacing: 0,
      topOffset: 0,
      leftPadding: 0,
      blockWidth: 100,
      blockRotate: 0,
      fontMetrics: { fontAscent: 0.8, lineHeight: 1.2 },
      bend: null,
      perspective: null,
    },
    scale: 3,
  },
  sheet: null,
  textureSrc: null,
  font: null,
  pageWidth: 200,
  pageHeight: 400,
  quality: 0.92,
};

/**
 * План-пустышка на четыре страницы: текущая — третья.
 */
const buildPlan = (buildTask: (pageIndex: number) => PageRenderTask): RunRenderPlan => {
  return { pageCount: 4, pageIndex: 2, buildTask };
};

const PLAN: RunRenderPlan = buildPlan(() => {
  return TASK;
});

/**
 * Повторяет кнопку сохранения, но с подменённой растеризацией и скачиванием:
 * настоящего растра в jsdom нет.
 */
const Harness: FC<HarnessProps> = (props) => {
  const { deps, plan } = props;
  const { error, save } = useExportPage(plan, deps);

  const handleSaveClick = () => {
    void save();
  };

  return (
    <>
      <Button onClick={handleSaveClick}>Сохранить страницу</Button>

      {error ? <p role="alert">{error}</p> : null}
    </>
  );
};

const clickSave = async () => {
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: 'Сохранить страницу' }));
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

afterEach(() => {
  cleanup();
});

describe('сохранение страницы', () => {
  it('скачивает снимок страницы, когда сцена выключена', async () => {
    const download = vi.fn();
    const composeScene = vi.fn();

    render(
      <Harness
        plan={PLAN}
        deps={{
          renderPage: () => {
            return Promise.resolve('data:image/jpeg;base64,page');
          },
          composeScene,
          download,
        }}
      />
    );

    await clickSave();

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith(
        'data:image/jpeg;base64,page',
        'handwriting_page.jpg'
      );
    });

    expect(composeScene).not.toHaveBeenCalled();
  });

  it('скачивает композицию, когда режим сцены включён', async () => {
    const download = vi.fn();

    useGeneratorStore.setState({ isSceneEnabled: true });

    render(
      <Harness
        plan={PLAN}
        deps={{
          renderPage: () => {
            return Promise.resolve('data:image/jpeg;base64,page');
          },
          composeScene: () => {
            return Promise.resolve('data:image/jpeg;base64,scene');
          },
          download,
        }}
      />
    );

    await clickSave();

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith(
        'data:image/jpeg;base64,scene',
        'handwriting_with_bg.jpg'
      );
    });
  });

  it('при отказе отрисовки не скачивает файл и показывает сообщение', async () => {
    const download = vi.fn();

    render(
      <Harness
        plan={PLAN}
        deps={{
          renderPage: () => {
            return Promise.reject(new Error('отрисовка не удалась'));
          },
          download,
        }}
      />
    );

    await clickSave();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Не удалось сохранить страницу'
      );
    });

    expect(download).not.toHaveBeenCalled();
  });

  it('не сохраняет, пока страница не отрисована', async () => {
    const download = vi.fn();
    const renderPage = vi.fn();

    render(<Harness plan={null} deps={{ renderPage, download }} />);

    await clickSave();

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Страница ещё не отрисована'
      );
    });

    expect(renderPage).not.toHaveBeenCalled();
    expect(download).not.toHaveBeenCalled();
  });

  it('рисует ровно текущую страницу прогона, а не первую', async () => {
    const download = vi.fn();
    const buildTask = vi.fn(() => {
      return TASK;
    });

    render(
      <Harness
        plan={buildPlan(buildTask)}
        deps={{
          renderPage: () => {
            return Promise.resolve('data:image/jpeg;base64,page');
          },
          download,
        }}
      />
    );

    await clickSave();

    await waitFor(() => {
      expect(download).toHaveBeenCalledTimes(1);
    });

    expect(buildTask).toHaveBeenCalledTimes(1);
    expect(buildTask).toHaveBeenCalledWith(2);
  });

  it('сохраняет показанную страницу, когда номер обогнал раскладку', async () => {
    const family = buildRenderFamily();

    /**
     * Номер страницы за пределами раскладки: так бывает, пока раскладка не
     * пересчитана под укоротившийся текст, и предпросмотр в это время
     * показывает первую страницу.
     */
    useGeneratorStore.setState({
      presetFamilies: [family],
      familyId: family.id,
      sheetId: family.sheets[0]?.id || '',
      pageIndex: 3,
    });

    const sheetIdAt = buildPageSheetSequence(useGeneratorStore.getState(), family);
    const pages: LayoutPage[] = [0, 1].map((pageIndex) => {
      return {
        sheetId: sheetIdAt(pageIndex),
        lines: [{ text: `страница ${pageIndex}`, paragraphIndex: 0 }],
      };
    });
    const renderPage = vi.fn<ExportDeps['renderPage']>(() => {
      return Promise.resolve('data:image/jpeg;base64,page');
    });
    const download = vi.fn();
    const { result } = renderHook(() => {
      return {
        source: usePageRender(pages),
        control: useExportPage(useRunRender(pages), { renderPage, download }),
      };
    });

    await act(async () => {
      await result.current.control.save();
    });

    const [task] = renderPage.mock.calls[0] || [];
    const { source } = result.current;
    const shown = source?.buildParams(1);

    expect(download).toHaveBeenCalledTimes(1);
    expect(shown?.page.lines.length).toBeGreaterThan(0);
    expect(task?.params.page).toEqual(shown?.page);
    expect(task?.params.geometry).toEqual(shown?.geometry);
    expect([task?.pageWidth, task?.pageHeight]).toEqual([
      source?.pageWidth,
      source?.pageHeight,
    ]);
  });
});

describe('панель сохранения', () => {
  it('держит сохранение страницы и выгрузку пачки разными действиями', () => {
    render(<SaveBar plan={PLAN} />);

    expect(screen.getByRole('button', { name: 'Сохранить страницу' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Скачать все страницы' })).toBeTruthy();
  });

  it('сохраняет одну страницу, не запуская выгрузку пачки', async () => {
    const buildTask = vi.fn(() => {
      return TASK;
    });

    render(<SaveBar plan={buildPlan(buildTask)} />);

    await clickSave();

    await waitFor(() => {
      expect(buildTask).toHaveBeenCalledWith(2);
    });

    expect(buildTask).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
