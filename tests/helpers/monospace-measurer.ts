import type { TextMeasurer } from '@pages/Generator/lib/measure/measure.types';
import type { MeasurerFactory } from '@pages/Generator/model/measureLayout.types';

type MonospaceMeasurerParams = {
  /**
   * Ширина одного символа в пикселях.
   */
  charWidth?: number;

  /**
   * Высота строки в пикселях.
   */
  lineHeight?: number;
};

/**
 * Измеритель-модель: ширина фрагмента — число символов на фиксированную ширину
 * символа. Настоящих размеров jsdom не считает, а ядру они и не нужны — оно
 * работает через интерфейс `TextMeasurer`.
 *
 * Считает обращения к себе: по ним проверяется, что кэш разбивки не измеряет
 * заново на параметрах, которые переносы не меняют.
 */
export type MonospaceMeasurer = TextMeasurer & {
  /**
   * Сколько раз спросили ширину фрагмента.
   */
  widthCalls: () => number;

  /**
   * Сколько раз спросили высоту строки.
   */
  lineHeightCalls: () => number;
};

export const createMonospaceMeasurer = (
  params: MonospaceMeasurerParams = {}
): MonospaceMeasurer => {
  const { charWidth = 10, lineHeight = 20 } = params;
  let widthCallsCount = 0;
  let lineHeightCallsCount = 0;

  return {
    measureWidth: (text) => {
      widthCallsCount += 1;

      return text.length * charWidth;
    },
    measureLineHeight: () => {
      lineHeightCallsCount += 1;

      return lineHeight;
    },
    widthCalls: () => {
      return widthCallsCount;
    },
    lineHeightCalls: () => {
      return lineHeightCallsCount;
    },
  };
};

/**
 * Фабрика измерителей-шпионов для хука разбивки: считает, сколько раз её
 * попросили измерить заново. По этому счётчику видно, работает ли кэш.
 */
export type MonospaceMeasurerFactory = {
  /**
   * Сама фабрика — её отдают хуку разбивки.
   */
  create: MeasurerFactory;

  /**
   * Сколько раз создавали измеритель.
   */
  createCalls: () => number;
};

export const createMonospaceMeasurerFactory = (
  params: MonospaceMeasurerParams = {}
): MonospaceMeasurerFactory => {
  let createCallsCount = 0;

  return {
    create: () => {
      createCallsCount += 1;

      return {
        ...createMonospaceMeasurer(params),
        destroy: () => {},
      };
    },
    createCalls: () => {
      return createCallsCount;
    },
  };
};
