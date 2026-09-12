import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BASE_FONT_SIZE_PX } from '../lib/calibrate/deriveGeometry';
import { waitForFont } from '../lib/measure/waitForFont';
import type { Page } from '../lib/paginate/paginate.types';

import { measureLayout } from './measureLayout';
import type { MeasurerFactory } from './measureLayout.types';
import { useGeneratorStore } from './useGeneratorStore';
import { usePageGeometry } from './usePageGeometry';

/**
 * Пустая страница до первого измерения: генератор всегда показывает лист.
 */
const EMPTY_PAGES: Page[] = [{ lines: [] }];

/**
 * Считает строки и страницы текущего текста.
 *
 * Раскладка идёт по той же геометрии, по которой страница рисуется: ширина
 * блока и кегль выведены автокалибровкой из разлиновки семьи. Кегль на границе
 * с измерителем переводится в em — измеритель живёт в DOM, а геометрия в
 * пикселях.
 *
 * Измерение идёт после загрузки шрифта — иначе переносы посчитаются по
 * подстановочному начертанию — и поэтому асинхронно, через состояние.
 *
 * @param createMeasurer — чем измерять; параметр существует ради тестов и
 *   stories, в приложении используется измеритель на настоящем DOM
 * @returns страницы прогона с разбитым по строкам текстом
 */
export const usePageLayout = (createMeasurer?: MeasurerFactory): Page[] => {
  const { family, geometry, fontFamily } = usePageGeometry();
  const { text, bottomMargin } = useGeneratorStore(
    useShallow((state) => {
      return { text: state.text, bottomMargin: state.bottomMargin };
    })
  );
  const clampPageIndex = useGeneratorStore((state) => {
    return state.clampPageIndex;
  });
  const [pages, setPages] = useState<Page[]>(EMPTY_PAGES);
  const blockWidth = geometry?.blockWidth || 0;
  const fontSize = (geometry?.fontSizePx || BASE_FONT_SIZE_PX) / BASE_FONT_SIZE_PX;
  const lineSpacing = geometry?.lineSpacing || 0;
  /**
   * Высота под текст: лист минус верхний отступ блока, нижнее поле листа и
   * заданный пользователем запас снизу. Запас задан в шагах разлиновки и
   * переводится в пиксели по шагу той же разлиновки, по которой посчитана
   * геометрия. Семьи нет — предела нет, всё ложится на одну страницу.
   */
  const availableHeight =
    family && geometry
      ? family.height -
        geometry.topOffset -
        family.ruling.margins.bottom -
        bottomMargin * family.ruling.step
      : Number.POSITIVE_INFINITY;

  useEffect(() => {
    let isCancelled = false;
    const measurerParams = { fontFamily, fontSize, lineSpacing };

    const applyLayout = async () => {
      await waitForFont(measurerParams);

      if (isCancelled) {
        return;
      }

      setPages(
        measureLayout(
          { text, blockWidth, availableHeight, measurerParams },
          createMeasurer
        )
      );
    };

    void applyLayout();

    return () => {
      isCancelled = true;
    };
  }, [
    text,
    blockWidth,
    availableHeight,
    fontFamily,
    fontSize,
    lineSpacing,
    createMeasurer,
  ]);

  useEffect(() => {
    clampPageIndex(pages.length);
  }, [pages, clampPageIndex]);

  return pages;
};
