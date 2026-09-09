import { readFileAsDataUrl } from '@shared/lib/files';
import { Checkbox } from '@shared/ui/Checkbox';
import { FileInput } from '@shared/ui/FileInput';
import { RadioGroup } from '@shared/ui/RadioGroup';
import type { FC } from 'react';
import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { PAGE_BACKGROUNDS } from '../../../../config';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

const BACKGROUND_OPTIONS = PAGE_BACKGROUNDS.map(({ id, label }) => {
  return { value: id, label };
});

/**
 * Группа «Фон»: на чём пишем.
 */
export const BackgroundGroup: FC = () => {
  const { backgroundId, customBackgroundSrc, isBackgroundHidden } = useGeneratorStore(
    useShallow((state) => {
      return {
        backgroundId: state.backgroundId,
        customBackgroundSrc: state.customBackgroundSrc,
        isBackgroundHidden: state.isBackgroundHidden,
      };
    })
  );
  const selectBackground = useGeneratorStore((state) => {
    return state.selectBackground;
  });
  const setCustomBackground = useGeneratorStore((state) => {
    return state.setCustomBackground;
  });
  const setBackgroundHidden = useGeneratorStore((state) => {
    return state.setBackgroundHidden;
  });
  const [error, setError] = useState<string | null>(null);

  const handleBackgroundChange = (value: string) => {
    selectBackground(value);
  };

  const handleBackgroundFileSelect = (file: File) => {
    const apply = async () => {
      try {
        setCustomBackground(await readFileAsDataUrl(file));
        setError(null);
      } catch {
        setError('Не удалось прочитать картинку');
      }
    };

    void apply();
  };

  const handleHiddenChange = (isChecked: boolean) => {
    setBackgroundHidden(isChecked);
  };

  return (
    <div className="flex flex-col gap-4">
      <RadioGroup
        label="Фон листа"
        value={customBackgroundSrc ? '' : backgroundId}
        options={BACKGROUND_OPTIONS}
        isDisabled={isBackgroundHidden}
        onChange={handleBackgroundChange}
      />

      <FileInput
        label="Свой фон"
        accept="image/*"
        error={error}
        isDisabled={isBackgroundHidden}
        onSelect={handleBackgroundFileSelect}
      />

      <Checkbox
        label="Убрать фон"
        isChecked={isBackgroundHidden}
        onChange={handleHiddenChange}
      />
    </div>
  );
};
