import { Button } from '@shared/ui/Button';
import type { FC } from 'react';

import { useBatchExport } from '../../../../model/useBatchExport';

import type { BatchBarProps } from './BatchBar.types';

/**
 * Выгрузка всей пачки: кнопка запуска, прогресс с числом готовых страниц и
 * отмена.
 */
export const BatchBar: FC<BatchBarProps> = (props) => {
  const { plan } = props;
  const { progress, error, isRunning, start, cancel } = useBatchExport(plan);

  const handleBatchClick = () => {
    void start();
  };

  const handleCancelClick = () => {
    cancel();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <Button variant="secondary" isDisabled={isRunning} onClick={handleBatchClick}>
          Скачать все страницы
        </Button>

        {isRunning ? (
          <Button variant="ghost" onClick={handleCancelClick}>
            Отменить
          </Button>
        ) : null}
      </div>

      {progress ? (
        <p role="status" className="text-sm text-zinc-400">
          Готово {progress.completed} из {progress.total}
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
};
