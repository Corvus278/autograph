import type {
  CreateMirrorSurface,
  CreatePageSurface,
  PageDrawContext,
} from '@pages/Generator/model/pageRender.types';

/**
 * Записанный вызов контекста: имя метода или присвоенного свойства и
 * аргументы.
 */
export type RecordedCall = {
  /**
   * Имя метода или свойства.
   */
  name: string;

  /**
   * Аргументы вызова или присвоенное значение.
   */
  args: unknown[];
};

/**
 * Контекст-записыватель вместе с лентой вызовов.
 */
export type DrawRecorder = {
  /**
   * Контекст, который подставляется рендереру.
   */
  context: PageDrawContext;

  /**
   * Вызовы в порядке поступления.
   */
  calls: RecordedCall[];
};

/**
 * Ширина символа в измерителе-модели: настоящих размеров ни jsdom, ни
 * записыватель не считают, а координаты слов должны считаться в уме.
 */
const CHAR_WIDTH = 10;

/**
 * Контекст-записыватель: ничего не рисует, только запоминает, что его
 * попросили сделать, и меряет текст по модели.
 *
 * @returns контекст и лента его вызовов
 */
export const createDrawRecorder = (): DrawRecorder => {
  const calls: RecordedCall[] = [];

  const push = (name: string, ...args: unknown[]): void => {
    calls.push({ name, args });
  };

  let font = '';
  let fillStyle = '';

  const context: PageDrawContext = {
    get font() {
      return font;
    },
    set font(value: string) {
      font = value;
      push('font', value);
    },
    get fillStyle() {
      return fillStyle;
    },
    set fillStyle(value: string) {
      fillStyle = value;
      push('fillStyle', value);
    },
    textBaseline: 'alphabetic',
    save: () => {
      push('save');
    },
    restore: () => {
      push('restore');
    },
    scale: (x, y) => {
      push('scale', x, y);
    },
    translate: (x, y) => {
      push('translate', x, y);
    },
    rotate: (angle) => {
      push('rotate', angle);
    },
    transform: (a, b, c, d, e, f) => {
      push('transform', a, b, c, d, e, f);
    },
    drawImage: (image, dx, dy, dWidth, dHeight) => {
      push('drawImage', image, dx, dy, dWidth, dHeight);
    },
    fillRect: (x, y, width, height) => {
      push('fillRect', x, y, width, height);
    },
    clearRect: (x, y, width, height) => {
      push('clearRect', x, y, width, height);
    },
    measureText: (text) => {
      return { width: text.length * CHAR_WIDTH };
    },
    fillText: (text, x, y) => {
      push('fillText', text, x, y);
    },
    beginPath: () => {
      push('beginPath');
    },
    moveTo: (x, y) => {
      push('moveTo', x, y);
    },
    lineTo: (x, y) => {
      push('lineTo', x, y);
    },
    quadraticCurveTo: (cpx, cpy, x, y) => {
      push('quadraticCurveTo', cpx, cpy, x, y);
    },
    bezierCurveTo: (cp1x, cp1y, cp2x, cp2y, x, y) => {
      push('bezierCurveTo', cp1x, cp1y, cp2x, cp2y, x, y);
    },
    closePath: () => {
      push('closePath');
    },
    fill: () => {
      push('fill');
    },
  };

  return { context, calls };
};

/**
 * Аргументы всех вызовов с заданным именем.
 *
 * @param calls — лента вызовов
 * @param name — имя метода или свойства
 * @returns аргументы каждого вызова в порядке поступления
 */
export const findCalls = (calls: RecordedCall[], name: string): unknown[][] => {
  return calls.reduce<unknown[][]>((acc, call) => {
    if (call.name === name) {
      acc.push(call.args);
    }

    return acc;
  }, []);
};

/**
 * Размер созданной поверхности в пикселях.
 */
export type SurfaceSize = {
  /**
   * Ширина поверхности.
   */
  width: number;

  /**
   * Высота поверхности.
   */
  height: number;
};

/**
 * Чем поверхность попросили закодировать содержимое.
 */
export type SurfaceEncoding = {
  /**
   * Тип содержимого файла.
   */
  type: string;

  /**
   * Качество кодирования от 0 до 1.
   */
  quality: number;
};

/**
 * Поверхность-записыватель вместе с тем, чем её попросили закодировать.
 */
export type SurfaceRecorder = {
  /**
   * Фабрика поверхностей — её отдают растеризации.
   */
  createSurface: CreatePageSurface;

  /**
   * Размеры созданных поверхностей.
   */
  sizes: SurfaceSize[];

  /**
   * Аргументы кодирования: тип содержимого и качество.
   */
  encodings: SurfaceEncoding[];

  /**
   * Вызовы контекста последней созданной поверхности.
   */
  calls: RecordedCall[];
};

