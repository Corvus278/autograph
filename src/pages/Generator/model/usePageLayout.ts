import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { waitForFont } from '../lib/measure/waitForFont';
import type { Page } from '../lib/paginate/paginate.types';

import { measureLayout } from './measureLayout';
import type { MeasurerFactory } from './measureLayout.types';
import { useGeneratorStore } from './useGeneratorStore';

/**
 * Пустая страница до первого измерения: генератор всегда показывает лист.
 */
const EMPTY_PAGES: Page[] = [{ lines: [] }];

/**
 * Считает строки и страницы текущего текста. Измерение идёт после загрузки
 * шрифта — иначе переносы посчитаются по подстановочному начертанию — и
 * поэтому асинхронно, через состояние.
 *
 * @param backgroundHeight — высота листа; `null` означает, что фон убран,
 *   высоту задаёт сам текст и всё ложится на одну страницу
 * @param createMeasurer — чем измерять; параметр существует ради тестов и
 *   stories, в приложении используется измеритель на настоящем DOM
 */
export const usePageLayout = (
  backgroundHeight: number | null,
  createMeasurer?: MeasurerFactory
): Page[] => {
  const {
    text,
    blockWidth,
    fontSize,
    lineSpacing,
    fontFamily,
    customFontFamily,
    topOffset,
    bottomMargin,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        text: state.text,
        blockWidth: state.blockWidth,
        fontSize: state.fontSize,
        lineSpacing: state.lineSpacing,
        fontFamily: state.fontFamily,
        customFontFamily: state.customFontFamily,
        topOffset: state.topOffset,
        bottomMargin: state.bottomMargin,
      };
    })
  );
  const clampPageIndex = useGeneratorStore((state) => {
    return state.clampPageIndex;
  });
  const [pages, setPages] = useState<Page[]>(EMPTY_PAGES);
  const activeFontFamily = customFontFamily ?? fontFamily;
  const availableHeight =
    backgroundHeight === null
      ? Number.POSITIVE_INFINITY
      : backgroundHeight - topOffset - bottomMargin;

  useEffect(() => {
    let isCancelled = false;
    const measurerParams = { fontFamily: activeFontFamily, fontSize, lineSpacing };

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
    activeFontFamily,
    fontSize,
    lineSpacing,
    createMeasurer,
  ]);

  useEffect(() => {
    clampPageIndex(pages.length);
  }, [pages, clampPageIndex]);

  return pages;
};
