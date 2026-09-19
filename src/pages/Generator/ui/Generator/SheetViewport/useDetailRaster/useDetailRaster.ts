import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { renderPageInWorker } from '../../../../model/createPageRenderClient';
import type { GeneratorState } from '../../../../model/generator.types';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

import type {
  DetailRaster,
  DetailRasterDeps,
  DetailRasterInput,
} from './useDetailRaster.types';

/**
 * Пауза после последней смены масштаба или правки, после которой страница
 * заказывается у воркера: колесо и набор текста дают десятки событий в
 * секунду, и заказ на каждое гонял бы воркер впустую.
 */
const DETAIL_DEBOUNCE_MS = 250;

const DEFAULT_DEPS: DetailRasterDeps = {
  renderPage: renderPageInWorker,
  createObjectUrl: (page) => {
    return URL.createObjectURL(page);
  },
  revokeObjectUrl: (url) => {
    URL.revokeObjectURL(url);
  },
};

/**
 * Поля стора, смена которых не меняет нарисованную страницу: масштаб меняет
 * только разрешение, а его ловит сам заказ.
 */
const VIEW_ONLY_KEYS: ReadonlySet<string> = new Set<keyof GeneratorState>(['zoom']);

/**
 * Меняет ли переход стора нарисованную страницу. Сравнивается всё состояние, а
 * не список полей документа: пропущенное поле оставило бы на экране чужую
 * страницу, а лишняя отмена стоит одного перезаказа.
 *
 * @param state — новое состояние
 * @param previous — прежнее состояние
 * @returns `true` — страница могла измениться
 */
const isPageEdit = (state: GeneratorState, previous: GeneratorState): boolean => {
  const previousValues = new Map<string, unknown>(Object.entries(previous));

  return Object.entries(state).some(([key, value]) => {
    return !VIEW_ONLY_KEYS.has(key) && value !== previousValues.get(key);
  });
};

/**
 * Детальный растр страницы для масштаба крупнее вписанного.
 *
 * Страница заказывается у воркера после паузы в зуме и правках: основной поток
 * рисует лист не крупнее вписанного, и полноразмерный кадр на каждый символ
 * замораживал бы ввод. Новая правка отменяет заказ и снимает готовый растр —
 * пока воркер рисует новый, виден растянутый основной, а не устаревшая
 * страница.
 *
 * @param input — план отрисовки, нужное разрешение и зависимости
 * @returns адрес детального растра; `null` — показывать нечего
 */
export const useDetailRaster = (input: DetailRasterInput): string | null => {
  const { plan, scale, deps, pageIndex } = input;
  const [revision, setRevision] = useState(0);
  const [detail, setDetail] = useState<DetailRaster | null>(null);
  /**
   * Заказ уходит по таймеру и берёт план и зависимости на момент отправки, а
   * не на момент постановки: план — новый объект на каждый рендер, и в списке
   * зависимостей эффекта он перезапускал бы паузу бесконечно.
   */
  const latestRef = useRef({ plan, pageIndex, deps: { ...DEFAULT_DEPS, ...deps } });

  useLayoutEffect(() => {
    latestRef.current = { plan, pageIndex, deps: { ...DEFAULT_DEPS, ...deps } };
  });

  useEffect(() => {
    return useGeneratorStore.subscribe((state, previous) => {
      if (isPageEdit(state, previous)) {
        setRevision((current) => {
          return current + 1;
        });
      }
    });
  }, []);

  useEffect(() => {
    if (scale === null) {
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const {
        plan: currentPlan,
        pageIndex: requestedIndex,
        deps: currentDeps,
      } = latestRef.current;

      if (!currentPlan) {
        return;
      }

      /**
       * `??`, а не `||`: запрошенная первая страница — ноль, и `||` подменил бы
       * её показанной.
       */
      const task = currentPlan.buildTask(requestedIndex ?? currentPlan.pageIndex);

      try {
        const page = await currentDeps.renderPage(
          { ...task, params: { ...task.params, scale } },
          controller.signal
        );

        if (!controller.signal.aborted) {
          setDetail({ url: currentDeps.createObjectUrl(page), revision });
        }
      } catch {
        /**
         * Отмена или сбой воркера: остаётся основной растр, растянутый до
         * масштаба, — лист виден, только мягче.
         */
      }
    }, DETAIL_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [scale, revision]);

  const detailUrl = detail?.url || null;

  useEffect(() => {
    return () => {
      if (detailUrl) {
        latestRef.current.deps.revokeObjectUrl(detailUrl);
      }
    };
  }, [detailUrl]);

  if (scale === null || !detail || detail.revision !== revision) {
    return null;
  }

  return detail.url;
};
