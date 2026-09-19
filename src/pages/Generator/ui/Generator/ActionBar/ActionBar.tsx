import { Button } from '@shared/ui/Button';
import type { FC } from 'react';

import { useBatchExport } from '../../../model/useBatchExport';
import { useExportPage } from '../../../model/useExportPage';
import { useGeneratorStore } from '../../../model/useGeneratorStore';

import type { ActionBarProps } from './ActionBar.types';

/**
 * Полоса главных действий: новый прогон, текущая страница файлом и вся пачка
 * архивом. Прогресс пачки и её отмена — здесь же, чтобы не искать их по
 * экрану.
 *
 * Сохранение и выгрузка — два действия, а не одно с переключателем: пачку
 * заказывают редко и ждут долго, а текущую страницу сохраняют по ходу
 * подбора настроек.
 *
 * Без текста сохранять нечего: кнопки недоступны, и рядом написано почему —
 * недоступная кнопка без объяснения выглядит сломанной.
 */
export const ActionBar: FC<ActionBarProps> = (props) => {
  const { plan } = props;
  const isTextEmpty = useGeneratorStore((state) => {
    return state.text.trim() === '';
  });
  const startNewRun = useGeneratorStore((state) => {
    return state.startNewRun;
  });
  const pageExport = useExportPage(plan);
  const batchExport = useBatchExport(plan);
  const { progress, isRunning } = batchExport;
  const error = pageExport.error || batchExport.error;

  const handleRegenerateClick = () => {
    startNewRun();
  };

  const handleSaveClick = () => {
    void pageExport.save();
  };

  const handleBatchClick = () => {
    void batchExport.start();
  };

  const handleCancelClick = () => {
    batchExport.cancel();
  };

  return (
    <div className="flex w-full items-center gap-4">
      <Button variant="secondary" onClick={handleRegenerateClick}>
        Перегенерировать
      </Button>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 text-sm">
        {isTextEmpty ? (
          <p className="text-fg-muted">Введите текст, чтобы сохранить страницы</p>
        ) : null}

        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}

        {progress ? (
          <p role="status" className="text-fg-muted tabular-nums">
            Готово {progress.completed} из {progress.total}
          </p>
        ) : null}

        {isRunning ? (
          <Button variant="ghost" onClick={handleCancelClick}>
            Отменить
          </Button>
        ) : null}
      </div>

      <Button
        variant="secondary"
        isDisabled={isTextEmpty || isRunning}
        onClick={handleBatchClick}
      >
        Скачать все
      </Button>

      <Button
        variant="primary"
        isDisabled={isTextEmpty || pageExport.isSaving}
        onClick={handleSaveClick}
      >
        {pageExport.isSaving ? 'Сохраняю…' : 'Сохранить страницу'}
      </Button>
    </div>
  );
};
