import { cx } from '@shared/lib/styles';
import type { ChangeEvent, FC } from 'react';
import { useId } from 'react';

import './ColorInput.css';

import { Label } from '../Label';

import type { ColorInputProps } from './ColorInput.types';

export const ColorInput: FC<ColorInputProps> = (props) => {
  const { label, value, onChange, isDisabled = false, className } = props;
  const controlId = useId();

  const handleColorChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={cx('flex items-center justify-between gap-3', className)}>
      <Label htmlFor={controlId}>{label}</Label>

      <div className="flex items-center gap-2">
        <span className="text-sm text-fg-muted uppercase">{value}</span>

        <input
          id={controlId}
          type="color"
          value={value}
          disabled={isDisabled}
          onChange={handleColorChange}
          className="color-input h-8 w-12 cursor-pointer rounded-md border border-border-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
    </div>
  );
};
