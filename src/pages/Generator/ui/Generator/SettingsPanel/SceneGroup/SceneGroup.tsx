import { readFileAsDataUrl } from '@shared/lib/files';
import { Checkbox } from '@shared/ui/Checkbox';
import { FileInput } from '@shared/ui/FileInput';
import { RadioGroup } from '@shared/ui/RadioGroup';
import { Slider } from '@shared/ui/Slider';
import type { FC } from 'react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  SCENE_DARKEN_RANGE,
  SCENE_ROTATE_RANGE,
  SCENE_SCALE_RANGE,
  SCENE_SHIFT_RANGE,
  SCENES,
} from '../../../../config';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

const SCENE_OPTIONS = SCENES.map(({ id, label }) => {
  return { value: id, label };
});

/**
 * Группа «Сцена для сохранения»: во что вкладывается снимок страницы. Пока
 * режим выключен, все параметры вложения недоступны — они ни на что не влияют.
 */
export const SceneGroup: FC = () => {
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
  const setSceneEnabled = useGeneratorStore((state) => {
    return state.setSceneEnabled;
  });
  const selectScene = useGeneratorStore((state) => {
    return state.selectScene;
  });
  const setCustomScene = useGeneratorStore((state) => {
    return state.setCustomScene;
  });
  const setSceneParams = useGeneratorStore((state) => {
    return state.setSceneParams;
  });
  const [error, setError] = useState<string | null>(null);

  const handleSceneEnabledChange = (isChecked: boolean) => {
    setSceneEnabled(isChecked);
  };

  const handleSceneChange = (value: string) => {
    selectScene(value);
  };

  const handleSceneFileSelect = (file: File) => {
    const apply = async () => {
      try {
        setCustomScene(await readFileAsDataUrl(file));
        setError(null);
      } catch {
        setError('Не удалось прочитать картинку');
      }
    };

    void apply();
  };

  const handleRotateChange = (value: number) => {
    setSceneParams({ sceneRotate: value });
  };

  const handleShiftXChange = (value: number) => {
    setSceneParams({ sceneShiftX: value });
  };

  const handleShiftYChange = (value: number) => {
    setSceneParams({ sceneShiftY: value });
  };

  const handleScaleChange = (value: number) => {
    setSceneParams({ sceneScale: value });
  };

  const handleDarkenChange = (value: number) => {
    setSceneParams({ sceneDarken: value });
  };

  const handleShadowChange = (isChecked: boolean) => {
    setSceneParams({ hasSceneShadow: isChecked });
  };

  return (
    <div className="flex flex-col gap-4">
      <Checkbox
        label="Вкладывать страницу в сцену"
        isChecked={isSceneEnabled}
        onChange={handleSceneEnabledChange}
      />

      <RadioGroup
        label="Сцена"
        value={customSceneSrc ? '' : sceneId}
        options={SCENE_OPTIONS}
        isDisabled={!isSceneEnabled}
        onChange={handleSceneChange}
      />

      <FileInput
        label="Своя сцена"
        accept="image/*"
        error={error}
        isDisabled={!isSceneEnabled}
        onSelect={handleSceneFileSelect}
      />

      <Slider
        label="Поворот страницы"
        value={sceneRotate}
        min={SCENE_ROTATE_RANGE.min}
        max={SCENE_ROTATE_RANGE.max}
        step={SCENE_ROTATE_RANGE.step}
        isDisabled={!isSceneEnabled}
        onChange={handleRotateChange}
      />

      <Slider
        label="Сдвиг по горизонтали"
        value={sceneShiftX}
        min={SCENE_SHIFT_RANGE.min}
        max={SCENE_SHIFT_RANGE.max}
        step={SCENE_SHIFT_RANGE.step}
        isDisabled={!isSceneEnabled}
        onChange={handleShiftXChange}
      />

      <Slider
        label="Сдвиг по вертикали"
        value={sceneShiftY}
        min={SCENE_SHIFT_RANGE.min}
        max={SCENE_SHIFT_RANGE.max}
        step={SCENE_SHIFT_RANGE.step}
        isDisabled={!isSceneEnabled}
        onChange={handleShiftYChange}
      />

      <Slider
        label="Масштаб страницы"
        value={sceneScale}
        min={SCENE_SCALE_RANGE.min}
        max={SCENE_SCALE_RANGE.max}
        step={SCENE_SCALE_RANGE.step}
        isDisabled={!isSceneEnabled}
        onChange={handleScaleChange}
      />

      <Slider
        label="Затемнение страницы"
        value={sceneDarken}
        min={SCENE_DARKEN_RANGE.min}
        max={SCENE_DARKEN_RANGE.max}
        step={SCENE_DARKEN_RANGE.step}
        isDisabled={!isSceneEnabled}
        onChange={handleDarkenChange}
      />

      <Checkbox
        label="Тень под страницей"
        isChecked={hasSceneShadow}
        isDisabled={!isSceneEnabled}
        onChange={handleShadowChange}
      />
    </div>
  );
};
