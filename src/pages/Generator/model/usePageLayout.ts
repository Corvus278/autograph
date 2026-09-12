import { useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { waitForFont } from '../lib/measure/waitForFont';
import type { LayoutPage } from '../lib/paginate/paginate.types';

import { measureLayout } from './measureLayout';
import type { MeasurerFactory } from './measureLayout.types';
import { useGeneratorStore } from './useGeneratorStore';
import { usePageGeometry } from './usePageGeometry';

/**
 * Одна пустая страница до первого измерения и без листов: генератор всегда
 * показывает лист.
 */
const EMPTY_PAGES: LayoutPage[] = [{ sheetId: '', lines: [] }];

/**
 * Раскладывает текущий текст по страницам прогона.
 *
 * Раскладка последовательная: каждая страница набирается под лист, который
 * выдала ей раздача прогона, — по той же геометрии и той же модели строчного
 * бокса, по которым страница рисуется, — и несёт идентификатор этого листа.
 *
 * Измерение идёт после загрузки шрифта — иначе переносы посчитаются по
 * подстановочному начертанию — и поэтому асинхронно, через состояние.
 *
 * @param createMeasurer — чем измерять; параметр существует ради тестов и
 *   stories, в приложении используется измеритель на настоящем DOM
 * @returns страницы прогона с разбитым по строкам текстом и листом каждой
 */
export const usePageLayout = (createMeasurer?: MeasurerFactory): LayoutPage[] => {
  const { family, metrics, correction, fontFamily } = usePageGeometry();
  const { text, bottomMargin, runSeed, sheetId, isSheetPinned } = useGeneratorStore(
    useShallow((state) => {
      return {
        text: state.text,
        bottomMargin: state.bottomMargin,
        runSeed: state.runSeed,
        sheetId: state.sheetId,
        isSheetPinned: state.isSheetPinned,
      };
    })
  );
  const clampPageIndex = useGeneratorStore((state) => {
    return state.clampPageIndex;
  });
  const [pages, setPages] = useState<LayoutPage[]>(EMPTY_PAGES);

  useEffect(() => {
    let isCancelled = false;

    const applyLayout = async () => {
      await waitForFont({ fontFamily });

      if (isCancelled) {
        return;
      }

      if (!family || family.sheets.length === 0) {
        setPages(EMPTY_PAGES);

        return;
      }

      setPages(
        measureLayout(
          {
            text,
            fontFamily,
            metrics,
            correction,
            bottomMargin,
            runSeed,
            family,
            sheetId,
            isSheetPinned,
          },
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
    fontFamily,
    metrics,
    correction,
    bottomMargin,
    runSeed,
    family,
    sheetId,
    isSheetPinned,
    createMeasurer,
  ]);

  useEffect(() => {
    clampPageIndex(pages.length);
  }, [pages, clampPageIndex]);

  return pages;
};
