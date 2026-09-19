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

const AUTO_OPTION: RadioGroupOption = {
  value: AUTO_VALUE,
  label: 'Разные листы на страницах',
};

/**
 * Закрепление экземпляра листа: выбранный лист встаёт на все страницы, первый
 * пункт возвращает раздачу рецепту. Подсказка видна всегда, а не во всплывашке:
 * без неё пункт не объясняет, откуда берутся листы и когда они меняются. Список — экземпляры выбранной семьи вместе со
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
    <div className="flex flex-col gap-2">
      <RadioGroup
        label="Экземпляр листа"
        value={isSheetPinned ? sheetId : AUTO_VALUE}
        options={options}
        onChange={handleSheetChange}
      />

      <p className="text-xs text-fg-muted">
        «Разные листы на страницах»: каждой странице — свой снимок из набора семьи. Какой
        — меняется при «Перегенерировать». Выбранный лист встаёт на все страницы.
      </p>
    </div>
  );
};
