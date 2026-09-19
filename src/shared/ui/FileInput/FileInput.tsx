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
        className="text-fg-muted file:bg-surface-raised file:text-fg hover:file:bg-border focus-visible:outline-focus cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:px-3 file:py-1.5 file:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      />

      {error ? (
        <p id={errorId} className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
};
