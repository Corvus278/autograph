import { Button } from '@shared/ui/Button';
import type { FC } from 'react';

import type { UserSheetListProps } from './UserSheetList.types';

/**
 * Свои листы текущей семьи: список с удалением. Подпись листа входит в имя
 * кнопки — иначе на странице оказывается несколько кнопок «Удалить», и ни одну
 * нельзя назвать вслух.
 */
export const UserSheetList: FC<UserSheetListProps> = (props) => {
  const { sheets, onRemove } = props;

  if (sheets.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-zinc-300">Свои листы</span>

      <ul className="flex flex-col gap-2">
        {sheets.map((sheet) => {
          const handleRemoveClick = () => {
            onRemove(sheet.id);
          };

          return (
            <li key={sheet.id} className="flex items-center justify-between gap-3">
              <span className="truncate text-sm text-zinc-400">{sheet.label}</span>

              <Button variant="ghost" onClick={handleRemoveClick}>
                Удалить «{sheet.label}»
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
