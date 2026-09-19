import { Swatch, SwatchGroup } from '@shared/ui/Swatch';
import type { FC } from 'react';
import { useId } from 'react';

import { INK_PALETTE } from '../../../../lib/recipe';
import type { GeneratorInk } from '../../../../model/generator.types';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

/**
 * Значение свотча «Авто». Идентификаторы тонов палитры с ним не совпадают.
 */
const AUTO_VALUE = 'auto';

/**
 * Заливка свотча «Авто»: нейтральная, а не цвет рецепта — иначе «Авто»
 * выглядел бы тоном палитры и путался с ним.
 */
const AUTO_SWATCH_COLOR = 'var(--color-surface-raised)';

/**
 * Какой свотч отмечен при данном выборе чернил.
 *
 * @param ink — выбор чернил
 * @returns значение свотча; пустая строка — произвольный цвет, свотча у него нет
 */
const toSwatchValue = (ink: GeneratorInk): string => {
  switch (ink.kind) {
    case 'auto': {
      return AUTO_VALUE;
    }

    case 'tone': {
      return ink.toneId;
    }

    case 'custom': {
      return '';
    }

    default: {
      throw new Error(`Неизвестный выбор чернил: ${JSON.stringify(ink)}`);
    }
  }
};

/**
 * Выбор чернил: «Авто» и тоны палитры реальных ручек. Название тона — в
 * подсказке и в доступном имени свотча. Произвольный цвет задаётся в
 * экспертном режиме; пока он выбран, здесь не отмечен ни один свотч.
 *
 * Знак на свотчах белый: все тоны палитры тёмные, самый светлый
 * (`#4b2e83` с разбросом рецепта) даёт с белым около 9:1.
 */
export const InkPicker: FC = () => {
  const titleId = useId();
  const ink = useGeneratorStore((state) => {
    return state.ink;
  });
  const setInk = useGeneratorStore((state) => {
    return state.setInk;
  });

  const handleSwatchChange = (value: string) => {
    setInk(value === AUTO_VALUE ? { kind: 'auto' } : { kind: 'tone', toneId: value });
  };

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3
        id={titleId}
        className="text-xs font-semibold tracking-wider text-fg-muted uppercase"
      >
        Чернила
      </h3>

      <SwatchGroup
        label="Цвет чернил"
        value={toSwatchValue(ink)}
        onChange={handleSwatchChange}
      >
        <Swatch value={AUTO_VALUE} label="Авто" color={AUTO_SWATCH_COLOR}>
          А
        </Swatch>

        {INK_PALETTE.map(({ id, label, color }) => {
          return <Swatch key={id} value={id} label={label} color={color} />;
        })}
      </SwatchGroup>
    </section>
  );
};
