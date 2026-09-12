import type { PaperSheetProfiles } from '../config/config.types';
import { buildPaperFamilies } from '../config/paperFamilies';
import type { PaperFamily, PaperSheet } from '../lib/paper/paper.types';

import { isJsonRecord, parsePaperSheet, toFiniteNumber } from './paperSheetJson';

/**
 * Адрес артефакта характеристик пресет-пака. Считается скриптом сборки и
 * лежит рядом с фотографиями, поэтому при запуске ничего не измеряется.
 */
export const PAPER_PROFILES_URL = '/paper/profiles.json';

/**
 * Версия формата артефакта, которую понимает этот код. Артефакт другой версии
 * отбрасывается целиком: разбирать наполовину знакомый формат опаснее, чем
 * открыться на листах с синтезированной разлиновкой.
 */
export const PAPER_PROFILES_VERSION = 2;

/**
 * Разбирает артефакт характеристик. Всё, что не разобралось — чужая версия,
 * не тот корень, экземпляр без фотографии, — молча отбрасывается: пресеты
 * должны открываться в любом случае, пусть и без измерений.
 *
 * @param value — разобранный JSON артефакта
 * @returns характеристики экземпляров по идентификатору семьи
 */
export const parsePaperProfiles = (value: unknown): PaperSheetProfiles => {
  if (
    !isJsonRecord(value) ||
    toFiniteNumber(value.version, 0) !== PAPER_PROFILES_VERSION
  ) {
    return {};
  }

  const { families } = value;

  if (!isJsonRecord(families)) {
    return {};
  }

  return Object.entries(families).reduce<PaperSheetProfiles>(
    (acc, [familyId, rawSheets]) => {
      if (!Array.isArray(rawSheets)) {
        return acc;
      }

      const items: unknown[] = rawSheets;
      const sheets = items.reduce<PaperSheet[]>((sheetAcc, item) => {
        const sheet = parsePaperSheet(item);

        if (sheet) {
          sheetAcc.push(sheet);
        }

        return sheetAcc;
      }, []);

      if (sheets.length > 0) {
        acc[familyId] = sheets;
      }

      return acc;
    },
    {}
  );
};

/**
 * Загружает предустановленные семьи с посчитанными характеристиками
 * экземпляров. Артефакта нет или он нечитаем — возвращаются те же семьи с
 * канонами из констант и экземплярами без измерений: генератор открывается в
 * любом случае.
 *
 * @param url — адрес артефакта; параметр существует ради тестов
 * @returns предустановленные семьи листов
 */
export const loadPaperFamilies = async (
  url: string = PAPER_PROFILES_URL
): Promise<PaperFamily[]> => {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      return buildPaperFamilies({});
    }

    return buildPaperFamilies(parsePaperProfiles(await response.json()));
  } catch {
    return buildPaperFamilies({});
  }
};
