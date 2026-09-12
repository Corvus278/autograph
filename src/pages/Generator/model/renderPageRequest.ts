import { PAGE_IMAGE_MIME } from '../lib/export/pageImageFormat';
import { loadFontGlyphs } from '../lib/glyph';
import type {
  InkTextureImage,
  PageGlyphs,
  RenderBackground,
  RenderImage,
} from '../lib/render';
import { loadRenderImage } from '../lib/render';

import { drawPage, measurePageImage } from './drawPage';
import { mirrorRenderImage } from './mirrorRenderImage';
import type { CreateMirrorSurface, MirrorSurface } from './pageRender.types';
import type { RenderPageRequest } from './pageRenderWorker.types';
import type { PageBlobSurface, PageRenderSurfaces } from './pageTask.types';

/**
 * Карты текстуры по адресу. Одна и та же карта достаётся многим страницам
 * пачки, а декодирование полноразмерной картинки стоит заметно дороже
 * отрисовки: без кэша каждая страница платила бы за него заново.
 */
const textureCache = new Map<string, Promise<InkTextureImage>>();

/**
 * Поверхность страницы на внеэкранном canvas.
 *
 * @param width — ширина снимка в пикселях
 * @param height — высота снимка в пикселях
 * @returns поверхность, отдающая нарисованное файлом
 */
const createOffscreenPageSurface = (width: number, height: number): PageBlobSurface => {
  const canvas = new OffscreenCanvas(width, height);

  return {
    getContext: (contextId) => {
      return canvas.getContext(contextId);
    },
    convertToBlob: (options) => {
      return canvas.convertToBlob(options);
    },
  };
};

/**
 * Поверхность отражения на внеэкранном canvas.
 *
 * @param width — ширина фотографии в пикселях
 * @param height — высота фотографии в пикселях
 * @returns поверхность вместе с её контекстом
 */
const createOffscreenMirrorSurface: CreateMirrorSurface = (width, height) => {
  const canvas = new OffscreenCanvas(width, height);
  const surface: MirrorSurface = { context: canvas.getContext('2d'), image: canvas };

  return surface;
};

/**
 * Поверхности по умолчанию: внеэкранный canvas. Ни документа, ни его canvas в
 * воркере нет, и подставить сюда обычный холст не выйдет.
 */
const OFFSCREEN_SURFACES: PageRenderSurfaces = {
  createPage: createOffscreenPageSurface,
  createMirror: createOffscreenMirrorSurface,
};

/**
 * Карта текстуры листа по адресу.
 *
 * @param src — адрес карты; `null` — карты нет
 * @returns изображение карты; `null` — карты нет или она не загрузилась
 */
const resolveTexture = async (src: string | null): Promise<InkTextureImage | null> => {
  if (!src) {
    return null;
  }

  const cached = textureCache.get(src);

  if (cached) {
    return cached.catch(() => {
      return null;
    });
  }

  const loading = loadRenderImage(src).catch((error: unknown) => {
    textureCache.delete(src);

    throw error;
  });

  textureCache.set(src, loading);

  return loading.catch(() => {
    return null;
  });
};

/**
 * Контуры шрифта страницы.
 *
 * Неразобранный шрифт страницу не роняет: текст рисуется обычными буквами —
 * ровно так же, как до загрузки контуров рисует предпросмотр.
 *
 * @param font — семейство и адрес файла; `null` — контуров нет
 * @returns контуры вместе с признаком вариативности; `null` — контуров нет
 */
const resolveGlyphs = async (
  font: RenderPageRequest['font']
): Promise<PageGlyphs | null> => {
  if (!font) {
    return null;
  }

  try {
    const source = await loadFontGlyphs(font.family, font.url);

    return { source, hasVariance: font.hasVariance };
  } catch {
    return null;
  }
};

/**
 * Фон страницы из переданной фотографии. Страница равна кадру листа, поэтому
 * фотография ложится на неё целиком.
 *
 * @param request — задание вместе с фотографией листа
 * @param createMirror — чем отражать фотографию
 * @returns фон страницы; `null` — фотографии нет
 */
const resolveBackground = (
  request: RenderPageRequest,
  createMirror: CreateMirrorSurface
): RenderBackground | null => {
  const { sheet, pageWidth, pageHeight } = request;

  if (!sheet) {
    return null;
  }

  const image: RenderImage = sheet.isMirrored
    ? mirrorRenderImage(sheet.image, sheet.width, sheet.height, createMirror)
    : sheet.image;

  return { image, width: pageWidth, height: pageHeight };
};

/**
 * Отрисовывает страницу по заданию и отдаёт её файлом.
 *
 * Здесь же подставляются ресурсы, которые не переживают границу воркера:
 * фотография листа приходит битмапом, карта текстуры читается по адресу,
 * контуры шрифта разбираются из файла. Всё остальное задание принесло с собой,
 * поэтому одно и то же задание рисуется одинаково при каждом прогоне — иных
 * источников случайности у отрисовки нет.
 *
 * @param request — задание на отрисовку страницы
 * @param surfaces — чем создавать поверхности; в тестах подставляется запись
 *   вызовов
 * @returns файл страницы
 */
export const renderPageRequest = async (
  request: RenderPageRequest,
  surfaces: PageRenderSurfaces = OFFSCREEN_SURFACES
): Promise<Blob> => {
  const { params, textureSrc, font, pageWidth, pageHeight, quality } = request;
  const [texture, glyphs] = await Promise.all([
    resolveTexture(textureSrc),
    resolveGlyphs(font),
  ]);
  const size = measurePageImage(pageWidth, pageHeight, params.scale);
  const surface = surfaces.createPage(size.width, size.height);
  const context = surface.getContext('2d');

  if (!context) {
    throw new Error('Внеэкранный canvas не дал контекст');
  }

  drawPage(
    context,
    {
      ...params,
      background: resolveBackground(request, surfaces.createMirror),
      ink: { ...params.ink, texture },
      glyphs,
    },
    size
  );

  return surface.convertToBlob({ type: PAGE_IMAGE_MIME, quality });
};
