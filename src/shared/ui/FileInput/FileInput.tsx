import { cx } from '@shared/lib/styles';
import type { ChangeEvent, FC } from 'react';
import { useId } from 'react';

import { Label } from '../Label';

import type { FileInputProps } from './FileInput.types';

export const FileInput: FC<FileInputProps> = (props) => {
  const { label, accept, onSelect, error = null, isDisabled = false, className } = props;
  const controlId = useId();
  const errorId = useId();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      onSelect(file);
    }

    // Один и тот же файл должен выбираться повторно — например, после ошибки.
    event.target.value = '';
  };

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <Label htmlFor={controlId}>{label}</Label>

      <input
        id={controlId}
        type="file"
        accept={accept}
        disabled={isDisabled}
        aria-describedby={error ? errorId : undefined}
        onChange={handleFileChange}
        className="cursor-pointer text-sm text-zinc-400 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:text-zinc-100 hover:file:bg-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-400 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {error ? (
        <p id={errorId} className="text-xs text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
};
