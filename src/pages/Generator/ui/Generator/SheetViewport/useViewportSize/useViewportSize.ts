import type { RefObject } from 'react';
import { useLayoutEffect, useState } from 'react';

import type { ViewportSize } from './useViewportSize.types';

/**
 * Размер области просмотра без полос прокрутки: по нему вписывается лист.
 *
 * Первое измерение — до отрисовки, иначе лист на первом кадре встал бы в
 * масштабе по умолчанию и прыгнул. Дальше размер приходит от
 * `ResizeObserver`: окно, раскрытая панель и полоса прокрутки меняют область
 * без события `resize` у окна.
 *
 * @param targetRef — узел области просмотра
 * @returns размер области; `null` — узла ещё нет
 */
export const useViewportSize = (
  targetRef: RefObject<HTMLElement | null>
): ViewportSize | null => {
  const [size, setSize] = useState<ViewportSize | null>(null);

  useLayoutEffect(() => {
    const target = targetRef.current;

    if (!target) {
      return;
    }

    const measure = () => {
      const { clientWidth: width, clientHeight: height } = target;

      setSize((current) => {
        return current?.width === width && current.height === height
          ? current
          : { width, height };
      });
    };

    measure();

    const observer = new ResizeObserver(measure);

    observer.observe(target);

    return () => {
      observer.disconnect();
    };
  }, [targetRef]);

  return size;
};
