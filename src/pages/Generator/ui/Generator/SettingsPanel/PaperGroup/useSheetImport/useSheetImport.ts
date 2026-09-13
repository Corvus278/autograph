import { readFileAsDataUrl } from '@shared/lib/files';
import { useState } from 'react';

import type {
  LightingField,
  PaperTexture,
  SheetImageData,
} from '../../../../../lib/paper';
import {
  buildSheetRuling,
  detectRuling,
  detectSkewAngle,
  encodeTextureMap,
  extractLighting,
  extractTexture,
} from '../../../../../lib/paper';
import { useGeneratorStore } from '../../../../../model/useGeneratorStore';

import { decodeSheetImage } from './decodeSheetImage';
import type {
  SheetImport,
  SheetImportOptions,
  SheetMeasurement,
} from './useSheetImport.types';

/**
 * Разлиновка, которой нет: нулевой шаг помечает экземпляр как ждущий ручного
 * ввода — по нему панель и понимает, что автоопределение не дало результата.
 */
const MISSING_RULING = { step: 0, firstLinePhase: 0 };

/**
 * Счётчик добавленных за сессию листов. Нужен вместе со временем: два файла,
 * выбранные в одном диалоге, приходят в одну миллисекунду.
 */
let sheetCounter = 0;

/**
 * Идентификатор нового экземпляра. Пользовательские листы живут в локальном
 * хранилище, поэтому идентификатор обязан пережить перезагрузку и не совпасть
 * с предустановленным.
 *
 * @returns идентификатор экземпляра
 */
const nextSheetId = (): string => {
  sheetCounter += 1;

  return `user-${Date.now().toString(36)}-${sheetCounter}`;
};

/**
 * Подпись экземпляра в списке — имя файла без расширения.
 *
 * @param fileName — имя выбранного файла
 * @returns подпись экземпляра
 */
const toSheetLabel = (fileName: string): string => {
  return fileName.replace(/\.[^.]+$/, '') || 'Свой лист';
};

/**
 * Измеряет фотографию: сначала наклон, потом по нему — разлиновку.
 *
 * @param image — полутоновая выжимка фотографии
 * @returns измерения; разлиновка `null`, если её не нашли
 */
const measureSheet = (image: SheetImageData): SheetMeasurement => {
  const skewAngle = detectSkewAngle(image);
  const detection = detectRuling(image, { skewAngle });

  return { skewAngle, detection: detection.isDetected ? detection : null };
};

/**
 * Кодирует карту текстуры. Кодирование идёт через канву, и там, где её нет,
 * лист остаётся без текстуры: она украшает чернила, но не влияет на раскладку.
 *
 * @param image — полутоновая выжимка фотографии
 * @param lighting — поле освещения того же листа
 * @returns карта текстуры; `null` — закодировать не удалось
 */
const encodeTexture = async (
  image: SheetImageData,
  lighting: LightingField
): Promise<PaperTexture | null> => {
  try {
    return await encodeTextureMap(extractTexture(image, lighting));
  } catch {
    return null;
  }
};

/**
 * Добавление своей фотографии листа: чтение файла, измерения и запись
 * экземпляра в выбранную семью.
 *
 * @returns метод добавления вместе с состоянием разбора
 */
export const useSheetImport = (): SheetImport => {
  const addUserSheet = useGeneratorStore((state) => {
    return state.addUserSheet;
  });
  const [isBusy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (file: File, options: SheetImportOptions) => {
    const { family, isBlank } = options;

    setBusy(true);
    setError(null);

    try {
      const src = await readFileAsDataUrl(file);
      const image = await decodeSheetImage(src);
      const measurement = image && !isBlank ? measureSheet(image) : null;
      const lighting = image ? extractLighting(image) : null;
      const texture = image && lighting ? await encodeTexture(image, lighting) : null;
      /**
       * В разлиновку идёт всё найденное — и поля, и линия поля со стороной:
       * по ним выкладывается блок текста, а не по общему для семьи отступу.
       */
      const ruling = buildSheetRuling({
        ...(measurement?.detection || MISSING_RULING),
        skewAngle: measurement?.skewAngle || 0,
      });
      /**
       * Кадр неразобранной фотографии неизвестен, а сама она не отбрасывается:
       * берётся кадр первого листа семьи. Без него страница такого листа
       * вышла бы нулевого размера, а разлиновку к нему всё равно задают руками.
       */
      const frame = image || family.sheets[0];

      addUserSheet({
        familyId: family.id,
        sheet: {
          id: nextSheetId(),
          label: toSheetLabel(file.name),
          src,
          width: frame?.width || 0,
          height: frame?.height || 0,
          ruling,
          lighting,
          texture,
        },
        /**
         * Разбор считается пройденным даже тогда, когда разлиновка не нашлась:
         * повторный прогон по той же фотографии дал бы тот же результат, а
         * заданное руками затёр бы.
         */
        isAnalyzed: true,
      });
    } catch {
      setError('Не удалось прочитать фотографию');
    } finally {
      setBusy(false);
    }
  };

  return { add, isBusy, error };
};
