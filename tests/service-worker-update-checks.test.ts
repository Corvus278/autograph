// @vitest-environment jsdom

import { scheduleUpdateChecks } from '@app/model/scheduleUpdateChecks';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Порог, гасящий сдвоенную проверку при возврате к приложению: возврат даёт и
 * `visibilitychange`, и `focus`.
 */
const MIN_CHECK_INTERVAL_MS = 10 * 1000;

/**
 * Период фоновой проверки новой версии.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

const setVisibility = (value: DocumentVisibilityState): void => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => {
      return value;
    },
  });
};

describe('фоновая проверка новой версии', () => {
  let stop: () => void = () => {};

  beforeEach(() => {
    vi.useFakeTimers();
    setVisibility('visible');
  });

  afterEach(() => {
    stop();
    vi.useRealTimers();
  });

  it('проверяет версию, когда окну вернули фокус', () => {
    const update = vi.fn().mockResolvedValue(undefined);

    stop = scheduleUpdateChecks({ update });

    globalThis.dispatchEvent(new Event('focus'));

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('проверяет версию, когда вкладку снова показали', () => {
    const update = vi.fn().mockResolvedValue(undefined);

    stop = scheduleUpdateChecks({ update });

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    setVisibility('visible');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('не проверяет версию, пока вкладка скрыта', () => {
    const update = vi.fn().mockResolvedValue(undefined);

    stop = scheduleUpdateChecks({ update });

    setVisibility('hidden');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(update).not.toHaveBeenCalled();
  });

  it('не удваивает запрос, когда возврат дал оба события сразу', () => {
    const update = vi.fn().mockResolvedValue(undefined);

    stop = scheduleUpdateChecks({ update });

    document.dispatchEvent(new Event('visibilitychange'));
    globalThis.dispatchEvent(new Event('focus'));

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('проверяет версию снова, когда порог между проверками прошёл', () => {
    const update = vi.fn().mockResolvedValue(undefined);

    stop = scheduleUpdateChecks({ update });

    globalThis.dispatchEvent(new Event('focus'));
    vi.advanceTimersByTime(MIN_CHECK_INTERVAL_MS);
    globalThis.dispatchEvent(new Event('focus'));

    expect(update).toHaveBeenCalledTimes(2);
  });

  it('проверяет версию по таймеру, пока пользователь не отходил', () => {
    const update = vi.fn().mockResolvedValue(undefined);

    stop = scheduleUpdateChecks({ update });

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);

    expect(update).toHaveBeenCalledTimes(1);
  });

  it('переживает отказ проверки без сети', async () => {
    /**
     * Отказ всплывает в процесс, а не в окно jsdom, и не сразу: ждать его
     * приходится настоящей макрозадачей, поэтому здесь таймеры живые.
     */
    vi.useRealTimers();

    const update = vi.fn().mockRejectedValue(new Error('offline'));

    stop = scheduleUpdateChecks({ update });

    const rejections: unknown[] = [];

    const handleRejection = (reason: unknown): void => {
      rejections.push(reason);
    };

    process.on('unhandledRejection', handleRejection);
    globalThis.dispatchEvent(new Event('focus'));

    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    process.off('unhandledRejection', handleRejection);

    expect(update).toHaveBeenCalledTimes(1);
    expect(rejections).toEqual([]);
  });

  it('снимает обе подписки и таймер', () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const stopChecks = scheduleUpdateChecks({ update });

    stopChecks();
    globalThis.dispatchEvent(new Event('focus'));
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);

    expect(update).not.toHaveBeenCalled();
  });
});
