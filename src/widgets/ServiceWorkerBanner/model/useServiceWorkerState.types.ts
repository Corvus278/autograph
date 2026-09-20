import type {
  RegisterServiceWorkerOptions,
  UpdateServiceWorker,
} from './serviceWorkerRegistration.types';

/**
 * Функция регистрации service worker. Аргументом её принимают и точка входа, и
 * хук: настоящую даёт `serviceWorkerRegistration.ts`, тест — свою.
 */
export type RegisterServiceWorker = (
  options: RegisterServiceWorkerOptions
) => UpdateServiceWorker;

export type ServiceWorkerState = {
  /**
   * Кэш загружен целиком — приложение открывается без сети. Снимается
   * закрытием сообщения.
   */
  isOfflineReady: boolean;

  /**
   * Новая версия загружена фоном и ждёт перехода. Пока флаг поднят, страница
   * продолжает работать на текущей версии.
   */
  hasUpdate: boolean;
};

export type ServiceWorkerStateValue = ServiceWorkerState & {
  /**
   * Переход на загруженную новую версию по действию пользователя. Без
   * ожидающей версии не делает ничего.
   */
  update: () => void;

  /**
   * Закрытие сообщения пользователем: снимает оба флага.
   */
  dismiss: () => void;
};
