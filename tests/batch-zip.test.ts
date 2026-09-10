import {
  buildPageFileName,
  createZipPacker,
  generatePageBatch,
} from '@pages/Generator/lib/batch';
import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';

const PAGE_MIME_TYPE = 'image/jpeg';

/**
 * Страница-заглушка: содержимое — её собственный индекс, по нему в архиве
 * видно, что файл попал под своим именем.
 */
const buildPage = (pageIndex: number, mimeType = PAGE_MIME_TYPE): Blob => {
  return new Blob([`page-${pageIndex}`], { type: mimeType });
};

/**
 * Имена файлов архива в том порядке, в каком их вернул jszip.
 */
const readArchiveNames = async (archive: Blob): Promise<string[]> => {
  const zip = await JSZip.loadAsync(await archive.arrayBuffer());

  return Object.keys(zip.files);
};

/**
 * Пакует подряд идущие страницы zip-упаковщиком и отдаёт готовый архив.
 */
const packPages = async (
  totalPages: number,
  mimeType = PAGE_MIME_TYPE
): Promise<Blob> => {
  const packer = createZipPacker({ totalPages });

  for (let pageIndex = 0; pageIndex < totalPages; pageIndex += 1) {
    await packer.addPage(pageIndex, buildPage(pageIndex, mimeType));
  }

  return packer.build();
};

/**
 * Пакует только названные страницы длинной пачки: имена зависят от её общего
 * размера, а класть тысячу файлов ради проверки имени незачем.
 */
const packSparsePages = async (
  totalPages: number,
  pageIndexes: number[]
): Promise<Blob> => {
  const packer = createZipPacker({ totalPages });

  for (const pageIndex of pageIndexes) {
    await packer.addPage(pageIndex, buildPage(pageIndex));
  }

  return packer.build();
};

describe('buildPageFileName', () => {
  it('дополняет номер ведущими нулями до трёх знаков', () => {
    expect(
      buildPageFileName({ pageNumber: 7, totalPages: 12, mimeType: PAGE_MIME_TYPE })
    ).toBe('page-007.jpg');
  });

  it('расширяет номер под длинную пачку', () => {
    expect(
      buildPageFileName({ pageNumber: 7, totalPages: 1200, mimeType: PAGE_MIME_TYPE })
    ).toBe('page-0007.jpg');
  });

  it('берёт расширение из типа страницы', () => {
    expect(
      buildPageFileName({ pageNumber: 1, totalPages: 3, mimeType: 'image/png' })
    ).toBe('page-001.png');
    expect(
      buildPageFileName({ pageNumber: 1, totalPages: 3, mimeType: 'image/webp' })
    ).toBe('page-001.webp');
  });

  it('разбирает тип с регистром и параметрами', () => {
    expect(
      buildPageFileName({ pageNumber: 1, totalPages: 3, mimeType: 'IMAGE/PNG' })
    ).toBe('page-001.png');
    expect(
      buildPageFileName({
        pageNumber: 1,
        totalPages: 3,
        mimeType: ' image/jpeg;charset=binary',
      })
    ).toBe('page-001.jpg');
  });

  it('даёт открываемое расширение странице без типа', () => {
    expect(buildPageFileName({ pageNumber: 1, totalPages: 3, mimeType: '' })).toBe(
      'page-001.jpg'
    );
  });
});

describe('createZipPacker', () => {
  it('кладёт по файлу на страницу', async () => {
    const names = await readArchiveNames(await packPages(12));

    expect(names).toHaveLength(12);
  });

  it('даёт именам лексикографический порядок, совпадающий с порядком страниц', async () => {
    const names = await readArchiveNames(await packPages(12));
    const expectedNames = Array.from({ length: 12 }, (_value, pageIndex) => {
      return `page-${String(pageIndex + 1).padStart(3, '0')}.jpg`;
    });

    expect(names).toEqual(expectedNames);
    expect([...names].sort()).toEqual(expectedNames);
  });

  it('держит порядок имён на границе трёх и четырёх знаков', async () => {
    const shortNames = await readArchiveNames(
      await packSparsePages(999, [0, 8, 97, 998])
    );
    const longNames = await readArchiveNames(
      await packSparsePages(1000, [0, 8, 97, 998, 999])
    );

    expect(shortNames).toEqual([
      'page-001.jpg',
      'page-009.jpg',
      'page-098.jpg',
      'page-999.jpg',
    ]);
    expect(longNames).toEqual([
      'page-0001.jpg',
      'page-0009.jpg',
      'page-0098.jpg',
      'page-0999.jpg',
      'page-1000.jpg',
    ]);
    expect([...longNames].sort()).toEqual(longNames);
  });

  it('сохраняет содержимое страницы под её именем', async () => {
    const zip = await JSZip.loadAsync(await (await packPages(12)).arrayBuffer());

    expect(await zip.file('page-003.jpg')?.async('string')).toBe('page-2');
  });

  it('складывает страницы без типа под открываемым расширением', async () => {
    const names = await readArchiveNames(await packPages(3, ''));

    expect(names).toEqual(['page-001.jpg', 'page-002.jpg', 'page-003.jpg']);
  });

  it('отдаёт архив zip', async () => {
    const archive = await packPages(3);

    expect(archive.type).toBe('application/zip');
    expect(archive.size).toBeGreaterThan(0);
  });
});

describe('generatePageBatch с zip-упаковщиком по умолчанию', () => {
  it('собирает архив со всеми страницами пачки', async () => {
    const { archive, failedPageNumbers } = await generatePageBatch({
      pageCount: 12,
      renderPage: async (pageIndex: number): Promise<Blob> => {
        return buildPage(pageIndex);
      },
    });

    expect(failedPageNumbers).toEqual([]);
    expect(archive).not.toBeNull();
    expect(archive && (await readArchiveNames(archive))).toHaveLength(12);
  });

  it('оставляет в архиве остальные страницы, когда одна не отрисовалась', async () => {
    const { archive, failedPageIndexes, failedPageNumbers } = await generatePageBatch({
      pageCount: 12,
      renderPage: async (pageIndex: number): Promise<Blob> => {
        if (pageIndex === 5) {
          throw new Error('страница не отрисовалась');
        }

        return buildPage(pageIndex);
      },
    });
    const names = archive ? await readArchiveNames(archive) : [];

    expect(failedPageIndexes).toEqual([5]);
    expect(failedPageNumbers).toEqual([6]);
    expect(names).toHaveLength(11);
    expect(names).not.toContain('page-006.jpg');
    expect(names).toContain('page-007.jpg');
  });
});
