import { Button } from '@shared/ui/Button';
import type { FC } from 'react';

import { useExportPage } from '../../../model/useExportPage';

import { BatchBar } from './BatchBar';
import type { SaveBarProps } from './SaveBar.types';

/**
 * Действия сохранения: текущая страница отдельным файлом и вся пачка архивом.
 *
 * Два разных действия, а не одно с переключателем: пачку пользователь заказывает
 * редко и ждёт её долго, а текущую страницу сохраняет по ходу подбора настроек.
 */
export const SaveBar: FC<SaveBarProps> = (props) => {
  const { plan } = props;
  const { error, isSaving, save } = useExportPage(plan);

  const handleSaveClick = () => {
    void save();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex items-center gap-2">
        <Button variant="primary" isDisabled={isSaving} onClick={handleSaveClick}>
          {isSaving ? 'Сохраняю…' : 'Сохранить страницу'}
        </Button>

        <BatchBar plan={plan} />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
};
