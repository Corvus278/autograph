/**
 * Загружает картинку фона до готовности к отрисовке.
 *
 * Через `createImageBitmap`, а не через элемент изображения: отрисовка
 * страниц уезжает в воркер, где конструктора `Image` нет, а декодирование в
 * битмап там доступно и не блокирует основной поток.
 *
 * Живёт отдельно от рендерера: тот остаётся синхронным и не знает ни про
 * сеть, ни про декодирование.
 *
 * @param src — путь к картинке или data URL
 * @returns изображение, которое можно передать рендереру как фон
 */
export const loadRenderImage = async (src: string): Promise<ImageBitmap> => {
  const response = await fetch(src);
  const blob = await response.blob();

  return createImageBitmap(blob);
};
