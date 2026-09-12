import { downloadDataUrl, readBlobAsDataUrl } from '@shared/lib/files';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { SCENES } from '../config';
import { composeWithScene } from '../lib/export/composeWithScene';
import { PAGE_IMAGE_EXTENSION } from '../lib/export/pageImageFormat';

import { renderPageInWorker } from './createPageRenderClient';
import type { PageRenderTask, RunRenderPlan } from './pageTask.types';
import type { ExportControl, ExportDeps } from './useExportPage.types';
import { useGeneratorStore } from './useGeneratorStore';

/**
 * Растеризация страницы по умолчанию: та же отрисовка, что и в предпросмотре,
 * но в разрешении кадра листа и в воркере.
 *
 * Снимок приходит блобом и превращается в data URL: сцена собирается на canvas
 * документа и принимает страницу картинкой, а адрес объекта протухает раньше,
 * чем пользователь дожмёт «Сохранить».
 *
 * @param task — задание на отрисовку текущей страницы
 * @returns data URL снимка страницы
 */
const renderPageDataUrl = async (task: PageRenderTask): Promise<string> => {
  const page = await renderPageInWorker(task);

  return readBlobAsDataUrl(page);
};

const DEFAULT_DEPS: ExportDeps = {
  renderPage: renderPageDataUrl,
  composeScene: composeWithScene,
  download: downloadDataUrl,
};

/**
 * Сохранение текущей страницы в файл — отдельное действие, не связанное с
 * выгрузкой пачки. Рисуется только лист: отрисовке передаётся страница, а не
 * узел документа, поэтому интерфейсу в снимок попасть неоткуда.
 *
 * @param plan — план отрисовки прогона; `null` — страница ещё не готова
 * @param deps — чем рисовать и как отдавать файл; подменяется в тестах
 * @returns состояние сохранения и метод сохранения
 */
export const useExportPage = (
  plan: RunRenderPlan | null,
  deps: Partial<ExportDeps> = {}
): ExportControl => {
  const { renderPage, composeScene, download } = { ...DEFAULT_DEPS, ...deps };
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setSaving] = useState(false);
  const {
    isSceneEnabled,
    sceneId,
    customSceneSrc,
    sceneRotate,
    sceneShiftX,
    sceneShiftY,
    sceneScale,
    sceneDarken,
    hasSceneShadow,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        isSceneEnabled: state.isSceneEnabled,
        sceneId: state.sceneId,
        customSceneSrc: state.customSceneSrc,
        sceneRotate: state.sceneRotate,
        sceneShiftX: state.sceneShiftX,
        sceneShiftY: state.sceneShiftY,
        sceneScale: state.sceneScale,
        sceneDarken: state.sceneDarken,
        hasSceneShadow: state.hasSceneShadow,
      };
    })
  );

  const save = async (): Promise<void> => {
    if (!plan) {
      setError('Страница ещё не отрисована');

      return;
    }

    setSaving(true);

    try {
      const pageDataUrl = await renderPage(plan.buildTask(plan.pageIndex));
      const sceneSrc =
        customSceneSrc ??
        SCENES.find(({ id }) => {
          return id === sceneId;
        })?.src ??
        null;

      if (isSceneEnabled && sceneSrc) {
        const composed = await composeScene(pageDataUrl, sceneSrc, {
          rotate: sceneRotate,
          shiftX: sceneShiftX,
          shiftY: sceneShiftY,
          scale: sceneScale,
          darken: sceneDarken,
          hasShadow: hasSceneShadow,
        });

        download(composed, `handwriting_with_bg.${PAGE_IMAGE_EXTENSION}`);
      } else {
        download(pageDataUrl, `handwriting_page.${PAGE_IMAGE_EXTENSION}`);
      }

      setError(null);
    } catch {
      setError('Не удалось сохранить страницу. Попробуйте ещё раз');
    } finally {
      setSaving(false);
    }
  };

  return { error, isSaving, save };
};
