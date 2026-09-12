import type { DomMeasurer, MeasurerParams } from './measure.types';

/**
 * Кегль контейнера, на котором снимаются ширины. Крупный: доля кегля
 * получается делением, и на мелком кегле округление раскладки заметно сдвигало
 * бы долю.
 */
const MEASURE_FONT_SIZE_PX = 200;

/**
 * Создаёт измеритель на скрытом контейнере в конце `body`. Контейнер набран
 * шрифтом страницы на постоянном кегле, а ширина отдаётся в долях кегля: кегль
 * у каждой страницы свой, и меряй мы в пикселях, одно и то же слово мерилось бы
 * заново на каждом листе с другим шагом разлиновки.
 *
 * Ширину снимаем через `Range.getClientRects()`: у самого элемента ширина
 * округляется до целых пикселей, а на длинной строке набежавшая ошибка
 * заметно сдвигает перенос.
 */
export const createDomMeasurer = (params: MeasurerParams): DomMeasurer => {
  const { fontFamily } = params;
  const container = document.createElement('div');

  container.setAttribute('aria-hidden', 'true');
  container.style.cssText = [
    'position: absolute',
    'top: 0',
    'left: -10000px',
    'visibility: hidden',
    'white-space: pre',
    'pointer-events: none',
  ].join('; ');
  container.style.fontFamily = fontFamily;
  container.style.fontSize = `${MEASURE_FONT_SIZE_PX}px`;
  document.body.append(container);

  const widths = new Map<string, number>();

  const measureWidth = (text: string): number => {
    const cached = widths.get(text);

    if (cached !== undefined) {
      return cached;
    }

    container.textContent = text;

    const textNode = container.firstChild;
    let widthPx = 0;

    if (textNode) {
      const range = document.createRange();

      range.selectNodeContents(textNode);
      widthPx = [...range.getClientRects()].reduce((total, rect) => {
        return total + rect.width;
      }, 0);
    }

    const width = widthPx / MEASURE_FONT_SIZE_PX;

    widths.set(text, width);

    return width;
  };

  const destroy = (): void => {
    container.remove();
    widths.clear();
  };

  return { measureWidth, destroy };
};
