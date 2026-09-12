import type { FontsReadySource, MeasurerParams } from './measure.types';

/**
 * Ждёт, пока шрифт действительно загрузится. До этого браузер меряет
 * подстановочным шрифтом, и переносы посчитаются не по тому, что увидит
 * пользователь.
 *
 * `load()` тянет только запрошенное начертание, `ready` дожидается остальных
 * шрифтов документа — нужны оба. Кегль в запросе роли не играет: грузится
 * начертание целиком.
 */
export const waitForFont = async (
  params: MeasurerParams,
  fonts: FontsReadySource = document.fonts
): Promise<void> => {
  const { fontFamily } = params;

  await fonts.load(`1em "${fontFamily}"`);
  await fonts.ready;
};
