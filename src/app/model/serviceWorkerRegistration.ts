import type {
  RegisterServiceWorkerOptions,
  UpdateServiceWorker,
} from '@widgets/ServiceWorkerBanner';
import { registerSW } from 'virtual:pwa-register';

/**
 * Период фоновой проверки новой версии. Браузер сверяет `sw.js` только при
 * навигации, а генератор живёт одной вкладкой часами: без своей проверки
 * предложение обновиться дошло бы до пользователя лишь после перезагрузки.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

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

      const checkForUpdate = (): void => {
        void registration.update();
      };

      globalThis.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);

      /**
       * Возврат к вкладке — самый частый момент, когда версия успела
       * смениться: проверка по одному лишь часовому таймеру показала бы
       * предложение обновиться с опозданием до часа.
       */
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          checkForUpdate();
        }
      });
    },
  });
};
