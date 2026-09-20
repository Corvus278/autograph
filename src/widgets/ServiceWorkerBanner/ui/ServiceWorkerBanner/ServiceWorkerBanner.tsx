import { Button } from '@shared/ui/Button';
import type { FC } from 'react';
import { useEffect } from 'react';

import { useServiceWorkerState } from '../../model/useServiceWorkerState';

/**
 * Через сколько гаснет сообщение о готовности к работе без сети. Оно ничего
 * не требует от пользователя, поэтому висит до первого прочтения и уходит
 * само; предложение обновиться, наоборот, ждёт действия и таймера не имеет.
 */
const OFFLINE_READY_HIDE_DELAY_MS = 6000;

/**
 * Плашка service worker: предложение перейти на загруженную новую версию и
 * сообщение о том, что приложение готово работать без сети.
 *
 * Одна плашка на два сообщения: показываются они в разное время, а места
 * занимают одно. Предложение обновиться важнее — при совпадении показывается
 * оно, а сообщение о готовности снимается вместе с ним по действию
 * пользователя.
 *
 * Место — нижний левый угол над полосой действий: так плашка ложится на
 * колонку текста (её ширину и берёт) и не перекрывает область просмотра
 * листа. Отступы от краёв колонки даёт обёртка, а не сама плашка: прибавленные
 * к её ширине, они вынесли бы правый край за колонку — прямо на лист.
 * `z-30` держит её ниже диалогов (`z-40` и `z-50`): всплывший поверх
 * модального диалога текст перехватывал бы внимание и клики.
 *
 * Область сообщения (`role="status"`) висит в разметке всегда, а появляется и
 * исчезает только её содержимое: читалка озвучивает текст, попавший в уже
 * существующую область, а не саму область, добавленную вместе с текстом.
 */
export const ServiceWorkerBanner: FC = () => {
  const { hasUpdate, isOfflineReady, dismiss, update } = useServiceWorkerState();

  const isOfflineNoticeShown = isOfflineReady && !hasUpdate;

  /**
   * Таймер живёт, только пока висит сообщение о готовности: появившееся
   * предложение обновиться снимает таймер, и погасшее сообщение не уносит с
   * собой ещё не показанное обновление.
   */
  useEffect(() => {
    if (!isOfflineNoticeShown) {
      return undefined;
    }

    const timer = window.setTimeout(dismiss, OFFLINE_READY_HIDE_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [dismiss, isOfflineNoticeShown]);

  const handleUpdateClick = () => {
    update();
  };

  const handleDismissClick = () => {
    dismiss();
  };

  return (
    <div role="status">
      {(hasUpdate || isOfflineNoticeShown) && (
        <div className="fixed bottom-action-bar left-0 z-30 w-text-panel p-4">
          <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-raised p-3 shadow-popover">
            <p className="flex-1 text-sm text-fg">
              {hasUpdate
                ? 'Вышла новая версия приложения'
                : 'Приложение готово к работе без сети'}
            </p>

            {hasUpdate && (
              <Button variant="primary" onClick={handleUpdateClick}>
                Обновить
              </Button>
            )}

            <Button variant="ghost" onClick={handleDismissClick}>
              {hasUpdate ? 'Позже' : 'Понятно'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
