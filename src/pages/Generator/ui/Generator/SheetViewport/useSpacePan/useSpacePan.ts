import type { RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';

import type { PanStart, SpacePanState } from './useSpacePan.types';

const SPACE_CODE = 'Space';

/**
 * Пробел принадлежит панораме, только когда фокус ни на чём: в поле текста
 * он печатает пробел, на кнопке — нажимает её.
 *
 * @param target — узел, получивший клавишу
 * @param viewport — область просмотра
 * @returns `true` — пробел можно забрать под панораму
 */
const isPanKeyTarget = (target: EventTarget | null, viewport: HTMLElement): boolean => {
  return target === document.body || target === viewport;
};

/**
 * Пробел + перетаскивание двигает лист в области просмотра, как в
 * графических редакторах; прокрутка колесом и полосами остаётся.
 *
 * @param viewportRef — прокручиваемая область просмотра
 * @returns готовность и ход панорамы — для курсора
 */
export const useSpacePan = (
  viewportRef: RefObject<HTMLElement | null>
): SpacePanState => {
  const [isPanReady, setPanReady] = useState(false);
  const [isPanning, setPanning] = useState(false);
  const isPanReadyRef = useRef(false);
  const startRef = useRef<PanStart | null>(null);

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    const endPan = () => {
      const start = startRef.current;

      if (start && viewport.hasPointerCapture(start.pointerId)) {
        viewport.releasePointerCapture(start.pointerId);
      }

      startRef.current = null;
      setPanning(false);
    };

    const release = () => {
      isPanReadyRef.current = false;
      setPanReady(false);
      endPan();
    };

    const handleWindowKeyDown = (event: KeyboardEvent) => {
      if (event.code !== SPACE_CODE || !isPanKeyTarget(event.target, viewport)) {
        return;
      }

      /**
       * Без отмены пробел прокрутил бы страницу на экран вниз.
       */
      event.preventDefault();
      isPanReadyRef.current = true;
      setPanReady(true);
    };

    const handleWindowKeyUp = (event: KeyboardEvent) => {
      if (event.code === SPACE_CODE) {
        release();
      }
    };

    const handleViewportPointerDown = (event: PointerEvent) => {
      if (!isPanReadyRef.current) {
        return;
      }

      event.preventDefault();
      viewport.setPointerCapture(event.pointerId);
      startRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        scrollLeft: viewport.scrollLeft,
        scrollTop: viewport.scrollTop,
      };
      setPanning(true);
    };

    const handleViewportPointerMove = (event: PointerEvent) => {
      const start = startRef.current;

      if (!start || start.pointerId !== event.pointerId) {
        return;
      }

      viewport.scrollLeft = start.scrollLeft - (event.clientX - start.clientX);
      viewport.scrollTop = start.scrollTop - (event.clientY - start.clientY);
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    window.addEventListener('keyup', handleWindowKeyUp);
    window.addEventListener('blur', release);
    viewport.addEventListener('pointerdown', handleViewportPointerDown);
    viewport.addEventListener('pointermove', handleViewportPointerMove);
    viewport.addEventListener('pointerup', endPan);
    viewport.addEventListener('pointercancel', endPan);

    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
      window.removeEventListener('keyup', handleWindowKeyUp);
      window.removeEventListener('blur', release);
      viewport.removeEventListener('pointerdown', handleViewportPointerDown);
      viewport.removeEventListener('pointermove', handleViewportPointerMove);
      viewport.removeEventListener('pointerup', endPan);
      viewport.removeEventListener('pointercancel', endPan);
    };
  }, [viewportRef]);

  return { isPanReady, isPanning };
};
