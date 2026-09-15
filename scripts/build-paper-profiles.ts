import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
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
  PaperMargins,
  PaperSheet,
  SheetImageData,
  SheetRuling,
} from '../src/pages/Generator/lib/paper';
import {
  buildSheetRuling,
  detectRuling,
  extractLighting,
  extractTexture,
  measureBendDeviation,
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
   * Характеристики экземпляра в форме артефакта.
   */
  sheet: PaperSheetProfile;

  /**
   * Стороны, поля с которых детектор не нашёл и которые взяты фолбэком.
   */
  fallbackSides: (keyof PaperMargins)[];

  /**
   * Доля узлов области с линиями, где при измерении изгиба линия нашлась: по
   * ней сверяются пороги надёжности изгиба.
   */
  bendFoundNodeShare: number;

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
  { id: GRID_FAMILY_ID, label: 'Клетка' },
  { id: LINED_FAMILY_ID, label: 'Линейка' },
];

/**
 * Стороны полей в порядке печати: сверху по часовой стрелке.
 */
const MARGIN_SIDES: (keyof PaperMargins)[] = ['top', 'right', 'bottom', 'left'];

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
 * Собирает характеристики одного экземпляра вместе с его разлиновкой в
 * пикселях фотографии: ненайденные поля сборка разлиновки заменяет фолбэком.
 * Фотография при этом ни к какой общей мере не приводится.
 *
 * Лист, на котором не нашёлся сам шаг, валит сборку: ручного ввода в скрипте
 * нет, а пресет без разлиновки выпускать в пак нельзя.
 */
const buildSheetProfile = (
  photo: DecodedPhoto,
  path: string,
  sheet: Pick<PaperSheet, 'id' | 'label' | 'src'>
): SheetProfileResult => {
  /**
   * Наклон ищет сам детектор, как и при импорте своей фотографии: найденный
   * свипом угол он поправляет по изгибу линий, и угол берётся из детекции.
   */
  const detection = detectRuling(photo);
  const { skewAngle } = detection;

  if (!detection.isDetected || detection.step <= 0) {
    throw new Error(
      `Разлиновка не найдена: ${path} (уверенность ${detection.confidence.toFixed(3)})`
    );
  }

  const lighting = extractLighting(photo);
  const textureMap = extractTexture(photo, lighting);

  return {
    sheet: {
      ...sheet,
      width: photo.width,
      height: photo.height,
      ruling: buildSheetRuling({ ...detection, skewAngle }),
      lighting,
      texture: {
        src: `${sheet.src.replace(/\.[^.]+$/, '')}.texture.png`,
        width: textureMap.width,
        height: textureMap.height,
        amplitude: textureMap.amplitude,
      },
    },
    fallbackSides: MARGIN_SIDES.filter((side) => {
      return !detection.margins[side];
    }),
    bendFoundNodeShare: detection.bendFoundNodeShare,
    texturePixels: toTexturePixels(textureMap),
  };
};

/**
 * Изгиб экземпляра для отчёта: наибольший отход линии от прямой гребёнки в
 * долях шага и доля найденных узлов — по ним видно, насколько лист изогнут и
 * почему изгиб отброшен. Отход — тот же, по которому проверка надёжности решает
 * сохранить изгиб, с краями области за крайними узлами: наибольшее смещение
 * узла на дуге под наклоном ниже порога, хотя изгиб сохранён.
 */
const describeBend = (ruling: SheetRuling, foundNodeShare: number): string => {
  const { bend, step } = ruling;
  const nodesText = `узлов найдено ${Math.round(foundNodeShare * 100)} %`;

  if (!bend) {
    return `изгиба нет (${nodesText})`;
  }

  const deviation = measureBendDeviation(bend.offsets, bend.columnCount);

  return `изгиб до ${(deviation / step).toFixed(3)} шага (${nodesText})`;
};

/**
 * Строка отчёта по экземпляру: всё, что попадает в артефакт из разлиновки, —
 * чтобы сверить её с фотографией, не открывая json.
 */
const describeProfile = (name: string, result: SheetProfileResult): string => {
  const { sheet, fallbackSides } = result;
  const { step, firstLinePhase, skewAngle, margins, marginLineX, marginLineSide } =
    sheet.ruling;
  const marginsText = MARGIN_SIDES.map((side) => {
    return `${margins[side].toFixed(1)}${fallbackSides.includes(side) ? '*' : ''}`;
  }).join('/');
  const marginLineText =
    marginLineX === null ? 'нет' : `${marginLineX.toFixed(1)} px, ${marginLineSide}`;

  return [
    `${name}: шаг ${step.toFixed(2)} px`,
    `фаза ${firstLinePhase.toFixed(1)} px`,
    `угол ${skewAngle.toFixed(2)}°`,
    `поля сверху/справа/снизу/слева ${marginsText}`,
    `линия поля ${marginLineText}`,
    describeBend(sheet.ruling, result.bendFoundNodeShare),
    `свет ${sheet.lighting?.isUsable ? 'пригоден' : 'непригоден'}`,
  ].join(', ');
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
        const photo = await decodePhoto(decodeInPage, path);
        const result = buildSheetProfile(photo, path, {
          id: `${family.id}-${index}`,
          label: `${family.label} ${index}`,
          src: `/paper/${family.id}/${file}`,
        });
        const { sheet, texturePixels } = result;

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
        console.error(describeProfile(`${family.id}/${file}`, result));
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
