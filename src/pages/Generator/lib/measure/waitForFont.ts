import type { FontsReadySource, MeasurerParams } from './measure.types';

/**
 * Ждёт, пока шрифт действительно загрузится. До этого браузер меряет
 * подстановочным шрифтом, и переносы посчитаются не по тому, что увидит
 * пользователь.
 *
 * `load()` тянет только запрошенное начертание, `ready` дожидается остальных
 * шрифтов документа — нужны оба.
 */
export const waitForFont = async (
  params: MeasurerParams,
  fonts: FontsReadySource = document.fonts
): Promise<void> => {
  const { fontFamily, fontSize } = params;

  await fonts.load(`${fontSize}em "${fontFamily}"`);
  await fonts.ready;
};
