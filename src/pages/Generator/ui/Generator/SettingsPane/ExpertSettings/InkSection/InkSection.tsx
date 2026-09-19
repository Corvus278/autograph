import { ColorInput } from '@shared/ui/ColorInput';
import type { FC } from 'react';

import { selectPageRecipe } from '../../../../../model/recipeSelectors';
import { useGeneratorStore } from '../../../../../model/useGeneratorStore';

const CUSTOM_INK_KEY = 'customInk';

/**
 * Произвольный цвет чернил. Пока он не задан, поле показывает цвет, которым
 * рисует рецепт, — от него удобно отталкиваться, — а первая правка переводит
 * чернила на свой цвет.
 *
 * Правки склеиваются в один шаг истории: системная палитра шлёт значение на
 * каждое движение курсора.
 */
export const InkSection: FC = () => {
  const color = useGeneratorStore((state) => {
    const { ink } = state;

    return ink.kind === 'custom' ? ink.color : selectPageRecipe(state, 1).inkColor;
  });
  const commit = useGeneratorStore((state) => {
    return state.commit;
  });

  const handleColorChange = (value: string) => {
    commit({ ink: { kind: 'custom', color: value } }, { coalesceKey: CUSTOM_INK_KEY });
  };

  return (
    <ColorInput label="Свой цвет чернил" value={color} onChange={handleColorChange} />
  );
};
