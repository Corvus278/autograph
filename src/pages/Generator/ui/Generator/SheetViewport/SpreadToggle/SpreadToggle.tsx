import { SegmentedControl } from '@shared/ui/SegmentedControl';
import type { FC } from 'react';

import { useGeneratorStore } from '../../../../model/useGeneratorStore';

const SINGLE_VALUE = 'single';
const SPREAD_VALUE = 'spread';

const OPTIONS = [
  { value: SINGLE_VALUE, label: 'Страница' },
  { value: SPREAD_VALUE, label: 'Разворот' },
];

/**
 * Переключатель «по одной странице / разворотом». Стоит рядом с панелью
 * масштаба, а не внутри неё: обе ходят по стрелкам, и вложенный роуминг
 * фокуса перехватывал бы стрелки у панели.
 */
export const SpreadToggle: FC = () => {
  const isSpread = useGeneratorStore((state) => {
    return state.isSpread;
  });
  const setIsSpread = useGeneratorStore((state) => {
    return state.setIsSpread;
  });

  const handleViewChange = (value: string) => {
    setIsSpread(value === SPREAD_VALUE);
  };

  return (
    <SegmentedControl
      label="Вид"
      value={isSpread ? SPREAD_VALUE : SINGLE_VALUE}
      options={OPTIONS}
      onChange={handleViewChange}
    />
  );
};
