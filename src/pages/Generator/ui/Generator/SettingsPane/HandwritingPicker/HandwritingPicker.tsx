import * as RadixSelect from '@radix-ui/react-select';
import { FileInput } from '@shared/ui/FileInput';
import type { FC } from 'react';
import { useId } from 'react';
import { Link } from 'react-router';
import { useShallow } from 'zustand/react/shallow';

import type { HandwritingFont } from '../../../../config';
import { CUSTOM_FONT_FAMILY, HANDWRITING_FONTS } from '../../../../config';
import { useCustomFont } from '../../../../model/useCustomFont';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

/**
 * Пункт загруженного шрифта. Название своё, а не имя файла: семейство у
 * своего шрифта всегда одно, и в списке он один.
 */
const CUSTOM_FONT_OPTION: HandwritingFont = {
  family: CUSTOM_FONT_FAMILY,
  label: 'Свой шрифт',
};

/**
 * Выбор почерка: список, где каждое название написано своим шрифтом, рядом —
 * подключение своего `.ttf` и ссылка на инструкцию, как его сделать.
 *
 * Список собран на Radix Select напрямую, а не на `shared/ui/Select`: тому
 * пункт со своим начертанием не нужен ни в одном другом месте.
 *
 * Битый файл оставляет почерк прежним: шрифт становится активным только после
 * того, как браузер его разобрал, а ошибка показывается под полем файла.
 */
export const HandwritingPicker: FC = () => {
  const titleId = useId();
  const { fontFamily, customFontFamily } = useGeneratorStore(
    useShallow((state) => {
      return {
        fontFamily: state.fontFamily,
        customFontFamily: state.customFontFamily,
      };
    })
  );
  const setFontFamily = useGeneratorStore((state) => {
    return state.setFontFamily;
  });
  const customFont = useCustomFont();

  const options = customFontFamily
    ? [CUSTOM_FONT_OPTION, ...HANDWRITING_FONTS]
    : HANDWRITING_FONTS;
  const value = customFontFamily || fontFamily;

  const handleFontChange = (next: string) => {
    if (next === CUSTOM_FONT_FAMILY) {
      return;
    }

    /**
     * Свой шрифт перебивает встроенный, поэтому выбор из списка сначала
     * снимает его — иначе выбранный пункт не дошёл бы до страницы.
     */
    if (customFontFamily) {
      customFont.reset();
    }

    setFontFamily(next);
  };

  const handleFontFileSelect = (file: File) => {
    void customFont.load(file);
  };

  return (
    <div role="group" aria-labelledby={titleId} className="flex flex-col gap-2">
      <h3
        id={titleId}
        className="text-xs font-semibold tracking-wider text-fg-muted uppercase"
      >
        Почерк
      </h3>

      <RadixSelect.Root value={value} onValueChange={handleFontChange}>
        <RadixSelect.Trigger
          aria-labelledby={titleId}
          style={{ fontFamily: value }}
          className="flex cursor-pointer items-center justify-between gap-2 rounded-md border border-border-strong bg-surface-raised px-3 py-2 text-lg text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <RadixSelect.Value />

          <RadixSelect.Icon className="text-sm text-fg-muted">▾</RadixSelect.Icon>
        </RadixSelect.Trigger>

        <RadixSelect.Portal>
          <RadixSelect.Content className="z-50 overflow-hidden rounded-md border border-border-strong bg-surface-raised text-fg shadow-popover">
            <RadixSelect.Viewport className="max-h-72 p-1">
              {options.map(({ family, label }) => {
                return (
                  <RadixSelect.Item
                    key={family}
                    value={family}
                    style={{ fontFamily: family }}
                    className="cursor-pointer rounded-sm px-3 py-1.5 text-lg text-fg-muted outline-hidden data-highlighted:bg-border data-highlighted:text-fg data-[state=checked]:text-fg"
                  >
                    <RadixSelect.ItemText>{label}</RadixSelect.ItemText>
                  </RadixSelect.Item>
                );
              })}
            </RadixSelect.Viewport>
          </RadixSelect.Content>
        </RadixSelect.Portal>
      </RadixSelect.Root>

      <FileInput
        label="Свой шрифт (.ttf)"
        accept=".ttf,font/ttf"
        error={customFont.error}
        onSelect={handleFontFileSelect}
      />

      <p className="text-xs text-fg-muted">
        Нет файла своего почерка?{' '}
        <Link
          to="/create-font"
          className="rounded-sm text-fg underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          Как создать свой шрифт
        </Link>
      </p>
    </div>
  );
};
