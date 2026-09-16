import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { chromium } from 'playwright';

import type {
  PaperProfilesArtifact,
  PaperSheetProfile,
} from '../src/pages/Generator/config/config.types';
import {
  GRID_FAMILY_ID,
  LINED_FAMILY_ID,
} from '../src/pages/Generator/config/paperFamilies';
import type {
  PaperSheet,
  RulingKind,
  SheetImageData,
} from '../src/pages/Generator/lib/paper';
import {
  buildSheetRuling,
  measureSheetPhoto,
  toTexturePixels,
} from '../src/pages/Generator/lib/paper';

import { decodeSheetPhoto, describeSheetReport } from './sheet-photo-report';

/**
 * Скрипт сборки профилей пресет-пака: считает характеристики предустановленных
 * экземпляров заранее, чтобы приложение не разбирало фотографии в рантайме
 * (решение D7 в `openspec/changes/photo-paper-pipeline/design.md`).
 *
 * Запуск — `npm run build:paper`. Результат: `public/paper/profiles.json` и
 * карты текстуры рядом с фотографиями.
 */

/**
 * Корень проекта. Берётся из рабочего каталога, а не из пути файла: скрипт
 * запускается собранным в кэш сборки, и его собственный путь ничего не говорит
 * о расположении репозитория.
 */
const ROOT = process.cwd();

/**
 * Версия формата артефакта. Совпадает с `PAPER_PROFILES_VERSION` в модели:
 * при расхождении приложение отбрасывает артефакт и берёт листы с
 * синтезированной разлиновкой.
 */
const ARTIFACT_VERSION = 2;

/**
 * Семья пресет-пака: идентификатор и подпись экземпляров.
 */
type PaperFamilyPreset = {
  /**
   * Идентификатор семьи, он же имя каталога с фотографиями в `public/paper`.
   */
  id: string;

  /**
   * Подпись, от которой строятся подписи экземпляров.
   */
  label: string;

  /**
   * Вид разлиновки семьи.
   */
  kind: RulingKind;
};

/**
 * Результат разбора одного экземпляра: характеристики и пиксели карты
 * текстуры, которые ещё предстоит закодировать в png.
 */
type SheetProfileResult = {
  /**
   * Характеристики экземпляра в форме артефакта.
   */
  sheet: PaperSheetProfile;

  /**
   * Части строки отчёта: те же, что печатает замер одного листа.
   */
  report: string[];

  /**
   * Пиксели карты текстуры или `null`, если карта не строилась.
   */
  texturePixels: Uint8ClampedArray | null;
};

/**
 * Вход кодировщика карты текстуры: массив вместо типизированного, потому что
 * через мост во вкладку уходит обычный json.
 */
type TextureEncodeInput = {
  /**
   * Пиксели карты в формате RGBA.
   */
  data: number[];

  /**
   * Ширина карты в пикселях.
   */
  width: number;

  /**
   * Высота карты в пикселях.
   */
  height: number;
};

/**
 * Семьи пресет-пака. Фотографии лежат в `public/paper/<id>`.
 */
const FAMILIES: PaperFamilyPreset[] = [
  { id: GRID_FAMILY_ID, label: 'Клетка', kind: 'grid' },
  { id: LINED_FAMILY_ID, label: 'Линейка', kind: 'lined' },
];

/**
 * Собирает характеристики одного экземпляра вместе с его разлиновкой в
 * пикселях фотографии: ненайденные поля сборка разлиновки заменяет фолбэком.
 * Фотография при этом ни к какой общей мере не приводится.
 *
 * Лист, на котором не нашёлся сам шаг, валит сборку: ручного ввода в скрипте
 * нет, а пресет без разлиновки выпускать в пак нельзя.
 */
const buildSheetProfile = (
  photo: SheetImageData,
  path: string,
  sheet: Pick<PaperSheet, 'id' | 'label' | 'src'>,
  kind: RulingKind
): SheetProfileResult => {
  /**
   * Измерение тем же путём, что импорт своей фотографии: контур листа,
   * разлиновка внутри него, свет и текстура только по бумаге.
   */
  const startedAt = performance.now();
  const measurement = measureSheetPhoto(photo, { kind });
  const elapsedMs = performance.now() - startedAt;
  const { source, lighting, textureMap, diagnostics } = measurement;

  if (!diagnostics.isRulingDetected || source.step <= 0) {
    throw new Error(
      `Разлиновка не найдена: ${path} (уверенность ${diagnostics.confidence.toFixed(3)})`
    );
  }

  const ruling = buildSheetRuling(source, photo);

  return {
    sheet: {
      ...sheet,
      width: photo.width,
      height: photo.height,
      ruling,
      lighting,
      texture: {
        src: `${sheet.src.replace(/\.[^.]+$/, '')}.texture.png`,
        width: textureMap.width,
        height: textureMap.height,
        amplitude: textureMap.amplitude,
      },
    },
    report: describeSheetReport({ measurement, ruling, frame: photo, elapsedMs }),
    texturePixels: toTexturePixels(textureMap),
  };
};

/**
 * Пересчитывает профили всех семей пресет-пака и пишет артефакт.
 */
const main = async (): Promise<void> => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  /**
   * Кодирование карты текстуры в png идёт тоже в браузере: канвы в node нет, а
   * держать в артефакте `data:`-строку на мегабайт незачем — отдельный файл
   * браузер ещё и закэширует.
   */
  const encodeTexturePng = (pixels: Uint8ClampedArray, width: number, height: number) => {
    return page.evaluate(
      async (input: TextureEncodeInput) => {
        const canvas = document.createElement('canvas');

        canvas.width = input.width;
        canvas.height = input.height;

        const context = canvas.getContext('2d');

        if (!context) {
          throw new Error('Канва для карты текстуры недоступна');
        }

        context.putImageData(
          new ImageData(new Uint8ClampedArray(input.data), input.width, input.height),
          0,
          0
        );

        return canvas.toDataURL('image/png');
      },
      { data: [...pixels], width, height }
    );
  };

  const families: PaperProfilesArtifact['families'] = {};

  try {
    for (const family of FAMILIES) {
      const directory = join(ROOT, 'public', 'paper', family.id);
      const sheets: PaperSheetProfile[] = [];

      for (const file of readdirSync(directory).sort()) {
        if (!file.endsWith('.jpg')) {
          continue;
        }

        const index = sheets.length + 1;
        const path = join(directory, file);
        const photo = await decodeSheetPhoto(page, path);
        const result = buildSheetProfile(
          photo,
          path,
          {
            id: `${family.id}-${index}`,
            label: `${family.label} ${index}`,
            src: `/paper/${family.id}/${file}`,
          },
          family.kind
        );
        const { sheet, report, texturePixels } = result;

        if (texturePixels && sheet.texture) {
          const dataUrl = await encodeTexturePng(
            texturePixels,
            sheet.texture.width,
            sheet.texture.height
          );

          writeFileSync(
            join(ROOT, 'public', sheet.texture.src),
            Buffer.from(dataUrl.split(',')[1] || '', 'base64')
          );
        }

        sheets.push(sheet);
        console.error(`${family.id}/${file}: ${report.join(', ')}`);
      }

      families[family.id] = sheets;
    }
  } finally {
    await browser.close();
  }

  const artifact: PaperProfilesArtifact = { version: ARTIFACT_VERSION, families };
  const outputPath = join(ROOT, 'public', 'paper', 'profiles.json');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(artifact)}\n`);
  console.error(`Профили записаны: ${outputPath}; * — поле взято фолбэком`);
};

await main();
