import { Button } from '@shared/ui/Button';
import { ValueSlider } from '@shared/ui/ValueSlider';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import type { ParameterRange } from '../../../../../config';
import { BOTTOM_MARGIN_RANGE } from '../../../../../config';
import { formatStepFraction } from '../../../../../lib/format';
import { useGeneratorStore } from '../../../../../model/useGeneratorStore';

import type { GeometrySliderOption } from './GeometrySection.types';

/**
 * Границы поправок в долях шага разлиновки. Слайдеры правят не саму геометрию,
 * а дельту поверх вычисленной из разлиновки, поэтому диапазоны симметричны
 * нулю и узкие: широкий диапазон здесь означал бы, что автокалибровка
 * промахнулась, и чинить надо её, а не двигать блок руками.
 *
 * Кегль и интервал — до четверти шага: кегль и так около шага, и больше
 * четверти уже меняет почерк, а не подгоняет его. Сдвиги — до двух шагов:
 * текст можно пересадить на соседние линии, но не увести с листа.
 */
const FONT_SIZE_CORRECTION_RANGE: ParameterRange = { min: -0.25, max: 0.25, step: 0.01 };

const LINE_SPACING_CORRECTION_RANGE: ParameterRange = {
  min: -0.25,
  max: 0.25,
  step: 0.01,
};

const OFFSET_CORRECTION_RANGE: ParameterRange = { min: -2, max: 2, step: 0.05 };

const BLOCK_WIDTH_CORRECTION_RANGE: ParameterRange = { min: -4, max: 4, step: 0.1 };

const GEOMETRY_SLIDERS: GeometrySliderOption[] = [
  { field: 'fontSizePx', label: 'Размер шрифта', range: FONT_SIZE_CORRECTION_RANGE },
  { field: 'blockWidth', label: 'Ширина блока', range: BLOCK_WIDTH_CORRECTION_RANGE },
  {
    field: 'lineSpacing',
    label: 'Межстрочный интервал',
    range: LINE_SPACING_CORRECTION_RANGE,
  },
  { field: 'topOffset', label: 'Вертикальный сдвиг', range: OFFSET_CORRECTION_RANGE },
  { field: 'leftPadding', label: 'Левый отступ', range: OFFSET_CORRECTION_RANGE },
];

const BOTTOM_MARGIN_KEY = 'geometry';

/**
 * Поправка к тому, как блок текста лёг на разлиновку, и запас снизу. Дельты, а
 * не значения: смена листа пересчитывает геометрию заново, и поправка
 * переезжает на новый расчёт.
 *
 * Перетаскивание пишет значение без шага истории, отпускание — одним шагом:
 * иначе отмена после одного движения слайдера шла бы по сотне промежуточных
 * положений.
 */
export const GeometrySection: FC = () => {
  const { correction, bottomMargin } = useGeneratorStore(
    useShallow((state) => {
      return {
        correction: state.geometryCorrection,
        bottomMargin: state.bottomMargin,
      };
    })
  );
  const preview = useGeneratorStore((state) => {
    return state.preview;
  });
  const commit = useGeneratorStore((state) => {
    return state.commit;
  });
  const resetGeometryCorrection = useGeneratorStore((state) => {
    return state.resetGeometryCorrection;
  });

  const handleBottomMarginChange = (value: number) => {
    preview({ bottomMargin: value });
  };

  const handleBottomMarginCommit = (value: number) => {
    commit({ bottomMargin: value }, { coalesceKey: BOTTOM_MARGIN_KEY });
  };

  const handleResetClick = () => {
    resetGeometryCorrection();
  };

  return (
    <div className="flex flex-col gap-4">
      {GEOMETRY_SLIDERS.map(({ field, label, range }) => {
        const handleCorrectionChange = (value: number) => {
          preview((state) => {
            return {
              geometryCorrection: { ...state.geometryCorrection, [field]: value },
            };
          });
        };

        const handleCorrectionCommit = (value: number) => {
          commit(
            (state) => {
              return {
                geometryCorrection: { ...state.geometryCorrection, [field]: value },
              };
            },
            { coalesceKey: `geometryCorrection:${field}` }
          );
        };

        return (
          <ValueSlider
            key={field}
            label={label}
            value={correction[field]}
            min={range.min}
            max={range.max}
            step={range.step}
            formatValue={formatStepFraction}
            onChange={handleCorrectionChange}
            onValueCommit={handleCorrectionCommit}
          />
        );
      })}

      <ValueSlider
        label="Запас снизу"
        value={bottomMargin}
        min={BOTTOM_MARGIN_RANGE.min}
        max={BOTTOM_MARGIN_RANGE.max}
        step={BOTTOM_MARGIN_RANGE.step}
        formatValue={formatStepFraction}
        onChange={handleBottomMarginChange}
        onValueCommit={handleBottomMarginCommit}
      />

      <Button variant="secondary" onClick={handleResetClick}>
        Сбросить поправку
      </Button>
    </div>
  );
};
