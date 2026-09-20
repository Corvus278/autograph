/**
 * Период фоновой проверки новой версии. Браузер сверяет `sw.js` только при
 * навигации, а генератор живёт одной вкладкой часами: без своей проверки
 * предложение обновиться дошло бы до пользователя лишь после перезагрузки.
 */
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Минимальный промежуток между проверками. Возврат к приложению даёт сразу два
 * события — `visibilitychange` и `focus`, — и без порога каждый возврат уходил
 * бы в сеть за `sw.js` дважды подряд.
 */
const MIN_CHECK_INTERVAL_MS = 10 * 1000;

/**
 * Регистрация в объёме, который нужен проверке: так планировщик открывается в
 * тестах, где настоящего service worker нет.
 */
type UpdatableRegistration = Pick<ServiceWorkerRegistration, 'update'>;

/**
 * Запускает фоновые проверки новой версии: по таймеру, при возврате к вкладке
 * и при возврате фокуса окну. Возвращает функцию, снимающую все три.
 *
 * Слушателей два, а не один: `visibilitychange` стреляет, когда окно свёрнуто
 * или перекрыто, а переключение между приложениями оставляет его видимым. В
 * установленном приложении вкладок нет, и возврат к нему — это ровно `focus`,
 * поэтому по одному `visibilitychange` предложение обновиться доезжало бы
 * только со следующей перезагрузкой.
 */
export const scheduleUpdateChecks = (
  registration: UpdatableRegistration
): (() => void) => {
  let lastCheckAt = 0;

  const checkForUpdate = async (): Promise<void> => {
    const now = Date.now();

    if (now - lastCheckAt < MIN_CHECK_INTERVAL_MS) {
      return;
    }

    lastCheckAt = now;

    try {
      await registration.update();
    } catch {
      /**
       * Без сети `update()` отклоняется, и для приложения, которое обязано
       * работать оффлайн, это штатный режим, а не ошибка: следующая проверка
       * придёт по таймеру или по возврату пользователя.
       */
    }
  };

  const handleVisibilityChange = (): void => {
    if (document.visibilityState === 'visible') {
      void checkForUpdate();
    }
  };

  const handleFocus = (): void => {
    void checkForUpdate();
  };

  const intervalId = globalThis.setInterval(() => {
    void checkForUpdate();
  }, UPDATE_CHECK_INTERVAL_MS);

  document.addEventListener('visibilitychange', handleVisibilityChange);
  globalThis.addEventListener('focus', handleFocus);

  return () => {
    globalThis.clearInterval(intervalId);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    globalThis.removeEventListener('focus', handleFocus);
  };
};
