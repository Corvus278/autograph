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
        className="resize-y rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400"
      />
    </div>
  );
};
