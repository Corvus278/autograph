import { IconButton } from '@shared/ui/IconButton';
import { Toolbar, ToolbarItem } from '@shared/ui/Toolbar';
import type { FC } from 'react';

import { formatPercent } from '../../../../lib/format';
import { useGeneratorStore } from '../../../../model/useGeneratorStore';
import { stepZoom, ZOOM_MAX, ZOOM_MIN } from '../zoomScale';

import type { ViewportToolbarProps } from './ViewportToolbar.types';

/**
 * Масштаб подписывается целыми процентами: ступени лестницы целые, а дробь у
 * вписанного масштаба ничего не говорит и дёргает ширину подписи.
 */
const WHOLE_PERCENT = 100;

/**
 * Управление масштабом листа: шаг по лестнице в обе стороны, возврат к
 * вписыванию и подпись текущего масштаба в процентах пикселей кадра.
 *
 * Подпись стоит между кнопками и объявляется вежливо: шаг кнопкой меняет её
 * без перевода фокуса, и без объявления незрячий пользователь не узнал бы, до
 * какого масштаба дошёл.
 */
export const ViewportToolbar: FC<ViewportToolbarProps> = (props) => {
  const { zoom, isFit } = props;
  const setZoom = useGeneratorStore((state) => {
    return state.setZoom;
  });

  const handleZoomOutClick = () => {
    setZoom(stepZoom(zoom, -1));
  };

  const handleZoomInClick = () => {
    setZoom(stepZoom(zoom, 1));
  };

  const handleFitClick = () => {
    setZoom('fit');
  };

  return (
    <Toolbar label="Масштаб">
      <ToolbarItem>
        <IconButton
          label="Уменьшить"
          isDisabled={zoom <= ZOOM_MIN}
          onClick={handleZoomOutClick}
        >
          <svg aria-hidden viewBox="0 0 16 16">
            <path d="M3 8h10" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </IconButton>
      </ToolbarItem>

      <output
        data-testid="zoom-label"
        aria-live="polite"
        className="w-14 text-center text-sm text-fg-muted tabular-nums"
      >
        {formatPercent(Math.round(zoom * WHOLE_PERCENT) / WHOLE_PERCENT)}
      </output>

      <ToolbarItem>
        <IconButton
          label="Увеличить"
          isDisabled={zoom >= ZOOM_MAX}
          onClick={handleZoomInClick}
        >
          <svg aria-hidden viewBox="0 0 16 16">
            <path
              d="M3 8h10M8 3v10"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </IconButton>
      </ToolbarItem>

      <ToolbarItem>
        <IconButton label="Вписать" isDisabled={isFit} onClick={handleFitClick}>
          <svg aria-hidden viewBox="0 0 16 16">
            <path
              d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
          </svg>
        </IconButton>
      </ToolbarItem>
    </Toolbar>
  );
};
