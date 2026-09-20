import { useCallback, useEffect, useSyncExternalStore } from 'react';

import type { UpdateServiceWorker } from './serviceWorkerRegistration.types';
import type {
  RegisterServiceWorker,
  ServiceWorkerState,
  ServiceWorkerStateValue,
} from './useServiceWorkerState.types';

/**
 * Состояние service worker живёт вне React: регистрация начинается в точке
 * входа, до первого рендера, чтобы кэш пошёл качаться сразу, а не с монтажа
 * плашки. Хук только подписывается на него.
 *
 * Функция регистрации приходит аргументом, а не импортом: настоящая тянет за
 * собой `virtual:pwa-register`, который есть только в сборке Vite с плагином.
 * Импортируй его этот модуль — ни один тест и ни одна story не смогли бы
 * открыть состояние.
 */

const INITIAL_STATE: ServiceWorkerState = { hasUpdate: false, isOfflineReady: false };

let state: ServiceWorkerState = INITIAL_STATE;

let updateServiceWorker: UpdateServiceWorker | null = null;

const listeners = new Set<() => void>();

const setState = (patch: Partial<ServiceWorkerState>): void => {
  state = { ...state, ...patch };
  listeners.forEach((listener) => {
    listener();
  });
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
};

const getState = (): ServiceWorkerState => {
  return state;
};

/**
 * Начинает регистрацию service worker и подключает её к состоянию. Зовётся
 * один раз из точки входа под `import.meta.env.PROD`; тест зовёт со своей
 * функцией регистрации, и она вытесняет предыдущую вместе с её состоянием.
 *
 * Отказ регистрации — запрет хранилища, исчерпанная квота — состояние не
 * меняет: приложение продолжает работать из сети и молчит об этом на экране.
 */
export const startServiceWorkerRegistration = (register: RegisterServiceWorker): void => {
  state = INITIAL_STATE;
  updateServiceWorker = register({
    onNeedRefresh: () => {
      setState({ hasUpdate: true });
    },
    onOfflineReady: () => {
      setState({ isOfflineReady: true });
    },
    onRegisterError: () => {
      setState(INITIAL_STATE);
    },
  });
};

/**
 * Состояние service worker и действия над ним для интерфейса.
 *
 * Без аргумента хук только читает регистрацию, начатую точкой входа, — так он
 * и работает в приложении. Аргумент нужен тестам и stories: с ним хук
 * начинает регистрацию сам, и dev-сервер, Storybook и тесты остаются без
 * настоящего service worker.
 */
export const useServiceWorkerState = (
  register?: RegisterServiceWorker
): ServiceWorkerStateValue => {
  const serviceWorkerState = useSyncExternalStore(subscribe, getState);

  useEffect(() => {
    if (register) {
      startServiceWorkerRegistration(register);
    }
  }, [register]);

  /**
   * Без ожидающей версии переход не запрашивается: сообщение о готовности к
   * работе без сети тоже закрывается кнопкой, и один общий обработчик иначе
   * дёргал бы service worker впустую.
   *
   * Флаг обновления не снимается: переход перезагружает страницу сам, а
   * погасшая раньше времени плашка обещала бы переход, которого не случилось.
   */
  const update = useCallback(() => {
    if (!state.hasUpdate) {
      return;
    }

    void updateServiceWorker?.();
  }, []);

  const dismiss = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return { ...serviceWorkerState, dismiss, update };
};
