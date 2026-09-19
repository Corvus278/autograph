import { Button } from '@shared/ui/Button';
import { ColorInput } from '@shared/ui/ColorInput';
import { FileInput } from '@shared/ui/FileInput';
import { Select } from '@shared/ui/Select';
import { TextArea } from '@shared/ui/TextArea';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { HANDWRITING_FONTS } from '../../../../config';
import { resolveInkColor, selectRunRecipe } from '../../../../model/recipeSelectors';
import { useCustomFont } from '../../../../model/useCustomFont';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

const FONT_OPTIONS = HANDWRITING_FONTS.map(({ family, label }) => {
  return { value: family, label };
});

/**
 * Группа «Текст и шрифт»: что писать и чем.
 */
export const TextGroup: FC = () => {
  const { text, fontFamily, customFontFamily, inkColor } = useGeneratorStore(
    useShallow((state) => {
      return {
        text: state.text,
        fontFamily: state.fontFamily,
        customFontFamily: state.customFontFamily,
        /**
         * В режиме «Авто» показывается цвет рецепта: тот, которым страница и
         * нарисована.
         */
        inkColor: resolveInkColor(state.ink) || selectRunRecipe(state, 1)?.inkColor || '',
      };
    })
  );
  const setText = useGeneratorStore((state) => {
    return state.setText;
  });
  const setFontFamily = useGeneratorStore((state) => {
    return state.setFontFamily;
  });
  const setInk = useGeneratorStore((state) => {
    return state.setInk;
  });
  const customFont = useCustomFont();

  const handleTextInput = (value: string) => {
    setText(value);
  };

  const handleFontChange = (value: string) => {
    setFontFamily(value);
  };

  const handleInkColorChange = (value: string) => {
    setInk({ kind: 'custom', color: value });
  };

  const handleFontFileSelect = (file: File) => {
    void customFont.load(file);
  };

  const handleResetFontClick = () => {
    customFont.reset();
  };

  return (
    <div className="flex flex-col gap-4">
      <TextArea label="Текст" value={text} onChange={handleTextInput} />

      <Select
        label="Шрифт"
        value={fontFamily}
        options={FONT_OPTIONS}
        onChange={handleFontChange}
      />

      <FileInput
        label="Свой шрифт (.ttf)"
        accept=".ttf,font/ttf"
        error={customFont.error}
        onSelect={handleFontFileSelect}
      />

      {customFontFamily ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-zinc-400">Активен свой шрифт</span>

          <Button onClick={handleResetFontClick}>Вернуть из списка</Button>
        </div>
      ) : null}

      <ColorInput label="Цвет чернил" value={inkColor} onChange={handleInkColorChange} />
    </div>
  );
};
