import type { ManualRulingListener } from './manualRulingRequest.types';

/**
 * Подписчики живут вне React: импорт идёт из выбора бумаги, а диалог листа
 * монтируется рядом, а не внутри него, и общего предка со своим состоянием у
 * них нет.
 */
const listeners = new Set<ManualRulingListener>();

/**
 * Просит открыть ручной ввод разлиновки добавленного листа.
 *
 * @param sheetId — идентификатор листа, на котором разлиновка не нашлась
 */
export const requestManualRuling = (sheetId: string): void => {
  listeners.forEach((listener) => {
    listener(sheetId);
  });
};

/**
 * Подписывает на просьбы о ручной разлиновке.
 *
 * @param listener — кому передать идентификатор листа
 * @returns отписка
 */
export const subscribeManualRuling = (listener: ManualRulingListener): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};
