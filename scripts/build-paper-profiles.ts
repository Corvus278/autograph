import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { chromium } from 'playwright';

import type {
  PaperProfilesArtifact,
  PaperSheetProfiles,
} from '../src/pages/Generator/config/config.types';
import {
  GRID_FAMILY_ID,
  GRID_RULING,
  LINED_FAMILY_ID,
  LINED_RULING,
} from '../src/pages/Generator/config/paperFamilies';
import type {
  PaperRuling,
  PaperSheet,
  SheetImageData,
} from '../src/pages/Generator/lib/paper';
import {
  computeNormalizeScale,
  detectRuling,
  detectSkewAngle,
  extractLighting,
  extractTexture,
  toTexturePixels,
} from '../src/pages/Generator/lib/paper';

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
 * при расхождении приложение отбрасывает артефакт и берёт пресеты из констант.
 */
const ARTIFACT_VERSION = 1;

/**
 * Семья пресет-пака: идентификатор, канон разлиновки и подпись экземпляров.
 */
type PaperFamilyPreset = {
  /**
   * Идентификатор семьи, он же имя каталога с фотографиями в `public/paper`.
   */
  id: string;

  /**
   * Канон разлиновки семьи, к которому нормируются экземпляры.
   */
  ruling: PaperRuling;

  /**
   * Подпись, от которой строятся подписи экземпляров.
   */
  label: string;
};

/**
 * Полутоновая выжимка, полученная из вкладки: яркости упакованы в base64,
 * иначе перегон миллионов чисел через мост занимает больше самого анализа.
 */
type DecodedGray = {
  /**
   * Ширина фотографии в пикселях.
   */
  width: number;

  /**
   * Высота фотографии в пикселях.
   */
  height: number;

  /**
   * Яркости пикселей, по байту на пиксель, в base64.
   */
  gray: string;
};

/**
 * Результат разбора одного экземпляра: характеристики и пиксели карты
 * текстуры, которые ещё предстоит закодировать в png.
 */
type SheetProfileResult = {
  /**
   * Характеристики экземпляра.
   */
  sheet: PaperSheet;

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
  { id: GRID_FAMILY_ID, ruling: GRID_RULING, label: 'Клетка' },
  { id: LINED_FAMILY_ID, ruling: LINED_RULING, label: 'Линейка' },
];

/**
 * Полутоновая выжимка фотографии, снятая в браузере: декодировать jpeg в node
 * нечем, а Chromium уже стоит для скриншотных тестов.
 */
type DecodedPhoto = SheetImageData;

/**
 * Снимает полутоновую выжимку с фотографии: декодирование идёт в браузере,
 * дальше работает уже чистый анализ.
 */
const decodePhoto = async (
  evaluate: (data: string) => Promise<DecodedGray>,
  path: string
): Promise<DecodedPhoto> => {
  const base64 = readFileSync(path).toString('base64');
  const decoded = await evaluate(base64);
  const bytes = Buffer.from(decoded.gray, 'base64');
  const luminance = new Float32Array(bytes.length);

  for (let index = 0; index < bytes.length; index += 1) {
    luminance[index] = (bytes[index] || 0) / 255;
  }

  return { width: decoded.width, height: decoded.height, luminance };
};

/**
 * Собирает характеристики одного экземпляра. Разлиновку не сохраняет: она
 * принадлежит семье, экземпляр приводится к её шагу коэффициентом нормировки.
 */
const buildSheetProfile = (
  photo: DecodedPhoto,
  ruling: PaperRuling,
  sheet: Pick<PaperSheet, 'id' | 'label' | 'src'>
): SheetProfileResult => {
  const skewAngle = detectSkewAngle(photo);
  const detection = detectRuling(photo, { skewAngle });
  const lighting = extractLighting(photo);
  const textureMap = extractTexture(photo, lighting);

  return {
    sheet: {
      ...sheet,
      width: photo.width,
      height: photo.height,
      skewAngle,
      measuredStep: detection.step,
      normalizeScale: computeNormalizeScale(detection.step, ruling.step),
      firstLinePhase: detection.firstLinePhase,
      lighting,
      texture: {
        src: `${sheet.src.replace(/\.[^.]+$/, '')}.texture.png`,
        width: textureMap.width,
        height: textureMap.height,
        amplitude: textureMap.amplitude,
      },
    },
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
   * Декодирует jpeg в открытой вкладке и отдаёт яркости по Rec.709 в base64.
   */
  const decodeInPage = (data: string) => {
    return page.evaluate(async (jpegBase64: string) => {
      const image = new Image();

      image.src = `data:image/jpeg;base64,${jpegBase64}`;
      await image.decode();

      const canvas = document.createElement('canvas');

      canvas.width = image.width;
      canvas.height = image.height;

      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('Канва для декодирования фотографии недоступна');
      }

      context.drawImage(image, 0, 0);

      const frame = context.getImageData(0, 0, canvas.width, canvas.height);
      const gray = new Uint8Array(canvas.width * canvas.height);

      for (let index = 0; index < gray.length; index += 1) {
        gray[index] = Math.round(
          0.2126 * (frame.data[index * 4] || 0) +
            0.7152 * (frame.data[index * 4 + 1] || 0) +
            0.0722 * (frame.data[index * 4 + 2] || 0)
        );
      }

      let binary = '';
      const chunkSize = 0x80_00;

      for (let index = 0; index < gray.length; index += chunkSize) {
        binary += String.fromCharCode(...gray.subarray(index, index + chunkSize));
      }

      return { width: canvas.width, height: canvas.height, gray: btoa(binary) };
    }, data);
  };

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

  const families: PaperSheetProfiles = {};

  for (const family of FAMILIES) {
    const directory = join(ROOT, 'public', 'paper', family.id);
    const sheets: PaperSheet[] = [];

    for (const file of readdirSync(directory).sort()) {
      if (!file.endsWith('.jpg')) {
        continue;
      }

      const index = sheets.length + 1;
      const photo = await decodePhoto(decodeInPage, join(directory, file));
      const { sheet, texturePixels } = buildSheetProfile(photo, family.ruling, {
        id: `${family.id}-${index}`,
        label: `${family.label} ${index}`,
        src: `/paper/${family.id}/${file}`,
      });

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
      console.error(
        `${family.id}/${file}: угол ${sheet.skewAngle.toFixed(2)}°, нормировка ${sheet.normalizeScale.toFixed(3)}, свет ${
          sheet.lighting?.isUsable ? 'пригоден' : 'непригоден'
        }`
      );
    }

    families[family.id] = sheets;
  }

  await browser.close();

  const artifact: PaperProfilesArtifact = { version: ARTIFACT_VERSION, families };
  const outputPath = join(ROOT, 'public', 'paper', 'profiles.json');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(artifact)}\n`);
  console.error(`Профили записаны: ${outputPath}`);
};

await main();
