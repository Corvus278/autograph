import { resolve } from 'node:path';

import { chromium } from 'playwright';

import type { RulingKind } from '../src/pages/Generator/lib/paper';
import { buildSheetRuling, measureSheetPhoto } from '../src/pages/Generator/lib/paper';

import { decodeSheetPhoto, describeSheetReport } from './sheet-photo-report';

/**
 * Скрипт замера одного листа: тот же декодер и то же измерение, что у сборки
 * профилей, но без записи артефакта. По нему принимается разбор фотографии,
 * которой нет в пресет-паке.
 *
 * Запуск — `npm run measure:sheet -- <путь> [grid|lined|blank]`.
 */

/**
 * Виды, которые принимает второй аргумент.
 */
const RULING_KINDS: RulingKind[] = ['grid', 'lined', 'blank'];

/**
 * Вид по умолчанию. Клетка или линейка в измерении не различаются — вид
 * разлиновки определяется по снимку, — а чистый лист отключает поиск
 * разлиновки, поэтому его нужно просить явно.
 */
const DEFAULT_KIND: RulingKind = 'grid';

/**
 * Аргументы командной строки.
 */
type MeasureArguments = {
  /**
   * Абсолютный путь к фотографии.
   */
  path: string;

  /**
   * Вид семьи, под который меряется лист.
   */
  kind: RulingKind;
};

/**
 * Разбирает аргументы командной строки: путь к фотографии и вид семьи.
 */
const parseArguments = (): MeasureArguments => {
  const [path, kindArgument] = process.argv.slice(2);

  if (!path) {
    throw new Error('Укажите путь: npm run measure:sheet -- <путь> [grid|lined|blank]');
  }

  const kind = RULING_KINDS.find((candidate) => {
    return candidate === kindArgument;
  });

  if (kindArgument && !kind) {
    throw new Error(`Неизвестный вид «${kindArgument}», ожидается grid, lined или blank`);
  }

  return { path: resolve(path), kind: kind || DEFAULT_KIND };
};

/**
 * Измеряет фотографию и печатает отчёт по строке на характеристику. Печать
 * идёт в stderr, как у сборки профилей.
 */
const main = async (): Promise<void> => {
  const { path, kind } = parseArguments();
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage();
    const photo = await decodeSheetPhoto(page, path);
    const startedAt = performance.now();
    const measurement = measureSheetPhoto(photo, { kind });
    const elapsedMs = performance.now() - startedAt;
    const ruling = buildSheetRuling(measurement.source, photo);
    const report = describeSheetReport({ measurement, ruling, frame: photo, elapsedMs });

    console.error(`${path}: ${photo.width}×${photo.height} px, * — поле взято фолбэком`);

    for (const line of report) {
      console.error(`  ${line}`);
    }
  } finally {
    await browser.close();
  }
};

await main();
