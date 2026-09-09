import { downloadDataUrl } from '@shared/lib/files';
import type { RefObject } from 'react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { SCENES } from '../config';
import { composeWithScene } from '../lib/export/composeWithScene';
import { renderPagePng } from '../lib/export/renderPagePng';

import type { ExportControl, ExportDeps } from './useExportPage.types';
import { useGeneratorStore } from './useGeneratorStore';

const DEFAULT_DEPS: ExportDeps = {
  renderPage: renderPagePng,
  composeScene: composeWithScene,
  download: downloadDataUrl,
};

/**
 * Сохранение результата в PNG. Снимок делается с узла страницы, поэтому в файл
 * попадает ровно то, что видно на листе, — панель настроек и навигация лежат
 * вне этого узла.
 *
 * @param pageRef — узел страницы, с которого снимается PNG
 * @param deps — чем снимать и как отдавать файл; подменяется в тестах
 */
export const useExportPage = (
  pageRef: RefObject<HTMLDivElement | null>,
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
    const node = pageRef.current;

    if (!node) {
      setError('Страница ещё не отрисована');

      return;
    }

    setSaving(true);

    try {
      const pageDataUrl = await renderPage(node);
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

        download(composed, 'handwriting_with_bg.png');
      } else {
        download(pageDataUrl, 'handwriting_page.png');
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