/**
 * Поверхность, которая ничего не рисует и ничего не кодирует, но помнит, о чём
 * её просили.
 *
 * @returns фабрика поверхностей и запись обращений к ней
 */
export const createSurfaceRecorder = (): SurfaceRecorder => {
  const sizes: SurfaceSize[] = [];
  const encodings: SurfaceEncoding[] = [];
  let calls: RecordedCall[] = [];

  const recorder: SurfaceRecorder = {
    createSurface: (width, height) => {
      const draw = createDrawRecorder();

      sizes.push({ width, height });
      calls = draw.calls;
      recorder.calls = draw.calls;

      return {
        width,
        height,
        getContext: () => {
          return draw.context;
        },
        toDataURL: (type, quality) => {
          encodings.push({ type, quality });

          return `data:${type};base64,page`;
        },
      };
    },
    sizes,
    encodings,
    calls,
  };

  return recorder;
};

/**
 * Поверхность отражения вместе с лентой вызовов её контекста.
 */
export type MirrorRecorder = {
  /**
   * Фабрика поверхностей — её отдают отражению фотографии.
   */
  createSurface: CreateMirrorSurface;

  /**
   * Вызовы контекста поверхности.
   */
  calls: RecordedCall[];

  /**
   * Изображение, которое поверхность отдаёт как результат.
   */
  image: HTMLCanvasElement;
};

/**
 * Записыватель для отражения фотографии: настоящий узел canvas как результат —
 * рендерер принимает его как источник изображения — и запись вызовов вместо
 * рисования.
 *
 * @param image — узел, который отдаётся как отражённая фотография
 * @returns фабрика поверхностей и лента вызовов
 */
export const createMirrorRecorder = (image: HTMLCanvasElement): MirrorRecorder => {
  const draw = createDrawRecorder();

  return {
    createSurface: () => {
      return { context: draw.context, image };
    },
    calls: draw.calls,
    image,
  };
};

/**
 * Записыватели узлов canvas документа: по узлу — лента его вызовов.
 */
const canvasRecorders = new WeakMap<HTMLCanvasElement, DrawRecorder>();

/**
 * Навешивает на узел canvas контекст-записыватель и заглушку кодирования.
 *
 * @param canvas — узел, созданный документом
 */
const attachRecorder = (canvas: HTMLCanvasElement): void => {
  const recorder = createDrawRecorder();

  canvasRecorders.set(canvas, recorder);

  Object.defineProperty(canvas, 'getContext', {
    configurable: true,
    /**
     * Записыватель занимает место только двумерного контекста: за `webgl`
     * приходит модуляция чернил, и отдать ей запись вызовов вместо контекста
     * значило бы соврать про поддержку — в jsdom её нет.
     */
    value: (contextId: string): PageDrawContext | null => {
      return contextId === '2d' ? recorder.context : null;
    },
  });

  Object.defineProperty(canvas, 'toDataURL', {
    configurable: true,
    value: (type: string, quality: number): string => {
      return `data:${type};quality=${quality},page`;
    },
  });
};

/**
 * Подменяет canvas в документе записывателем: jsdom растр не считает и на
 * `getContext('2d')` отдаёт `null`, а компонентным тестам нужно видеть, что
 * именно попросили нарисовать.
 */
export const installCanvasStub = (): void => {
  if (typeof document === 'undefined') {
    return;
  }

  const createElement = document.createElement.bind(document);

  Object.defineProperty(document, 'createElement', {
    configurable: true,
    value: (tagName: string, options?: ElementCreationOptions): HTMLElement => {
      const element = createElement(tagName, options);

      if (element instanceof HTMLCanvasElement) {
        attachRecorder(element);
      }

      return element;
    },
  });
};

/**
 * Лента вызовов контекста узла canvas.
 *
 * @param canvas — узел страницы предпросмотра
 * @returns вызовы в порядке поступления; пусто — контекст не запрашивали
 */
export const getCanvasCalls = (canvas: HTMLCanvasElement): RecordedCall[] => {
  return canvasRecorders.get(canvas)?.calls || [];
};

/**
 * Вызовы последней отрисовки узла canvas. Лента накапливается за все
 * перерисовки, а каждый кадр начинается с очистки холста, поэтому кадр — всё,
 * что записано после последней очистки.
 *
 * @param canvas — узел страницы предпросмотра
 * @returns вызовы последней отрисовки в порядке поступления
 */
export const getCanvasFrame = (canvas: HTMLCanvasElement): RecordedCall[] => {
  const calls = getCanvasCalls(canvas);
  const lastClear = calls.reduce((found, call, index) => {
    return call.name === 'clearRect' ? index : found;
  }, -1);

  return lastClear < 0 ? calls : calls.slice(lastClear + 1);
};
