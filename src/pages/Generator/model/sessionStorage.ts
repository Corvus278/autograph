import type { PersistStorage, StorageValue } from 'zustand/middleware';

import { parseSession, parseSessionEnvelope } from './sessionSchema';
import type { GeneratorSession } from './useGeneratorStore.types';

/**
 * Пауза дросселирования записи: набор текста меняет стор на каждый символ, а
 * сериализация сессии и запись `localStorage` синхронны и идут в главном
 * потоке.
 */
const WRITE_THROTTLE_MS = 500;

/**
 * Отложенная запись: ключ и значение. Сериализуется значение только при
 * записи — промежуточные состояния между записями в строку не переводятся.
 */
type PendingWrite = {
  /**
   * Ключ записи.
   */
  name: string;

  /**
   * Сессия с версией формата.
   */
  value: StorageValue<GeneratorSession>;
};

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
 * Читает строку по ключу. `null` — ключа нет или хранилище недоступно.
 *
 * @param name — ключ записи
 * @returns строка записи или `null`
 */
const readRaw = (name: string): string | null => {
  try {
    return getStorage()?.getItem(name) || null;
  } catch {
    return null;
  }
};

/**
 * Хранилище сессии для `persist`. Чтение отдаёт уже проверенную по полям
 * сессию: негодное поле заменено значением по умолчанию, а запись, которую
 * нельзя разобрать или записанную другой версией формата, хранилище считает
 * отсутствующей — генератор открывается с настройками по умолчанию.
 *
 * Запись дросселируется и не бросает: переполненное или запрещённое
 * хранилище молча выключает сохранение, генератор продолжает работать. Уход
 * со страницы (`pagehide`) дописывает отложенную запись сразу — иначе
 * последние полсекунды правок терялись бы при перезагрузке.
 *
 * @param defaults — значения по умолчанию для негодных полей
 * @returns хранилище сессии
 */
export const createSessionStorage = (
  defaults: GeneratorSession
): PersistStorage<GeneratorSession> => {
  let pending: PendingWrite | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flush = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }

    if (!pending) {
      return;
    }

    const { name, value } = pending;

    pending = null;

    try {
      getStorage()?.setItem(name, JSON.stringify(value));
    } catch {
      /**
       * Переполнение и запрет записи не ошибка генератора: сессия просто
       * не сохранится.
       */
    }
  };

  globalThis.addEventListener?.('pagehide', flush);

  return {
    getItem: (name): StorageValue<GeneratorSession> | null => {
      const envelope = parseSessionEnvelope(readRaw(name));

      if (!envelope) {
        return null;
      }

      return { state: parseSession(envelope.state, defaults), version: envelope.version };
    },
    setItem: (name, value) => {
      pending = { name, value };

      if (timer === null) {
        timer = setTimeout(flush, WRITE_THROTTLE_MS);
      }
    },
    removeItem: (name) => {
      pending = null;

      try {
        getStorage()?.removeItem(name);
      } catch {
        /**
         * Запрещённое хранилище и так ничего не хранит.
         */
      }
    },
  };
};
