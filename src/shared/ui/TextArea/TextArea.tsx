import { cx } from '@shared/lib/styles';
import type { ChangeEvent, FC } from 'react';
import { useId } from 'react';

import { Label } from '../Label';

import type { TextAreaProps } from './TextArea.types';

export const TextArea: FC<TextAreaProps> = (props) => {
  const { label, value, onChange, rows = 6, className } = props;
  const controlId = useId();

  const handleTextInput = (event: ChangeEvent<HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <Label htmlFor={controlId}>{label}</Label>

      <textarea
        id={controlId}
        value={value}
        rows={rows}
        onChange={handleTextInput}
        className="border-border-strong bg-surface-raised text-fg focus-visible:outline-focus resize-y rounded-md border px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      />
    </div>
  );
};
