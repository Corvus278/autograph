import { isJsonRecord, parsePaperSheet, toText } from './paperSheetJson';
import type { UserSheetIndexEntry, UserSheetRecord } from './userSheetsStorage.types';

/**
 * Ключ списка пользовательских листов: лёгкие характеристики всех листов
 * сразу.
 */
const INDEX_KEY = 'handwriting.paper.user-sheets';

/**
 * Префикс ключа исходного файла. Исходник лежит отдельной записью на лист и
 * отдельно от производных: файл невосстановим, а всё, что из него посчитано,
 * пересчитывается заново. Хранилище кончится — выбрасываются производные, а
 * не фотографии.
 */
const SOURCE_KEY_PREFIX = 'handwriting.paper.source.';

/**
 * Префикс ключа производных карт: поля освещения и текстуры. Самая тяжёлая и
 * при этом единственная пересчитываемая часть.
 */
const DERIVED_KEY_PREFIX = 'handwriting.paper.derived.';

/**
 * Локальное хранилище или `null`, если его нет: в тестовом окружении без jsdom
 * и в браузере с запрещёнными данными сайта обращение к нему бросает.
 *
 * @returns хранилище или `null`
 */
const getStorage = (): Storage | null => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

/**
 * Читает и разбирает значение ключа.
 *
 * @param storage — локальное хранилище
 * @param key — ключ записи
 * @returns разобранное значение; `null` — записи нет или она нечитаема
 */
const readJson = (storage: Storage, key: string): unknown => {
  const raw = storage.getItem(key);

  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

/**
 * Пишет значение в ключ, переживая переполнение хранилища.
 *
 * @param storage — локальное хранилище
 * @param key — ключ записи
 * @param value — что записать
 * @returns удалось ли записать
 */
const writeItem = (storage: Storage, key: string, value: string): boolean => {
  try {
    storage.setItem(key, value);

    return true;
  } catch {
    return false;
  }
};

/**
 * Разбирает список лёгких характеристик.
 *
 * @param storage — локальное хранилище
 * @returns записи списка по порядку добавления
 */
const readIndex = (storage: Storage): Record<string, unknown>[] => {
  const parsed = readJson(storage, INDEX_KEY);

  if (!Array.isArray(parsed)) {
    return [];
  }

  const items: unknown[] = parsed;

  return items.reduce<Record<string, unknown>[]>((acc, item) => {
    if (isJsonRecord(item) && toText(item.id)) {
      acc.push(item);
    }

    return acc;
  }, []);
};

/**
 * Собирает лёгкую часть записи для списка.
 *
 * @param record — пользовательский лист
 * @returns запись списка
 */
const toIndexEntry = ({
  familyId,
  sheet,
  isAnalyzed,
  isBlank,
}: UserSheetRecord): UserSheetIndexEntry => {
  const { id, label, width, height, ruling } = sheet;

  return { familyId, isAnalyzed, isBlank, id, label, width, height, ruling };
};

/**
 * Собирает лист обратно из трёх частей хранилища.
 *
 * @param storage — локальное хранилище
 * @param entry — запись списка
 * @returns пользовательский лист; `null` — исходный файл потерян
 */
const readRecord = (
  storage: Storage,
  entry: Record<string, unknown>
): UserSheetRecord | null => {
  const id = toText(entry.id);
  const src = storage.getItem(`${SOURCE_KEY_PREFIX}${id}`) || '';
  const derived = readJson(storage, `${DERIVED_KEY_PREFIX}${id}`);
  const maps = isJsonRecord(derived) ? derived : {};
  const sheet = parsePaperSheet({
    ...entry,
    src,
    lighting: maps.lighting,
    texture: maps.texture,
  });

  if (!sheet) {
    return null;
  }

  return {
    familyId: toText(entry.familyId),
    sheet,
    isAnalyzed: entry.isAnalyzed === true,
    /**
     * Запись без вида листа читается листом с разлиновкой семьи, а не
     * отбрасывается: у записи прежней формы поля нет, и это не порча.
     */
    isBlank: entry.isBlank === true,
  };
};

/**
 * Восстанавливает пользовательские листы из локального хранилища вместе с их
 * характеристиками: восстановленный лист приходит уже посчитанным, поэтому
 * анализ по нему не запускается.
 *
 * Лист, у которого потерялся исходный файл, отбрасывается: показывать нечего,
 * а характеристики без фотографии бесполезны.
 *
 * @returns листы по порядку добавления; пустой список — хранилища нет
 */
export const readUserSheets = (): UserSheetRecord[] => {
  const storage = getStorage();

  if (!storage) {
    return [];
  }

  return readIndex(storage).reduce<UserSheetRecord[]>((acc, entry) => {
    const record = readRecord(storage, entry);

    if (record) {
      acc.push(record);
    }

    return acc;
  }, []);
};

/**
 * Сохраняет лист: исходный файл, производные карты и лёгкие характеристики
 * идут раздельными записями. Лист с тем же идентификатором перезаписывается —
 * так пересчитанные характеристики заменяют прежние, не плодя записей.
 *
 * @param record — пользовательский лист
 * @returns удалось ли сохранить; `false` — хранилища нет или оно переполнено
 */
export const writeUserSheet = (record: UserSheetRecord): boolean => {
  const storage = getStorage();

  if (!storage) {
    return false;
  }

  const { sheet } = record;
  const entry = toIndexEntry(record);
  const rest = readIndex(storage).filter((item) => {
    return toText(item.id) !== sheet.id;
  });
  const isSourceSaved = writeItem(storage, `${SOURCE_KEY_PREFIX}${sheet.id}`, sheet.src);
  const isDerivedSaved = writeItem(
    storage,
    `${DERIVED_KEY_PREFIX}${sheet.id}`,
    JSON.stringify({ lighting: sheet.lighting, texture: sheet.texture })
  );
  const isIndexSaved = writeItem(storage, INDEX_KEY, JSON.stringify([...rest, entry]));

  return isSourceSaved && isDerivedSaved && isIndexSaved;
};

/**
 * Убирает лист из хранилища целиком: и файл, и производные, и запись списка.
 *
 * @param sheetId — идентификатор экземпляра
 */
export const deleteUserSheet = (sheetId: string): void => {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  const rest = readIndex(storage).filter((item) => {
    return toText(item.id) !== sheetId;
  });

  storage.removeItem(`${SOURCE_KEY_PREFIX}${sheetId}`);
  storage.removeItem(`${DERIVED_KEY_PREFIX}${sheetId}`);
  writeItem(storage, INDEX_KEY, JSON.stringify(rest));
};

/**
 * Убирает из хранилища все пользовательские листы. Нужен тестам и сбросу
 * состояния: поштучное удаление оставляет мусор, если список разъехался с
 * записями.
 */
export const clearUserSheets = (): void => {
  const storage = getStorage();

  if (!storage) {
    return;
  }

  for (const entry of readIndex(storage)) {
    const id = toText(entry.id);

    storage.removeItem(`${SOURCE_KEY_PREFIX}${id}`);
    storage.removeItem(`${DERIVED_KEY_PREFIX}${id}`);
  }

  storage.removeItem(INDEX_KEY);
};
