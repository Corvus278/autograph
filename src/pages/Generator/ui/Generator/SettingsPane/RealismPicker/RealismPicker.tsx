import type { SegmentedControlOption } from '@shared/ui/SegmentedControl';
import { SegmentedControl } from '@shared/ui/SegmentedControl';
import type { FC } from 'react';
import { useId } from 'react';

import { REALISM_LEVELS } from '../../../../config';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

/**
 * Значение состояния «Свой» — уровень реализма, правленный по отдельности.
 */
const CUSTOM_LEVEL = 'custom';

const LEVEL_OPTIONS: SegmentedControlOption[] = REALISM_LEVELS.map(({ id, label }) => {
  return { value: id, label };
});

/**
 * «Свой» стоит в ряду только пока он выбран: сам по себе он не ступень, и
 * выбирать его нечего — он появляется после правки в экспертном режиме.
 */
const CUSTOM_OPTIONS: SegmentedControlOption[] = [
  ...LEVEL_OPTIONS,
  { value: CUSTOM_LEVEL, label: 'Свой' },
];

/**
 * Выбор уровня реализма: ступени от ровного письма к небрежному. Выбор ступени
 * перезаписывает отдельные настройки её значениями.
 */
export const RealismPicker: FC = () => {
  const titleId = useId();
  const level = useGeneratorStore((state) => {
    return state.realism.level;
  });
  const selectRealismLevel = useGeneratorStore((state) => {
    return state.selectRealismLevel;
  });

  const handleLevelChange = (value: string) => {
    const next = REALISM_LEVELS.find(({ id }) => {
      return id === value;
    });

    if (next) {
      selectRealismLevel(next.id);
    }
  };

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3
        id={titleId}
        className="text-xs font-semibold tracking-wider text-fg-muted uppercase"
      >
        Реализм
      </h3>

      <SegmentedControl
        label="Реализм"
        value={level}
        options={level === CUSTOM_LEVEL ? CUSTOM_OPTIONS : LEVEL_OPTIONS}
        onChange={handleLevelChange}
      />
    </section>
  );
};
