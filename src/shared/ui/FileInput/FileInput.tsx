import { cx } from '@shared/lib/styles';
import type { ChangeEvent, FC } from 'react';
import { useId, useRef, useState } from 'react';

import { buttonVariants } from '../Button';
import { Label } from '../Label';

import type { FileInputProps } from './FileInput.types';

/**
 * Выбор файла: видимая кнопка и имя выбранного файла, а родное поле скрыто.
 * Родной вид поля рисует браузер на языке системы («Choose File / No file
 * chosen») и не берёт токены темы, поэтому поле только принимает файл, а
 * открывает диалог кнопка. Клавиатура и фокус — её собственные: Enter и
 * пробел нажимают кнопку, скрытое поле в порядок фокуса не попадает.
 *
 * Имя кнопки — подпись контрола, имя файла и ошибка — её описание: так
 * экранный диктор называет, что за файл просят и что уже выбрано.
 */
export const FileInput: FC<FileInputProps> = (props) => {
  const { label, accept, onSelect, error = null, isDisabled = false, className } = props;
  const buttonId = useId();
  const statusId = useId();
  const errorId = useId();
  const fieldRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleButtonClick = () => {
    fieldRef.current?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) {
      setFileName(file.name);
      onSelect(file);
    }

    /**
     * Тот же файл должен выбираться повторно — например, после ошибки.
     */
    event.target.value = '';
  };

  const describedBy = error ? `${statusId} ${errorId}` : statusId;

  return (
    <div className={cx('flex flex-col gap-1.5', className)}>
      <Label htmlFor={buttonId}>{label}</Label>

      <div className="flex min-w-0 items-center gap-3">
        <button
          id={buttonId}
          type="button"
          disabled={isDisabled}
          aria-describedby={describedBy}
          onClick={handleButtonClick}
          className={cx(buttonVariants({ variant: 'secondary' }), 'shrink-0 px-3 py-1.5')}
        >
          Выбрать файл
        </button>

        <span id={statusId} className="min-w-0 truncate text-sm text-fg-muted">
          {fileName || 'Файл не выбран'}
        </span>
      </div>

      <input
        ref={fieldRef}
        type="file"
        accept={accept}
        disabled={isDisabled}
        hidden
        onChange={handleFileChange}
      />

      {error ? (
        <p id={errorId} className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
};
