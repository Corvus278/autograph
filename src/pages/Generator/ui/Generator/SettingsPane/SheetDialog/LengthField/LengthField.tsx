import { Label } from '@shared/ui/Label';
import type { ChangeEvent, FC } from 'react';
import { useId } from 'react';

import type { LengthFieldProps } from './LengthField.types';

/**
 * Поле длины в пикселях фотографии листа.
 */
export const LengthField: FC<LengthFieldProps> = (props) => {
  const { label, value, min, onChange } = props;
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
        min={min}
        step={1}
        value={value}
        className="rounded-md border border-border-strong bg-surface px-2 py-1.5 text-sm text-fg tabular-nums focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        onChange={handleValueChange}
      />
    </div>
  );
};
