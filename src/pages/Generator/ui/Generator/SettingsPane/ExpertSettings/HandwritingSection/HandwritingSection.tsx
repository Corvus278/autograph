import { Checkbox } from '@shared/ui/Checkbox';
import { ValueSlider } from '@shared/ui/ValueSlider';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { FREQUENCY_RANGE } from '../../../../../config';
import { formatLetterFrequency, formatWordFrequency } from '../../../../../lib/format';
import { useGeneratorStore } from '../../../../../model/useGeneratorStore';

import type { DistortionOption } from './HandwritingSection.types';

/**
 * Подписи переключателей в том порядке, в каком они показываются: от искажений
 * слова к искажениям строки.
 */
const DISTORTION_OPTIONS: DistortionOption[] = [
  { flag: 'isWordRotated', label: 'Случайный поворот слова' },
  { flag: 'isWordSkewed', label: 'Случайный наклон слова' },
  { flag: 'isWordShifted', label: 'Случайный сдвиг слова по вертикали' },
  { flag: 'isLetterSpacingRandom', label: 'Случайное расстояние между буквами' },
  { flag: 'isLetterFontRandom', label: 'Случайная подмена шрифта буквы' },
  { flag: 'isLineRotated', label: 'Съезд линий' },
  { flag: 'isLineShifted', label: 'Случайный сдвиг строки' },
];

const WORD_FREQUENCY_KEY = 'wordFrequency';

const LETTER_FREQUENCY_KEY = 'letterFrequency';

/**
 * Отдельные искажения почерка, их частоты и вариативность контуров. Любая
 * правка здесь переводит уровень реализма в «Свой».
 *
 * Частоты подписаны словами: у слова число — «каждое N-е», у буквы — «сколько
 * букв», и голые числа двух слайдеров читались бы в разные стороны.
 */
export const HandwritingSection: FC = () => {
  const { flags, hasContourVariance, wordFrequency, letterFrequency } = useGeneratorStore(
    useShallow((state) => {
      return {
        flags: state.realism.flags,
        hasContourVariance: state.realism.hasContourVariance,
        wordFrequency: state.realism.wordFrequency,
        letterFrequency: state.realism.letterFrequency,
      };
    })
  );
  const toggleDistortion = useGeneratorStore((state) => {
    return state.toggleDistortion;
  });
  const setContourVariance = useGeneratorStore((state) => {
    return state.setContourVariance;
  });
  const preview = useGeneratorStore((state) => {
    return state.preview;
  });
  const commit = useGeneratorStore((state) => {
    return state.commit;
  });

  const handleContourVarianceChange = (isChecked: boolean) => {
    setContourVariance(isChecked);
  };

  const handleWordFrequencyChange = (value: number) => {
    preview((state) => {
      return { realism: { ...state.realism, wordFrequency: value } };
    });
  };

  const handleWordFrequencyCommit = (value: number) => {
    commit(
      (state) => {
        return { realism: { ...state.realism, wordFrequency: value } };
      },
      { coalesceKey: WORD_FREQUENCY_KEY }
    );
  };

  const handleLetterFrequencyChange = (value: number) => {
    preview((state) => {
      return { realism: { ...state.realism, letterFrequency: value } };
    });
  };

  const handleLetterFrequencyCommit = (value: number) => {
    commit(
      (state) => {
        return { realism: { ...state.realism, letterFrequency: value } };
      },
      { coalesceKey: LETTER_FREQUENCY_KEY }
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        {DISTORTION_OPTIONS.map(({ flag, label }) => {
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

      <ValueSlider
        label="Как часто искажать слово"
        value={wordFrequency}
        min={FREQUENCY_RANGE.min}
        max={FREQUENCY_RANGE.max}
        step={FREQUENCY_RANGE.step}
        formatValue={formatWordFrequency}
        onChange={handleWordFrequencyChange}
        onValueCommit={handleWordFrequencyCommit}
      />

      <ValueSlider
        label="Сколько букв искажать"
        value={letterFrequency}
        min={FREQUENCY_RANGE.min}
        max={FREQUENCY_RANGE.max}
        step={FREQUENCY_RANGE.step}
        formatValue={formatLetterFrequency}
        onChange={handleLetterFrequencyChange}
        onValueCommit={handleLetterFrequencyCommit}
      />
    </div>
  );
};
