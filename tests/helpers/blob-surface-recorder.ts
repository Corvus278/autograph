import type { CreateMirrorSurface } from '@pages/Generator/model/pageRender.types';
import type { PageRenderSurfaces } from '@pages/Generator/model/pageTask.types';

import type { RecordedCall } from './canvas-recorder';
import { createDrawRecorder } from './canvas-recorder';

/**
 * Поверхности-записыватели вместе с лентами вызовов: чем именно попросили
 * нарисовать страницу и чем — отразить фотографию.
 */
export type RenderSurfacesRecorder = {
  /**
   * Поверхности, которые отдают отрисовке задания.
   */
  surfaces: PageRenderSurfaces;

  /**
   * Вызовы контекста последней созданной страницы.
   */
  pageCalls: RecordedCall[];

  /**
   * Вызовы контекста отражения фотографии.
   */
  mirrorCalls: RecordedCall[];
};

/**
 * Внеэкранного canvas нет ни в node, ни в jsdom, а отрисовке задания нужны
 * обе поверхности. Записыватель занимает их место и запоминает, что именно его
 * попросили нарисовать.
 *
 * @param mirrorImage — узел, который отдаётся как отражённая фотография
 * @returns поверхности и ленты их вызовов
 */
export const createRenderSurfacesRecorder = (
  mirrorImage: HTMLCanvasElement
): RenderSurfacesRecorder => {
  const mirror = createDrawRecorder();

  const createMirror: CreateMirrorSurface = () => {
    return { context: mirror.context, image: mirrorImage };
  };

  const recorder: RenderSurfacesRecorder = {
    surfaces: {
      createPage: () => {
        const draw = createDrawRecorder();

        recorder.pageCalls = draw.calls;

        return {
          getContext: () => {
            return draw.context;
          },
          convertToBlob: (options) => {
            return Promise.resolve(new Blob(['page'], { type: options.type }));
          },
        };
      },
      createMirror,
    },
    pageCalls: [],
    mirrorCalls: mirror.calls,
  };

  return recorder;
};

/**
 * Лента вызовов в виде строк: имена вызовов и их аргументы, где объекты
 * заменены на пометку. Сравнивать ленты как есть нельзя — в них попадают
 * картинки, а у двух прогонов это разные объекты с одинаковым содержимым.
 *
 * @param calls — лента вызовов
 * @returns вызовы строками в порядке поступления
 */
export const describeCalls = (calls: RecordedCall[]): string[] => {
  return calls.map(({ name, args }) => {
    const described = args.map((arg) => {
      return arg !== null && typeof arg === 'object' ? 'изображение' : String(arg);
    });

    return `${name}(${described.join(', ')})`;
  });
};
