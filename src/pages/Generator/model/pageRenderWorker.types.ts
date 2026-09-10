import type { SheetPlacement } from '../lib/paper/paper.types';
import type { PageRenderParams } from '../lib/render';

import type { PageFontSource, PageRenderTask } from './pageTask.types';

/**
 * Фотография листа на границе воркера: битмап уезжает передачей владения, а
 * размеры нужны отражению — оно рисует фотографию в её собственный
 * прямоугольник.
 */
export type RenderSheetBitmap = {
  /**
   * Декодированная фотография.
   */
  image: ImageBitmap;

  /**
   * Ширина фотографии в её собственных пикселях.
   */
  width: number;

  /**
   * Высота фотографии в её собственных пикселях.
   */
  height: number;

  /**
   * Фотографию нужно отразить по горизонтали.
   */
  isMirrored: boolean;

  /**
   * Прямоугольник фотографии на странице в канонических пикселях семьи.
   */
  placement: SheetPlacement;
};

/**
 * Задание воркеру: отрисовать одну страницу и отдать её файлом.
 */
export type RenderPageRequest = {
  /**
   * Номер задания: воркер отвечает по нему, потому что задания идут вперемешку
   * и порядок ответов не обещан.
   */
  requestId: number;

  /**
   * Параметры отрисовки без ресурсов. Фон, карта текстуры и контуры в них
   * пусты — воркер подставляет их сам.
   */
  params: PageRenderParams;

  /**
   * Фотография листа. `null` — фон не рисуется.
   */
  sheet: RenderSheetBitmap | null;

  /**
   * Путь к карте текстуры листа. `null` — карты нет.
   */
  textureSrc: string | null;

  /**
   * Шрифт страницы. `null` — контуров нет, текст рисуется шрифтом как есть.
   */
  font: PageFontSource | null;

  /**
   * Ширина страницы в канонических пикселях семьи.
   */
  pageWidth: number;

  /**
   * Высота страницы в канонических пикселях семьи.
   */
  pageHeight: number;

  /**
   * Качество кодирования от 0 до 1.
   */
  quality: number;
};

/**
 * Готовая страница.
 */
export type RenderPageDone = {
  /**
   * Номер задания.
   */
  requestId: number;

  /**
   * Признак исхода.
   */
  status: 'done';

  /**
   * Файл страницы.
   */
  page: Blob;
};

/**
 * Страница не отрисовалась.
 */
export type RenderPageFailed = {
  /**
   * Номер задания.
   */
  requestId: number;

  /**
   * Признак исхода.
   */
  status: 'failed';

  /**
   * Чем именно кончилась отрисовка: сообщение уходит в отчёт о пачке.
   */
  message: string;
};

/**
 * Ответ воркера на задание.
 */
export type RenderPageResponse = RenderPageDone | RenderPageFailed;

/**
 * Порт воркера глазами клиента: только то, чем клиент пользуется. Под этот тип
 * подходит `Worker` целиком, а тест подставляет запись сообщений.
 */
export type PageRenderPort = {
  /**
   * Отправляет задание, передавая владение перечисленными объектами.
   */
  postMessage: (request: RenderPageRequest, transfer: Transferable[]) => void;

  /**
   * Подписывается на ответы воркера.
   */
  addEventListener: (
    type: 'message',
    listener: (event: MessageEvent<RenderPageResponse>) => void
  ) => void;
};

/**
 * Чем клиент открывает воркер и откуда берёт фотографии.
 */
export type PageRenderClientDeps = {
  /**
   * Открывает порт воркера. Зовётся один раз — на первое задание.
   */
  createPort: () => PageRenderPort;

  /**
   * Декодирует фотографию листа в битмап.
   */
  loadImage: (src: string) => Promise<ImageBitmap>;
};

/**
 * Отрисовка страницы вне основного потока.
 */
export type PageRenderClient = {
  /**
   * Отрисовывает страницу по заданию и отдаёт файл. Отказ — страница не
   * отрисовалась; пачка на этом не останавливается.
   */
  render: (task: PageRenderTask, signal?: AbortSignal) => Promise<Blob>;
};
