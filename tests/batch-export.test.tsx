/**
 * @vitest-environment jsdom
 */
import { renderPageInWorker } from '@pages/Generator/model/createPageRenderClient';
import type {
  PageRenderTask,
  RunRenderPlan,
} from '@pages/Generator/model/pageTask.types';
import { BatchBar } from '@pages/Generator/ui/Generator/SaveBar/BatchBar';
import { downloadBlob } from '@shared/lib/files';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Отрисовка подменяется целиком: тест проверяет оркестрацию и интерфейс, а
 * растра в jsdom нет. Заодно это ловит возврат отрисовки на главный поток —
 * тогда подменённый воркер остался бы без единого задания.
 */
vi.mock('@pages/Generator/model/createPageRenderClient', () => {
  return { renderPageInWorker: vi.fn() };
});

vi.mock('@shared/lib/files', () => {
  return {
    downloadBlob: vi.fn(),
    downloadDataUrl: vi.fn(),
    readBlobAsDataUrl: vi.fn(),
    readFileAsDataUrl: vi.fn(),
  };
});

/**
 * Масштаб снимка: страница рисуется в кадре листа один к одному, а не в размере
 * предпросмотра.
 */
const FRAME_SCALE = 1;

const PAGE_COUNT = 4;

/**
 * Задание-пустышка: подменённая отрисовка в него не заглядывает.
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
    },
    scale: FRAME_SCALE,
  },
  sheet: null,
  textureSrc: null,
  font: null,
  pageWidth: 200,
  pageHeight: 400,
  quality: 0.92,
};

const PLAN: RunRenderPlan = {
  pageCount: PAGE_COUNT,
  pageIndex: 0,
  buildTask: () => {
    return TASK;
  },
};

/**
 * Незавершённые отрисовки в порядке поступления: тест сам решает, когда
 * страница будет готова, и потому видит интерфейс в середине выгрузки.
 */
let pendingPages: Array<(page: Blob) => void> = [];

/**
 * Подменённая отрисовка: обещание висит, пока тест его не разрешит, и рвётся
 * по сигналу отмены — ровно так ведёт себя клиент воркера.
 */
const deferRender = () => {
  vi.mocked(renderPageInWorker).mockImplementation((_task, signal) => {
    return new Promise<Blob>((resolve, reject) => {
      pendingPages.push(resolve);

      signal?.addEventListener(
        'abort',
        () => {
          reject(new Error('Отрисовка страницы отменена'));
        },
        { once: true }
      );
    });
  });
};

/**
 * Дожидается очередного задания и объявляет страницу готовой.
 */
const completePage = async (pageIndex: number) => {
  await waitFor(() => {
    expect(pendingPages.length).toBeGreaterThan(pageIndex);
  });

  await act(async () => {
    pendingPages[pageIndex]?.(new Blob(['page'], { type: 'image/jpeg' }));
  });
};

const clickBatch = async () => {
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: 'Скачать все страницы' }));
};

const clickCancel = async () => {
  const user = userEvent.setup();

  await user.click(screen.getByRole('button', { name: 'Отменить' }));
};

beforeEach(() => {
  pendingPages = [];
  vi.mocked(downloadBlob).mockClear();
  deferRender();
});

afterEach(() => {
  cleanup();
  vi.mocked(renderPageInWorker).mockReset();
});

describe('прогресс выгрузки пачки', () => {
  it('показывает число готовых страниц и общее число', async () => {
    render(<BatchBar plan={PLAN} />);

    await clickBatch();

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(`Готово 0 из ${PAGE_COUNT}`);
    });

    await completePage(0);

    expect(screen.getByRole('status').textContent).toBe(`Готово 1 из ${PAGE_COUNT}`);

    await completePage(1);

    expect(screen.getByRole('status').textContent).toBe(`Готово 2 из ${PAGE_COUNT}`);
  });

  it('скачивает архив и убирает прогресс, когда пачка дошла до конца', async () => {
    render(<BatchBar plan={PLAN} />);

    await clickBatch();

    for (let pageIndex = 0; pageIndex < PAGE_COUNT; pageIndex += 1) {
      await completePage(pageIndex);
    }

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });

    expect(vi.mocked(downloadBlob).mock.calls[0]?.[1]).toBe('handwriting_pages.zip');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('показывает номер неудавшейся страницы и всё равно отдаёт архив', async () => {
    render(<BatchBar plan={PLAN} />);

    await clickBatch();

    await completePage(0);

    await waitFor(() => {
      expect(pendingPages.length).toBeGreaterThan(1);
    });

    vi.mocked(renderPageInWorker).mockRejectedValueOnce(new Error('страница упала'));

    await act(async () => {
      pendingPages[1]?.(new Blob(['page'], { type: 'image/jpeg' }));
    });

    /**
     * Отказ приходится на третью страницу, а её обещание в очередь теста не
     * попадает: следом сразу начинается четвёртая.
     */
    await completePage(2);

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Не отрисовались страницы');
    });

    expect(downloadBlob).toHaveBeenCalledTimes(1);
  });
});

describe('отмена выгрузки', () => {
  it('прекращает генерацию, архив не скачивает и оставляет экран рабочим', async () => {
    render(<BatchBar plan={PLAN} />);

    await clickBatch();

    await waitFor(() => {
      expect(pendingPages).toHaveLength(1);
    });

    await clickCancel();

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });

    expect(downloadBlob).not.toHaveBeenCalled();
    expect(pendingPages).toHaveLength(1);

    await clickBatch();

    await waitFor(() => {
      expect(pendingPages).toHaveLength(2);
    });
  });
});

describe('отзывчивость интерфейса во время отрисовки', () => {
  it('не рисует страницу на главном потоке и отдаёт заданиям кадр листа', async () => {
    const createElement = vi.spyOn(document, 'createElement');

    render(<BatchBar plan={PLAN} />);

    await clickBatch();

    for (let pageIndex = 0; pageIndex < PAGE_COUNT; pageIndex += 1) {
      await completePage(pageIndex);
    }

    await waitFor(() => {
      expect(downloadBlob).toHaveBeenCalledTimes(1);
    });

    const canvasCalls = createElement.mock.calls.filter((call) => {
      return String(call[0]) === 'canvas';
    });

    expect(canvasCalls).toHaveLength(0);
    expect(renderPageInWorker).toHaveBeenCalledTimes(PAGE_COUNT);
    expect(vi.mocked(renderPageInWorker).mock.calls[0]?.[0].params.scale).toBe(
      FRAME_SCALE
    );

    createElement.mockRestore();
  });

  it('перерисовывает прогресс и принимает нажатия, пока страницы ещё рисуются', async () => {
    render(<BatchBar plan={PLAN} />);

    await clickBatch();
    await completePage(0);

    /**
     * Вторая страница ещё в работе, а интерфейс уже показал результат первой:
     * главный поток между страницами свободен, иначе прогресс дождался бы
     * конца всей пачки.
     */
    await waitFor(() => {
      expect(pendingPages).toHaveLength(2);
    });

    expect(screen.getByRole('status').textContent).toBe(`Готово 1 из ${PAGE_COUNT}`);

    await clickCancel();

    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
  });
});
