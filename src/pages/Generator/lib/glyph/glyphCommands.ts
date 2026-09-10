import type { GlyphPathCommand, GlyphPoint } from './glyph.types';

/**
 * Преобразование одной точки пути.
 */
export type GlyphPointMapper = (x: number, y: number) => GlyphPoint;

/**
 * Точки команды в порядке следования. У `Z` точек нет — замыкание координат не
 * несёт.
 */
export const listCommandPoints = (command: GlyphPathCommand): GlyphPoint[] => {
  switch (command.type) {
    case 'M':

    case 'L': {
      return [{ x: command.x, y: command.y }];
    }

    case 'Q': {
      return [
        { x: command.x1, y: command.y1 },
        { x: command.x, y: command.y },
      ];
    }

    case 'C': {
      return [
        { x: command.x1, y: command.y1 },
        { x: command.x2, y: command.y2 },
        { x: command.x, y: command.y },
      ];
    }

    case 'Z': {
      return [];
    }

    default: {
      throw new Error(`Неизвестная команда пути глифа: ${JSON.stringify(command)}`);
    }
  }
};

/**
 * Точка команды, лежащая на самой кривой. Контрольные точки `Q` и `C` кривой не
 * принадлежат и могут отстоять от чернил сколь угодно далеко, поэтому судить по
 * ним о том, где штрих входит в букву и выходит из неё, нельзя.
 *
 * @param command — команда пути
 * @returns список из одной точки либо пустой список для `Z`
 */
export const listOnCurvePoints = (command: GlyphPathCommand): GlyphPoint[] => {
  switch (command.type) {
    case 'M':

    case 'L':

    case 'Q':

    case 'C': {
      return [{ x: command.x, y: command.y }];
    }

    case 'Z': {
      return [];
    }

    default: {
      throw new Error(`Неизвестная команда пути глифа: ${JSON.stringify(command)}`);
    }
  }
};

/**
 * Новая команда с точками, пропущенными через преобразование. Исходная команда
 * не меняется.
 */
export const mapCommandPoints = (
  command: GlyphPathCommand,
  mapPoint: GlyphPointMapper
): GlyphPathCommand => {
  switch (command.type) {
    case 'M':

    case 'L': {
      const { x, y } = mapPoint(command.x, command.y);

      return { type: command.type, x, y };
    }

    case 'Q': {
      const control = mapPoint(command.x1, command.y1);
      const end = mapPoint(command.x, command.y);

      return { type: 'Q', x1: control.x, y1: control.y, x: end.x, y: end.y };
    }

    case 'C': {
      const first = mapPoint(command.x1, command.y1);
      const second = mapPoint(command.x2, command.y2);
      const end = mapPoint(command.x, command.y);

      return {
        type: 'C',
        x1: first.x,
        y1: first.y,
        x2: second.x,
        y2: second.y,
        x: end.x,
        y: end.y,
      };
    }

    case 'Z': {
      return { type: 'Z' };
    }

    default: {
      throw new Error(`Неизвестная команда пути глифа: ${JSON.stringify(command)}`);
    }
  }
};
