/**
 * @vitest-environment jsdom
 */
import { createPageRenderClient } from '@pages/Generator/model/createPageRenderClient';
import type {
  PageRenderPort,
  RenderPageRequest,
  RenderPageResponse,
} from '@pages/Generator/model/pageRenderWorker.types';
import type { PageRenderTask } from '@pages/Generator/model/pageTask.types';
import { describe, expect, it, vi } from 'vitest';

/**
 * Битмап-пустышка: клиент его не разглядывает, а только передаёт владение.
 */
const BITMAP: ImageBitmap = {
  width: 8,
  height: 8,
  close: () => {},
};

/**
 * Задание с фотографией листа.
 */
const TASK: PageRenderTask = {
  params: {
    page: { lines: [] },
    background: null,
    inkColor: '#123456',
    ink: { lighting: null, texture: null, seed: 7 },
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
    },
    scale: 3,
  },
  sheet: {
    src: '/sheet-0.jpg',
    width: 16,
    height: 32,
    isMirrored: true,
    placement: { x: -20, y: -10, width: 220, height: 440 },
  },
  textureSrc: '/texture.png',
  font: { family: 'Abram', url: '/fonts/Abram.ttf', hasVariance: true },
  pageWidth: 200,
  pageHeight: 400,
  quality: 0.92,
};

/**
 * Порт воркера вместе с записью отправленного: тест отвечает за воркер сам.
 */
type PortRecorder = {
  /**
   * Порт, который отдают клиенту.
   */
  port: PageRenderPort;

  /**
   * Отправленные задания в порядке отправки.
   */
  requests: RenderPageRequest[];

  /**
   * Списки объектов, владение которыми передали вместе с заданиями.
   */
  transfers: Transferable[][];

  /**
   * Отвечает клиенту от имени воркера.
   */
  reply: (response: RenderPageResponse) => void;
};

const createPortRecorder = (): PortRecorder => {
  const requests: RenderPageRequest[] = [];
  const transfers: Transferable[][] = [];
  const listeners: Array<(event: MessageEvent<RenderPageResponse>) => void> = [];

  return {
    port: {
      postMessage: (request, transfer) => {
        requests.push(request);
        transfers.push(transfer);
      },
      addEventListener: (_type, listener) => {
        listeners.push(listener);
      },
    },
    requests,
    transfers,
    reply: (response) => {
      listeners.forEach((listener) => {
        listener(new MessageEvent('message', { data: response }));
      });
    },
  };
};

const buildClient = (recorder: PortRecorder) => {
  return createPageRenderClient({
    createPort: () => {
      return recorder.port;
    },
    loadImage: () => {
      return Promise.resolve(BITMAP);
    },
  });
};

describe('клиент отрисовки в воркере', () => {
  it('отправляет задание с фотографией листа и передаёт владение битмапом', async () => {
    const recorder = createPortRecorder();
    const client = buildClient(recorder);
    const page = client.render(TASK);

    await vi.waitFor(() => {
      expect(recorder.requests).toHaveLength(1);
    });

    const [request] = recorder.requests;

    expect(request?.sheet?.image).toBe(BITMAP);
    expect(request?.sheet?.isMirrored).toBe(true);
    expect(request?.params.scale).toBe(3);
    expect(request?.textureSrc).toBe('/texture.png');
    expect(request?.font?.url).toBe('/fonts/Abram.ttf');
    expect(recorder.transfers[0]).toEqual([BITMAP]);

    recorder.reply({
      requestId: request?.requestId || 0,
      status: 'done',
      page: new Blob(['page'], { type: 'image/jpeg' }),
    });

    await expect(page).resolves.toBeInstanceOf(Blob);
  });

  it('открывает порт один раз на все задания', async () => {
    const recorder = createPortRecorder();
    const createPort = vi.fn(() => {
      return recorder.port;
    });
    const client = createPageRenderClient({
      createPort,
      loadImage: () => {
        return Promise.resolve(BITMAP);
      },
    });

    const pages = [client.render(TASK), client.render(TASK)];

    await vi.waitFor(() => {
      expect(recorder.requests).toHaveLength(2);
    });

    expect(createPort).toHaveBeenCalledTimes(1);
    expect(recorder.requests[0]?.requestId).not.toBe(recorder.requests[1]?.requestId);

    recorder.requests.forEach((request) => {
      recorder.reply({
        requestId: request.requestId,
        status: 'done',
        page: new Blob(['page'], { type: 'image/jpeg' }),
      });
    });

    await expect(Promise.all(pages)).resolves.toHaveLength(2);
  });

  it('превращает отказ воркера в отказ обещания', async () => {
    const recorder = createPortRecorder();
    const client = buildClient(recorder);
    const page = client.render(TASK);

    await vi.waitFor(() => {
      expect(recorder.requests).toHaveLength(1);
    });

    recorder.reply({
      requestId: recorder.requests[0]?.requestId || 0,
      status: 'failed',
      message: 'Внеэкранный canvas не дал контекст',
    });

    await expect(page).rejects.toThrow('Внеэкранный canvas не дал контекст');
  });

  it('обрывает отрисовку по сигналу отмены', async () => {
    const recorder = createPortRecorder();
    const client = buildClient(recorder);
    const controller = new AbortController();
    const page = client.render(TASK, controller.signal);

    await vi.waitFor(() => {
      expect(recorder.requests).toHaveLength(1);
    });

    controller.abort();

    await expect(page).rejects.toThrow('Отрисовка страницы отменена');
  });

  it('не шлёт задание, если отменили до старта', async () => {
    const recorder = createPortRecorder();
    const client = buildClient(recorder);
    const controller = new AbortController();

    controller.abort();

    await expect(client.render(TASK, controller.signal)).rejects.toThrow(
      'Отрисовка страницы отменена'
    );

    expect(recorder.requests).toHaveLength(0);
  });
});
