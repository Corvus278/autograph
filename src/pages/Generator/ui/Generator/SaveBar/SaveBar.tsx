import { Button } from '@shared/ui/Button';
import type { FC } from 'react';

import { useExportPage } from '../../../model/useExportPage';

import type { SaveBarProps } from './SaveBar.types';

/**
 * Кнопка сохранения и сообщение об ошибке отрисовки.
 */
export const SaveBar: FC<SaveBarProps> = (props) => {
  const { pageRef } = props;
  const { error, isSaving, save } = useExportPage(pageRef);

  const handleSaveClick = () => {
    void save();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <Button variant="primary" isDisabled={isSaving} onClick={handleSaveClick}>
        {isSaving ? 'Сохраняю…' : 'Сохранить PNG'}
      </Button>

      {error ? (
        <p role="alert" className="text-sm text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
};
