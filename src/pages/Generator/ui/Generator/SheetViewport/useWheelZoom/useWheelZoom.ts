import { useEffect, useLayoutEffect, useRef } from 'react';

import { useGeneratorStore } from '../../../../model/useGeneratorStore';
import { clampZoom } from '../zoomScale';

import type { WheelAnchor, WheelZoomInput } from './useWheelZoom.types';

/**
 * Во сколько раз меняется масштаб на пиксель прокрутки, в показателе
 * экспоненты: щелчок колеса (около 100 пикселей) — примерно пятая часть
 * масштаба, жест тачпада — плавно.
 */
const WHEEL_ZOOM_RATE = 0.002;

/**
 * Высота строки прокрутки в пикселях: мышь в режиме строк отдаёт смещение
 * строками, и без перевода щелчок почти не менял бы масштаб.
 */
const WHEEL_LINE_HEIGHT = 16;

/**
 * Ctrl/⌘ + колесо меняет масштаб вокруг курсора: точка листа под курсором
 * остаётся под ним. Без модификатора колесо прокручивает лист как обычно.
 *
 * Слушатель вешается напрямую, а не пропсом: React регистрирует колесо
 * пассивным, и отменить масштабирование страницы браузером было бы нельзя.
 *
 * @param input — область, лист и текущий масштаб
 */
export const useWheelZoom = (input: WheelZoomInput): void => {
  const { viewportRef, sheetRef, zoom } = input;
  const setZoom = useGeneratorStore((state) => {
    return state.setZoom;
  });
  const zoomRef = useRef(zoom);
  const anchorRef = useRef<WheelAnchor | null>(null);

  /**
   * Прокрутка правится после того, как лист встал в новом размере, и до
   * отрисовки кадра — иначе на кадр мелькнул бы лист, отъехавший от курсора.
   */
  useLayoutEffect(() => {
    zoomRef.current = zoom;

    const viewport = viewportRef.current;
    const sheet = sheetRef.current;
    const anchor = anchorRef.current;

    anchorRef.current = null;

    if (!viewport || !sheet || !anchor) {
      return;
    }

    const { left, top } = sheet.getBoundingClientRect();

    viewport.scrollLeft += left + anchor.sheetX * zoom - anchor.clientX;
    viewport.scrollTop += top + anchor.sheetY * zoom - anchor.clientY;
  }, [viewportRef, sheetRef, zoom]);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const handleViewportWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) {
        return;
      }

      event.preventDefault();

      const current = zoomRef.current;
      const delta =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? event.deltaY * WHEEL_LINE_HEIGHT
          : event.deltaY;
      const next = clampZoom(current * Math.exp(-delta * WHEEL_ZOOM_RATE));

      if (next === current) {
        return;
      }

      const sheet = sheetRef.current;

      if (sheet) {
        const { left, top } = sheet.getBoundingClientRect();

        anchorRef.current = {
          clientX: event.clientX,
          clientY: event.clientY,
          sheetX: (event.clientX - left) / current,
          sheetY: (event.clientY - top) / current,
        };
      }

      setZoom(next);
    };

    viewport.addEventListener('wheel', handleViewportWheel, { passive: false });

    return () => {
      viewport.removeEventListener('wheel', handleViewportWheel);
    };
  }, [viewportRef, sheetRef, setZoom]);
};
