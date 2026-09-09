/**
 * jsdom не реализует API, на которые опираются примитивы Radix: наблюдение за
 * размерами и захват указателя. Без заглушек компонентные тесты падают ещё на
 * монтировании, хотя проверяют логику, а не вёрстку.
 */
class ResizeObserverStub implements ResizeObserver {
  observe(): void {}

  unobserve(): void {}

  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = ResizeObserverStub;
}

if (typeof Element !== 'undefined' && !Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = (): boolean => {
    return false;
  };

  Element.prototype.setPointerCapture = (): void => {};

  Element.prototype.releasePointerCapture = (): void => {};

  Element.prototype.scrollIntoView = (): void => {};
}

/**
 * `document.fonts` в jsdom нет, а ядро ждёт готовности шрифта перед
 * измерением. Заглушка отдаёт готовность сразу: настоящие шрифты в jsdom всё
 * равно не грузятся.
 */
if (typeof document !== 'undefined' && !document.fonts) {
  Object.defineProperty(document, 'fonts', {
    configurable: true,
    value: {
      load: () => {
        return Promise.resolve([]);
      },
      add: () => {},
      ready: Promise.resolve(undefined),
    },
  });
}

/**
 * FontFace в jsdom тоже нет. Заглушка разбирает файл так же грубо, как это
 * делает браузер на первом шаге: настоящий `.ttf` начинается с нулевого байта
 * версии sfnt, всё остальное считаем нечитаемым.
 */
class FontFaceStub {
  private readonly source: ArrayBuffer;

  constructor(_family: string, source: ArrayBuffer) {
    this.source = source;
  }

  load(): Promise<FontFaceStub> {
    const [first] = new Uint8Array(this.source);

    return first === 0
      ? Promise.resolve(this)
      : Promise.reject(new Error('Файл не разобрался как шрифт'));
  }
}

/**
 * jsdom не считает layout, и у `Range` нет `getClientRects`. Возвращаем пустой
 * список: измеритель на настоящем DOM в jsdom всё равно даст нули, а
 * содержательные проверки разбивки идут на измерителе-модели.
 */
if (typeof Range !== 'undefined' && !Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => {
    return [] as unknown as DOMRectList;
  };
}

if (typeof globalThis.FontFace === 'undefined') {
  Object.defineProperty(globalThis, 'FontFace', {
    configurable: true,
    value: FontFaceStub,
  });
}
