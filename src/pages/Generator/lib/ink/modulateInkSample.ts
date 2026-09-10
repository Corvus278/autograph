import type { InkModulation, InkModulationOptions, InkRgb } from './ink.types';

/**
 * Доля, на которую самая тёмная часть листа гасит чернила. Треть — на глаз
 * заметная разница между углами страницы, но след ещё читается как один и тот
 * же стержень: сильнее — и лист выглядит снятым в двух разных комнатах.
 */
const LIGHT_INFLUENCE = 0.35;

/**
 * Доля, на которую текстура гасит чернила от самой светлой точки карты к самой
 * тёмной. Ощутимо меньше вклада света: текстура работает на масштабе зерна
 * бумаги, и её задача — сломать ровную заливку штриха, а не перекрасить слово.
 */
const TEXTURE_INFLUENCE = 0.18;

/**
 * Нижняя граница коэффициента. Формула по построению до неё не доходит, но
 * граница держит результат осмысленным на входах вне диапазона: чернила
 * остаются чернилами и не превращаются в чёрный провал.
 */
const MIN_GAIN = 0.4;

/**
 * Верхняя граница коэффициента. Ровно единица: модуляция только гасит след и
 * никогда не делает его светлее исходного цвета — осветлённые чернила
 * читаются как полупрозрачная заливка поверх фотографии, то есть как
 * отрисовка.
 */
const MAX_GAIN = 1;

/**
 * Отклонение текстуры, при котором след остаётся нетронутым. Его подставляют
 * там, где карты текстуры нет: отсутствие карты обязано означать «текстура не
 * вмешивается», а не «текстура средней темноты».
 */
export const NEUTRAL_TEXTURE_VALUE = 1;

/**
 * Коэффициенты модуляции по умолчанию. Отсюда их берут и CPU-формула, и текст
 * шейдера: расхождение этих чисел означало бы разный результат предпросмотра и
 * экспорта.
 */
export const INK_MODULATION_DEFAULTS: InkModulation = {
  lightInfluence: LIGHT_INFLUENCE,
  textureInfluence: TEXTURE_INFLUENCE,
  minGain: MIN_GAIN,
};

/**
 * Зажимает значение в отрезок.
 */
const clamp = (value: number, min: number, max: number): number => {
  return Math.min(Math.max(value, min), max);
};

/**
 * Достраивает частичные настройки до полного набора коэффициентов.
 *
 * @param options — отклонения от значений по умолчанию
 * @returns коэффициенты модуляции целиком
 */
export const resolveInkModulation = (options?: InkModulationOptions): InkModulation => {
  const {
    lightInfluence = LIGHT_INFLUENCE,
    textureInfluence = TEXTURE_INFLUENCE,
    minGain = MIN_GAIN,
  } = options || {};

  return { lightInfluence, textureInfluence, minGain };
};

/**
 * Коэффициент, на который умножается каждый канал чернил. Здесь и только здесь
 * живёт формула модуляции; шейдер `inkShader.ts` повторяет её строка в строку.
 *
 * Свет входит множителем: чернила — не источник, а отражатель, и в слабо
 * освещённой части листа отражают меньше. `lightingValue` нормирован на самый
 * светлый узел поля, поэтому самая светлая часть листа оставляет след как есть,
 * а остальные его гасят.
 *
 * Текстура входит вторым множителем, а не слагаемым: иначе одна и та же добавка
 * заметно смещала бы светлые чернила и терялась на тёмных. Отображение
 * одностороннее — `textureValue` в единице оставляет след нетронутым, в минус
 * единице гасит на `textureInfluence`. Двусторонняя добавка выводила бы часть
 * пикселей выше исходного цвета, а верхняя граница как раз запрещает чернилам
 * белеть.
 *
 * Результат зажат в `[minGain, 1]`: чернила не светлее исходного цвета и не
 * уходят в чистый чёрный.
 *
 * @param lightingValue — яркость поля освещения в точке, 0…1
 * @param textureValue — отклонение текстуры в точке, −1…1; 0 — ровная бумага
 * @param options — отклонения от коэффициентов по умолчанию
 * @returns множитель канала от `minGain` до 1
 */
export const inkGain = (
  lightingValue: number,
  textureValue: number,
  options?: InkModulationOptions
): number => {
  const { lightInfluence, textureInfluence, minGain } = resolveInkModulation(options);
  const lighting = clamp(lightingValue, 0, 1);
  const texture = clamp(textureValue, -1, 1);
  const lightGain = 1 - lightInfluence * (1 - lighting);
  const textureGain = 1 - textureInfluence * (1 - texture) * 0.5;

  return clamp(lightGain * textureGain, minGain, MAX_GAIN);
};

/**
 * Модулирует один цвет чернил освещением и текстурой листа.
 *
 * Функция чистая и детерминированная: одни и те же аргументы дают один и тот же
 * цвет. Каждый канал лежит между `minGain` от исходного значения и самим
 * исходным значением, то есть результат никогда не светлее переданного цвета и
 * никогда не чернее `#000000`.
 *
 * @param color — исходный цвет чернил по каналам 0…255
 * @param lightingValue — яркость поля освещения в точке, 0…1
 * @param textureValue — отклонение текстуры в точке, −1…1
 * @param options — отклонения от коэффициентов по умолчанию
 * @returns промодулированный цвет; каналы дробные, округление — за
 *   растеризатором
 */
export const modulateInkSample = (
  color: InkRgb,
  lightingValue: number,
  textureValue: number,
  options?: InkModulationOptions
): InkRgb => {
  const { red, green, blue } = color;
  const gain = inkGain(lightingValue, textureValue, options);

  return {
    red: red * gain,
    green: green * gain,
    blue: blue * gain,
  };
};
