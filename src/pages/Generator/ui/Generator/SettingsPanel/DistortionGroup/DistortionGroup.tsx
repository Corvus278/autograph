import { Button } from '@shared/ui/Button';
import { Checkbox } from '@shared/ui/Checkbox';
import { Slider } from '@shared/ui/Slider';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FREQUENCY_RANGE } from '../../../../config';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

import type { DistortionOption } from './DistortionGroup.types';

/**
 * Подписи переключателей в том порядке, в каком они показываются: от искажений
 * слова к искажениям строки.
 */
const DISTORTION_LABELS: DistortionOption[] = [
  { flag: 'isWordRotated', label: 'Случайный поворот слова' },
  { flag: 'isWordSkewed', label: 'Случайный наклон слова' },
  { flag: 'isWordShifted', label: 'Случайный сдвиг слова по вертикали' },
  { flag: 'isLetterSpacingRandom', label: 'Случайное расстояние между буквами' },
  { flag: 'isLetterFontRandom', label: 'Случайная подмена шрифта буквы' },
  { flag: 'isLineRotated', label: 'Съезд линий' },
  { flag: 'isLineShifted', label: 'Случайный сдвиг строки' },
];

/**
 * Группа «Модификации почерка»: что именно делает набор неровным.
 */
export const DistortionGroup: FC = () => {
  const { flags, hasContourVariance, wordFrequency, letterFrequency } = useGeneratorStore(
    useShallow((state) => {
      return {
        flags: state.flags,
        hasContourVariance: state.hasContourVariance,
        wordFrequency: state.wordFrequency,
        letterFrequency: state.letterFrequency,
      };
    })
  );
  const toggleDistortion = useGeneratorStore((state) => {
    return state.toggleDistortion;
  });
  const setContourVariance = useGeneratorStore((state) => {
    return state.setContourVariance;
  });
  const setWordFrequency = useGeneratorStore((state) => {
    return state.setWordFrequency;
  });
  const setLetterFrequency = useGeneratorStore((state) => {
    return state.setLetterFrequency;
  });
  const regenerate = useGeneratorStore((state) => {
    return state.regenerate;
  });

  const handleContourVarianceChange = (isChecked: boolean) => {
    setContourVariance(isChecked);
  };

  const handleWordFrequencyChange = (value: number) => {
    setWordFrequency(value);
  };

  const handleLetterFrequencyChange = (value: number) => {
    setLetterFrequency(value);
  };

  const handleRegenerateClick = () => {
    regenerate();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {DISTORTION_LABELS.map(({ flag, label }) => {
          const handleFlagChange = () => {
            toggleDistortion(flag);
          };

          return (
            <Checkbox
              key={flag}
              label={label}
              isChecked={flags[flag]}
              onChange={handleFlagChange}
            />
          );
        })}
      </div>

      <Checkbox
        label="Вариативность контуров букв"
        isChecked={hasContourVariance}
        onChange={handleContourVarianceChange}
      />

      <Slider
        label="Как часто искажать слово"
        value={wordFrequency}
        min={FREQUENCY_RANGE.min}
        max={FREQUENCY_RANGE.max}
        step={FREQUENCY_RANGE.step}
        onChange={handleWordFrequencyChange}
      />

      <Slider
        label="Сколько букв искажать"
        value={letterFrequency}
        min={FREQUENCY_RANGE.min}
        max={FREQUENCY_RANGE.max}
        step={FREQUENCY_RANGE.step}
        onChange={handleLetterFrequencyChange}
      />

      <Button onClick={handleRegenerateClick}>Перегенерировать</Button>
    </div>
  );
};
