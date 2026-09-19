import type { RadioGroupOption } from '@shared/ui/RadioGroup';
import { RadioGroup } from '@shared/ui/RadioGroup';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { findFamily, mergeFamilySheets } from '../../../../../model/paperSelectors';
import { useGeneratorStore } from '../../../../../model/useGeneratorStore';

/**
 * Значение «не закреплено»: экземпляры по страницам раздаёт рецепт. Не пустая
 * строка — Radix не отмечает вариант с пустым значением.
 */
const AUTO_VALUE = 'auto';

const AUTO_OPTION: RadioGroupOption = { value: AUTO_VALUE, label: 'Авто — по рецепту' };

/**
 * Закрепление экземпляра листа: выбранный лист встаёт на все страницы, «Авто»
 * возвращает раздачу рецепту. Список — экземпляры выбранной семьи вместе со
 * своими листами: чужие семьи рецепт этой семье не выдаёт.
 */
export const SheetPinSection: FC = () => {
  const { presetFamilies, userSheets, familyId, sheetId, isSheetPinned } =
    useGeneratorStore(
      useShallow((state) => {
        return {
          presetFamilies: state.presetFamilies,
          userSheets: state.userSheets,
          familyId: state.familyId,
          sheetId: state.sheetId,
          isSheetPinned: state.isSheetPinned,
        };
      })
    );
  const selectSheet = useGeneratorStore((state) => {
    return state.selectSheet;
  });
  const commit = useGeneratorStore((state) => {
    return state.commit;
  });

  const family = findFamily(mergeFamilySheets(presetFamilies, userSheets), familyId);
  const options = [
    AUTO_OPTION,
    ...(family?.sheets || []).map(({ id, label }) => {
      return { value: id, label };
    }),
  ];

  const handleSheetChange = (value: string) => {
    if (value === AUTO_VALUE) {
      commit({ isSheetPinned: false });

      return;
    }

    selectSheet(value);
  };

  return (
    <RadioGroup
      label="Экземпляр листа"
      value={isSheetPinned ? sheetId : AUTO_VALUE}
      options={options}
      onChange={handleSheetChange}
    />
  );
};
