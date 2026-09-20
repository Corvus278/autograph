import type {
  RegisterServiceWorkerOptions,
  UpdateServiceWorker,
} from '@widgets/ServiceWorkerBanner';
import { registerSW } from 'virtual:pwa-register';

import { scheduleUpdateChecks } from './scheduleUpdateChecks';

/**
 * Регистрирует service worker и возвращает переход на новую версию.
 *
 * Единственный в приложении файл с импортом `virtual:pwa-register`: этот
 * модуль создаёт плагин сборки, и ни vitest, ни Storybook его не резолвят.
 * Всё остальное приложение получает регистрацию аргументом.
 *
 * Живёт рядом с точкой входа, а не в слайсе плашки: попади он в её публичное
 * API, виртуальный импорт тянулся бы в каждый тест, который рисует `App`.
 *
 * Отказ регистрации не бросается наружу, а уходит в `onRegisterError`:
 * приложение обязано работать из сети, когда кэш сохранить не удалось.
 */
export const registerServiceWorker = ({
  onNeedRefresh,
  onOfflineReady,
  onRegisterError,
}: RegisterServiceWorkerOptions): UpdateServiceWorker => {
  return registerSW({
    /**
     * Регистрация не ждёт события `load`: загрузка кэша идёт фоном и работе с
     * генератором не мешает, а отложенный старт отодвигал бы готовность к
     * работе без сети на время разбора шрифтов и листов.
     */
    immediate: true,
    onNeedRefresh,
    onOfflineReady,
    onRegisterError,
    onRegisteredSW: (_swScriptUrl, registration) => {
      if (!registration) {
        return;
      }

      /**
       * Возврат к приложению — самый частый момент, когда версия успела
       * смениться: проверка по одному лишь часовому таймеру показала бы
       * предложение обновиться с опозданием до часа.
       */
      scheduleUpdateChecks(registration);
    },
  });
};
