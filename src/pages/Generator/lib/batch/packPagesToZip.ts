import JSZip from 'jszip';

import type { BatchPacker, PageFileNameParams, ZipPackerParams } from './batch.types';

/**
 * Минимальная ширина номера в имени файла. Три знака хватает обычной пачке, а
 * пачке длиннее ширина берётся по её собственному числу страниц.
 */
const MIN_NUMBER_WIDTH = 3;

/**
 * Расширение, когда тип страницы не разобран. Пачка кодируется в JPEG, поэтому
 * пустой или незнакомый тип — скорее потерянный заголовок, чем другой формат:
 * `jpg` открывается, `bin` не открывается ничем.
 */
const FALLBACK_EXTENSION = 'jpg';

const ARCHIVE_MIME_TYPE = 'application/zip';

/**
 * Расширение файла по типу блоба страницы. Тип приводится к каноническому
 * виду: он приходит из чужих рук и может нести регистр и параметры
 * (`IMAGE/PNG`, `image/jpeg;charset=binary`).
 */
const pickPageExtension = (mimeType: string): string => {
  const [baseType] = mimeType.split(';');

  switch (baseType?.trim().toLowerCase()) {
    case 'image/jpeg': {
      return 'jpg';
    }

    case 'image/png': {
      return 'png';
    }

    case 'image/webp': {
      return 'webp';
    }

    default: {
      return FALLBACK_EXTENSION;
    }
  }
};

/**
 * Имя файла страницы в архиве. Номер дополняется ведущими нулями до ширины
 * самого длинного номера пачки: без этого распаковщик и файловый менеджер
 * поставили бы `page-10` перед `page-2`.
 */
export const buildPageFileName = ({
  pageNumber,
  totalPages,
  mimeType,
}: PageFileNameParams): string => {
  const numberWidth = Math.max(String(totalPages).length, MIN_NUMBER_WIDTH);
  const paddedNumber = String(pageNumber).padStart(numberWidth, '0');

  return `page-${paddedNumber}.${pickPageExtension(mimeType)}`;
};

/**
 * Упаковщик пачки в zip. Страница кладётся в архив как есть, без промежуточной
 * копии её содержимого, и архив отдаётся сразу блобом: лишних копий пачки в
 * памяти не появляется.
 *
 * Библиотека архива приходит обычным импортом, а не динамическим: приложение
 * скачивается целиком при первом визите и после него работает без сети, так
 * что откладывать было бы нечего — чанк всё равно уехал бы в precache.
 */
export const createZipPacker = ({ totalPages }: ZipPackerParams): BatchPacker => {
  const zip = new JSZip();

  return {
    addPage: async (pageIndex, page) => {
      zip.file(
        buildPageFileName({
          pageNumber: pageIndex + 1,
          totalPages,
          mimeType: page.type,
        }),
        page
      );
    },

    build: () => {
      /**
       * Страницы — уже сжатые изображения, второй раз жать их незачем: `STORE`
       * экономит время сборки, а размер архива не меняет.
       */
      return zip.generateAsync({
        type: 'blob',
        mimeType: ARCHIVE_MIME_TYPE,
        compression: 'STORE',
      });
    },
  };
};
