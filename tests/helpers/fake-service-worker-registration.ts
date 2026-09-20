import type { RegisterServiceWorkerOptions } from '@widgets/ServiceWorkerBanner';
import { vi } from 'vitest';

/**
 * Поддельная регистрация service worker: отдаёт колбэки наружу, чтобы тест
 * проигрывал события сам, и считает вызовы перехода на новую версию.
 *
 * @returns функция регистрации для хука, доступ к колбэкам последней
 *   регистрации и мок перехода на новую версию
 */
export const createFakeRegistration = () => {
  const updateServiceWorker = vi.fn(async () => {});
  const register = vi.fn((_options: RegisterServiceWorkerOptions) => {
    return updateServiceWorker;
  });

  /**
   * Колбэки последней регистрации: ими тест проигрывает события service
   * worker.
   */
  const getOptions = (): RegisterServiceWorkerOptions | undefined => {
    return register.mock.calls.at(-1)?.[0];
  };

  return { getOptions, register, updateServiceWorker };
};
