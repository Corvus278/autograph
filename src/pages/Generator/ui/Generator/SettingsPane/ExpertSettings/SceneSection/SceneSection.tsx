import { readFileAsDataUrl } from '@shared/lib/files';
import { Checkbox } from '@shared/ui/Checkbox';
import { FileInput } from '@shared/ui/FileInput';
import { RadioGroup } from '@shared/ui/RadioGroup';
import { ValueSlider } from '@shared/ui/ValueSlider';
import type { FC } from 'react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  SCENE_DARKEN_RANGE,
  SCENE_ROTATE_RANGE,
  SCENE_SCALE_RANGE,
  SCENE_SHIFT_RANGE,
  SCENES,
} from '../../../../../config';
import { formatDegrees, formatPercent, formatPixels } from '../../../../../lib/format';
import { useGeneratorStore } from '../../../../../model/useGeneratorStore';

import type { SceneSliderOption } from './SceneSection.types';

const SCENE_OPTIONS = SCENES.map(({ id, label }) => {
  return { value: id, label };
});

/**
 * Масштаб — пиксели кадра сцены, прибавленные к ширине вписанной страницы;
 * сдвиг — пиксели кадра сцены от центра; затемнение — доля непрозрачности
 * чёрного поверх страницы.
 */
const SCENE_SLIDERS: SceneSliderOption[] = [
  {
    field: 'sceneRotate',
    label: 'Поворот страницы',
    range: SCENE_ROTATE_RANGE,
    formatValue: formatDegrees,
  },
  {
    field: 'sceneShiftX',
    label: 'Сдвиг по горизонтали',
    range: SCENE_SHIFT_RANGE,
    formatValue: formatPixels,
  },
  {
    field: 'sceneShiftY',
    label: 'Сдвиг по вертикали',
    range: SCENE_SHIFT_RANGE,
    formatValue: formatPixels,
  },
  {
    field: 'sceneScale',
    label: 'Масштаб страницы',
    range: SCENE_SCALE_RANGE,
    formatValue: formatPixels,
  },
  {
    field: 'sceneDarken',
    label: 'Затемнение страницы',
    range: SCENE_DARKEN_RANGE,
    formatValue: formatPercent,
  },
];

const READ_ERROR = 'Не удалось прочитать картинку';

/**
 * Вложение снимка страницы в сцену. Выключено — параметры не показываются:
 * ни на что не влияя, они только удлиняли бы экспертный режим.
 */
export const SceneSection: FC = () => {
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
  const preview = useGeneratorStore((state) => {
    return state.preview;
  });
  const [error, setError] = useState<string | null>(null);
  const values = { sceneRotate, sceneShiftX, sceneShiftY, sceneScale, sceneDarken };

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
        setError(READ_ERROR);
      }
    };

    void apply();
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

      {isSceneEnabled ? (
        <>
          <RadioGroup
            label="Сцена"
            value={customSceneSrc ? '' : sceneId}
            options={SCENE_OPTIONS}
            onChange={handleSceneChange}
          />

          <FileInput
            label="Своя сцена"
            accept="image/*"
            error={error}
            onSelect={handleSceneFileSelect}
          />

          {SCENE_SLIDERS.map(({ field, label, range, formatValue }) => {
            const handleParamChange = (value: number) => {
              preview({ [field]: value });
            };

            const handleParamCommit = (value: number) => {
              setSceneParams({ [field]: value });
            };

            return (
              <ValueSlider
                key={field}
                label={label}
                value={values[field]}
                min={range.min}
                max={range.max}
                step={range.step}
                formatValue={formatValue}
                onChange={handleParamChange}
                onValueCommit={handleParamCommit}
              />
            );
          })}

          <Checkbox
            label="Тень под страницей"
            isChecked={hasSceneShadow}
            onChange={handleShadowChange}
          />
        </>
      ) : null}
    </div>
  );
};
