import { Slider } from '@shared/ui/Slider';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import {
  BLOCK_ROTATE_RANGE,
  BLOCK_WIDTH_RANGE,
  BOTTOM_MARGIN_RANGE,
  FONT_SIZE_RANGE,
  LEFT_PADDING_RANGE,
  LINE_SPACING_RANGE,
  TOP_OFFSET_RANGE,
} from '../../../../config';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';

/**
 * Группа «Геометрия»: как блок текста лежит на листе.
 */
export const GeometryGroup: FC = () => {
  const {
    fontSize,
    blockWidth,
    lineSpacing,
    topOffset,
    leftPadding,
    blockRotate,
    bottomMargin,
    evenPageLeftPadding,
  } = useGeneratorStore(
    useShallow((state) => {
      return {
        fontSize: state.fontSize,
        blockWidth: state.blockWidth,
        lineSpacing: state.lineSpacing,
        topOffset: state.topOffset,
        leftPadding: state.leftPadding,
        blockRotate: state.blockRotate,
        bottomMargin: state.bottomMargin,
        evenPageLeftPadding: state.evenPageLeftPadding,
      };
    })
  );
  const setGeometry = useGeneratorStore((state) => {
    return state.setGeometry;
  });

  const handleFontSizeChange = (value: number) => {
    setGeometry({ fontSize: value });
  };

  const handleBlockWidthChange = (value: number) => {
    setGeometry({ blockWidth: value });
  };

  const handleLineSpacingChange = (value: number) => {
    setGeometry({ lineSpacing: value });
  };

  const handleTopOffsetChange = (value: number) => {
    setGeometry({ topOffset: value });
  };

  const handleLeftPaddingChange = (value: number) => {
    setGeometry({ leftPadding: value });
  };

  const handleBlockRotateChange = (value: number) => {
    setGeometry({ blockRotate: value });
  };

  const handleBottomMarginChange = (value: number) => {
    setGeometry({ bottomMargin: value });
  };

  const handleEvenPageLeftPaddingChange = (value: number) => {
    setGeometry({ evenPageLeftPadding: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <Slider
        label="Размер шрифта"
        value={fontSize}
        min={FONT_SIZE_RANGE.min}
        max={FONT_SIZE_RANGE.max}
        step={FONT_SIZE_RANGE.step}
        onChange={handleFontSizeChange}
      />

      <Slider
        label="Ширина блока"
        value={blockWidth}
        min={BLOCK_WIDTH_RANGE.min}
        max={BLOCK_WIDTH_RANGE.max}
        step={BLOCK_WIDTH_RANGE.step}
        onChange={handleBlockWidthChange}
      />

      <Slider
        label="Межстрочный интервал"
        value={lineSpacing}
        min={LINE_SPACING_RANGE.min}
        max={LINE_SPACING_RANGE.max}
        step={LINE_SPACING_RANGE.step}
        onChange={handleLineSpacingChange}
      />

      <Slider
        label="Вертикальный сдвиг"
        value={topOffset}
        min={TOP_OFFSET_RANGE.min}
        max={TOP_OFFSET_RANGE.max}
        step={TOP_OFFSET_RANGE.step}
        onChange={handleTopOffsetChange}
      />

      <Slider
        label="Левый отступ"
        value={leftPadding}
        min={LEFT_PADDING_RANGE.min}
        max={LEFT_PADDING_RANGE.max}
        step={LEFT_PADDING_RANGE.step}
        onChange={handleLeftPaddingChange}
      />

      <Slider
        label="Поворот блока"
        value={blockRotate}
        min={BLOCK_ROTATE_RANGE.min}
        max={BLOCK_ROTATE_RANGE.max}
        step={BLOCK_ROTATE_RANGE.step}
        onChange={handleBlockRotateChange}
      />

      <Slider
        label="Высота нижнего поля"
        value={bottomMargin}
        min={BOTTOM_MARGIN_RANGE.min}
        max={BOTTOM_MARGIN_RANGE.max}
        step={BOTTOM_MARGIN_RANGE.step}
        onChange={handleBottomMarginChange}
      />

      <Slider
        label="Отступ чётных страниц"
        value={evenPageLeftPadding}
        min={LEFT_PADDING_RANGE.min}
        max={LEFT_PADDING_RANGE.max}
        step={LEFT_PADDING_RANGE.step}
        onChange={handleEvenPageLeftPaddingChange}
      />
    </div>
  );
};
