import { Button } from '@shared/ui/Button';
import { Slider } from '@shared/ui/Slider';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { ParameterRange } from '../../../../config';
import { BOTTOM_MARGIN_RANGE } from '../../../../config';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

/**
 * Границы поправок. Слайдеры правят не саму геометрию, а дельту поверх
 * вычисленной из разлиновки, поэтому диапазоны симметричны нулю и узкие:
 * широкий диапазон здесь означал бы, что автокалибровка промахнулась, и чинить
 * надо её, а не двигать блок руками.
 */
const FONT_SIZE_CORRECTION_RANGE: ParameterRange = { min: -20, max: 20, step: 1 };

const LINE_SPACING_CORRECTION_RANGE: ParameterRange = { min: -20, max: 20, step: 1 };

const OFFSET_CORRECTION_RANGE: ParameterRange = { min: -100, max: 100, step: 1 };

const BLOCK_WIDTH_CORRECTION_RANGE: ParameterRange = { min: -200, max: 200, step: 1 };

/**
 * Группа «Геометрия»: поправка к тому, как блок текста лёг на разлиновку.
 * Дельты, а не значения: смена семьи и экземпляра пересчитывает геометрию
 * заново, и поправка переезжает на новый расчёт.
 */
export const GeometryGroup: FC = () => {
  const { correction, bottomMargin } = useGeneratorStore(
    useShallow((state) => {
      return {
        correction: state.geometryCorrection,
        bottomMargin: state.bottomMargin,
      };
    })
  );
  const setGeometry = useGeneratorStore((state) => {
    return state.setGeometry;
  });
  const setGeometryCorrection = useGeneratorStore((state) => {
    return state.setGeometryCorrection;
  });
  const resetGeometryCorrection = useGeneratorStore((state) => {
    return state.resetGeometryCorrection;
  });

  const handleFontSizeChange = (value: number) => {
    setGeometryCorrection({ fontSizePx: value });
  };

  const handleBlockWidthChange = (value: number) => {
    setGeometryCorrection({ blockWidth: value });
  };

  const handleLineSpacingChange = (value: number) => {
    setGeometryCorrection({ lineSpacing: value });
  };

  const handleTopOffsetChange = (value: number) => {
    setGeometryCorrection({ topOffset: value });
  };

  const handleLeftPaddingChange = (value: number) => {
    setGeometryCorrection({ leftPadding: value });
  };

  const handleBottomMarginChange = (value: number) => {
    setGeometry({ bottomMargin: value });
  };

  const handleResetClick = () => {
    resetGeometryCorrection();
  };

  return (
    <div className="flex flex-col gap-4">
      <Slider
        label="Размер шрифта"
        value={correction.fontSizePx}
        min={FONT_SIZE_CORRECTION_RANGE.min}
        max={FONT_SIZE_CORRECTION_RANGE.max}
        step={FONT_SIZE_CORRECTION_RANGE.step}
        onChange={handleFontSizeChange}
      />

      <Slider
        label="Ширина блока"
        value={correction.blockWidth}
        min={BLOCK_WIDTH_CORRECTION_RANGE.min}
        max={BLOCK_WIDTH_CORRECTION_RANGE.max}
        step={BLOCK_WIDTH_CORRECTION_RANGE.step}
        onChange={handleBlockWidthChange}
      />

      <Slider
        label="Межстрочный интервал"
        value={correction.lineSpacing}
        min={LINE_SPACING_CORRECTION_RANGE.min}
        max={LINE_SPACING_CORRECTION_RANGE.max}
        step={LINE_SPACING_CORRECTION_RANGE.step}
        onChange={handleLineSpacingChange}
      />

      <Slider
        label="Вертикальный сдвиг"
        value={correction.topOffset}
        min={OFFSET_CORRECTION_RANGE.min}
        max={OFFSET_CORRECTION_RANGE.max}
        step={OFFSET_CORRECTION_RANGE.step}
        onChange={handleTopOffsetChange}
      />

      <Slider
        label="Левый отступ"
        value={correction.leftPadding}
        min={OFFSET_CORRECTION_RANGE.min}
        max={OFFSET_CORRECTION_RANGE.max}
        step={OFFSET_CORRECTION_RANGE.step}
        onChange={handleLeftPaddingChange}
      />

      <Slider
        label="Высота нижнего поля"
        value={bottomMargin}
        min={BOTTOM_MARGIN_RANGE.min}
        max={BOTTOM_MARGIN_RANGE.max}
        step={BOTTOM_MARGIN_RANGE.step}
        onChange={handleBottomMarginChange}
      />

      <Button onClick={handleResetClick}>Сбросить поправку</Button>
    </div>
  );
};
