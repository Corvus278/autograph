import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import { renderPageLayers } from '../../../../lib/render';

import type { PageCanvasProps } from './PageCanvas.types';

/**
 * Лист в области просмотра.
 *
 * Основной растр рисуется тем же рендерером, что и сохраняемый файл, в
 * разрешении не выше вписанного. Крупнее он растягивается до масштаба, пока
 * поверх не ляжет детальный растр из воркера — та же страница в разрешении
 * масштаба.
 *
 * Край листа держит тень `shadow-sheet`: светлая бумага на светлом участке
 * фотографии иначе сливалась бы с областью просмотра.
 */
export const PageCanvas: FC<PageCanvasProps> = (props) => {
  const { source, zoom, rasterScale, detailUrl } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const params = source.buildParams(rasterScale);
  const width = Math.max(1, Math.round(source.pageWidth * rasterScale));
  const height = Math.max(1, Math.round(source.pageHeight * rasterScale));
  const cssWidth = Math.round(source.pageWidth * zoom);
  const cssHeight = Math.round(source.pageHeight * zoom);

  /**
   * Без списка зависимостей: параметры отрисовки — новый объект на каждый
   * рендер, сравнивать их дороже, чем перерисовать лист.
   */
  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    renderPageLayers(context, params, { width: canvas.width, height: canvas.height });
  });

  return (
    <div
      data-testid="page"
      className="relative shrink-0 shadow-sheet"
      style={{ width: `${String(cssWidth)}px`, height: `${String(cssHeight)}px` }}
    >
      <canvas
        ref={canvasRef}
        data-testid="page-canvas"
        width={width}
        height={height}
        className="block size-full"
      />

      {detailUrl && (
        <img
          data-testid="page-detail"
          src={detailUrl}
          alt=""
          className="absolute inset-0 size-full"
        />
      )}
    </div>
  );
};
