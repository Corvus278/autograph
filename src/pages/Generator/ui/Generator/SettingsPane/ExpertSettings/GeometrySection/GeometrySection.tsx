import { Button } from '@shared/ui/Button';
import { ValueSlider } from '@shared/ui/ValueSlider';
import type { FC } from 'react';
import { useShallow } from 'zustand/react/shallow';

import { BOTTOM_MARGIN_RANGE, GEOMETRY_CORRECTION_RANGES } from '../../../../../config';
import { formatStepFraction } from '../../../../../lib/format';
import { useGeneratorStore } from '../../../../../model/useGeneratorStore';

import type { GeometrySliderOption } from './GeometrySection.types';

const GEOMETRY_SLIDERS: GeometrySliderOption[] = [
  { field: 'fontSizePx', label: 'Размер шрифта' },
  { field: 'blockWidth', label: 'Ширина блока' },
  { field: 'lineSpacing', label: 'Межстрочный интервал' },
  { field: 'topOffset', label: 'Вертикальный сдвиг' },
  { field: 'leftPadding', label: 'Левый отступ' },
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
      {GEOMETRY_SLIDERS.map(({ field, label }) => {
        const range = GEOMETRY_CORRECTION_RANGES[field];

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
