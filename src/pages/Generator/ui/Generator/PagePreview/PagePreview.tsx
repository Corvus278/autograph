import type { FC } from 'react';
import { useEffect, useRef } from 'react';

import { PAGE_WIDTH } from '../../../config';
import { renderPageLayers } from '../../../lib/render';

import type { PagePreviewProps } from './PagePreview.types';

/**
 * Плотность экрана: на ней растр предпросмотра совпадает с физическими
 * пикселями, иначе рукописный текст выглядит замыленным. Вне браузера —
 * единица.
 *
 * @returns множитель плотности экрана
 */
const getPixelRatio = (): number => {
  return typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
};

/**
 * Лист с отрисованным текстом.
 *
 * Рисуется тем же рендерером, что и сохраняемый файл, только в низком
 * разрешении: разойтись предпросмотру и снимку негде — они отличаются одним
 * множителем.
 *
 * Чернила проходят тот же слой и ту же модуляцию, что и в сохраняемом файле:
 * освещение выбранного листа видно уже в предпросмотре.
 *
 * В снимок попадает только страница: рендерер рисует лист и чернила, а
 * интерфейс живёт в DOM, куда рендерер не заглядывает.
 */
export const PagePreview: FC<PagePreviewProps> = (props) => {
  const { source } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scale = source ? source.previewScale * getPixelRatio() : 1;
  const params = source ? source.buildParams(scale) : null;
  const width = source ? Math.max(1, Math.round(source.pageWidth * scale)) : 0;
  const height = source ? Math.max(1, Math.round(source.pageHeight * scale)) : 0;

  /**
   * Без списка зависимостей: параметры отрисовки — новый объект на каждый
   * рендер, сравнивать их дороже, чем перерисовать лист.
   */
  useEffect(() => {
    const canvas = canvasRef.current;

    if (!canvas || !params) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    renderPageLayers(context, params, { width: canvas.width, height: canvas.height });
  });

  return (
    <div
      data-testid="page"
      className="relative overflow-hidden"
      style={{ width: `${PAGE_WIDTH}px` }}
    >
      <canvas
        ref={canvasRef}
        data-testid="page-canvas"
        width={width}
        height={height}
        className="block w-full"
      />
    </div>
  );
};
