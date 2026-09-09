import type { DomMeasurer, MeasurerParams } from './measure.types';

/**
 * Создаёт измеритель на скрытом контейнере в конце `body`. Контейнер повторяет
 * шрифт и размер страницы, поэтому браузер считает те же размеры, что и при
 * отрисовке.
 *
 * Ширину снимаем через `Range.getClientRects()`: у самого элемента ширина
 * округляется до целых пикселей, а на длинной строке набежавшая ошибка
 * заметно сдвигает перенос.
 */
export const createDomMeasurer = (params: MeasurerParams): DomMeasurer => {
  const { fontFamily, fontSize, lineSpacing } = params;
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
  container.style.fontSize = `${fontSize}em`;
  document.body.append(container);

  const widths = new Map<string, number>();

  const measureWidth = (text: string): number => {
    const cached = widths.get(text);

    if (cached !== undefined) {
      return cached;
    }

    container.textContent = text;

    const textNode = container.firstChild;
    let width = 0;

    if (textNode) {
      const range = document.createRange();

      range.selectNodeContents(textNode);
      width = [...range.getClientRects()].reduce((total, rect) => {
        return total + rect.width;
      }, 0);
    }

    widths.set(text, width);

    return width;
  };

  const measureLineHeight = (): number => {
    container.textContent = 'Ад';

    return container.getBoundingClientRect().height + lineSpacing;
  };

  const destroy = (): void => {
    container.remove();
    widths.clear();
  };

  return { measureWidth, measureLineHeight, destroy };
};
