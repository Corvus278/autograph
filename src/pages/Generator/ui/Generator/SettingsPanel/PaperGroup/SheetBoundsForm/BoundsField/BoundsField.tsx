import { Label } from '@shared/ui/Label';
import type { ChangeEvent, FC } from 'react';
import { useId } from 'react';

import type { BoundsFieldProps } from './BoundsField.types';

/**
 * Поле отступа листа от края кадра в пикселях фотографии. Нижняя граница поля
 * не держит ввод: отрицательный отступ отвергает перемер с сообщением, а не
 * молчаливая подрезка значения.
 */
export const BoundsField: FC<BoundsFieldProps> = (props) => {
  const { label, value, onChange } = props;
  const controlId = useId();

  const handleValueChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={controlId}>{label}</Label>

      <input
        id={controlId}
        type="number"
        step={1}
        value={value}
        onChange={handleValueChange}
        className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
      />
    </div>
  );
};
