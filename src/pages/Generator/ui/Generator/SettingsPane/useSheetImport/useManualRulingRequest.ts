import { useEffect } from 'react';

import { subscribeManualRuling } from './manualRulingRequest';
import type { ManualRulingListener } from './manualRulingRequest.types';

/**
 * Слушает просьбы о ручной разлиновке, пока компонент смонтирован: добавленный
 * лист, на котором автоопределение не нашло линий, должен сразу открыть свой
 * диалог.
 *
 * @param onRequest — колбэк с идентификатором листа
 */
export const useManualRulingRequest = (onRequest: ManualRulingListener): void => {
  useEffect(() => {
    return subscribeManualRuling(onRequest);
  }, [onRequest]);
};
