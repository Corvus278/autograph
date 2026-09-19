import type { RandomSource } from '@shared/lib/random';
import { randomInt } from '@shared/lib/random';

import type { InkTone } from './recipe.types';

/**
 * Паста синей шариковой ручки — самый частый цвет в тетради.
 */
const BALLPOINT_BLUE: InkTone = {
  id: 'ballpoint-blue',
  label: 'Синяя шариковая',
  color: '#1f3a93',
};

/**
 * Синий гель: пигмент плотнее пасты, оттенок глубже и холоднее.
 */
const GEL_BLUE: InkTone = {
  id: 'gel-blue',
  label: 'Синий гель',
  color: '#16307a',
};

/**
 * Сине-чёрные чернила перьевой ручки: почти чёрный с синим подтоном.
 */
const FOUNTAIN_BLUE_BLACK: InkTone = {
  id: 'fountain-blue-black',
  label: 'Сине-чёрные чернила',
  color: '#1c2b4a',
};

/**
 * Чёрная паста. Не чистый чёрный: шариковая ручка кладёт тёплый графитовый
 * след, чистый `#000000` на фотографии бумаги сразу читается как отрисовка.
 */
const BALLPOINT_BLACK: InkTone = {
  id: 'ballpoint-black',
  label: 'Чёрная шариковая',
  color: '#22252a',
};

/**
 * Чёрный гель — самый тёмный правдоподобный след, но всё ещё не `#000000`.
 */
const GEL_BLACK: InkTone = {
  id: 'gel-black',
  label: 'Чёрный гель',
  color: '#101216',
};

/**
 * Фиолетовые чернила перьевой ручки.
 */
const FOUNTAIN_VIOLET: InkTone = {
  id: 'fountain-violet',
  label: 'Фиолетовые чернила',
  color: '#4b2e83',
};

/**
 * Фиолетовый гель: темнее чернил, ближе к сине-фиолетовому.
 */
const GEL_PURPLE: InkTone = {
  id: 'gel-purple',
  label: 'Фиолетовый гель',
  color: '#3d2b6d',
};

/**
 * Тон чернил по умолчанию — синяя шариковая: самый частый цвет в тетради, и
 * выбор, который пользователь видит отмеченным до первой правки.
 */
export const DEFAULT_INK_TONE_ID = BALLPOINT_BLUE.id;

/**
 * Палитра правдоподобных чернил: только оттенки реальных пишущих средств.
 * Случайный выбор идёт по ней, иначе прогон выдавал бы цвета, которыми никто
 * не пишет.
 */
export const INK_PALETTE: readonly InkTone[] = [
  BALLPOINT_BLUE,
  GEL_BLUE,
  FOUNTAIN_BLUE_BLACK,
  BALLPOINT_BLACK,
  GEL_BLACK,
  FOUNTAIN_VIOLET,
  GEL_PURPLE,
];

/**
 * Разброс оттенка в единицах канала (из 255). Десять единиц — около четырёх
 * процентов канала: столько дают разная партия стержня и разный свет при
 * съёмке, при этом оттенок остаётся тем же самым. Больший разброс уводит
 * синий в бирюзу и обесценивает саму палитру.
 */
export const INK_COLOR_JITTER = 10;

const HEX_RADIX = 16;
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i;
const CHANNEL_MAX = 255;
const CHANNEL_HEX_LENGTH = 2;

/**
 * Каналы цвета `#rrggbb` в порядке R, G, B.
 */
const toColorChannels = (color: string): number[] => {
  const channels: number[] = [];

  for (let index = 1; index < color.length; index += CHANNEL_HEX_LENGTH) {
    channels.push(
      Number.parseInt(color.slice(index, index + CHANNEL_HEX_LENGTH), HEX_RADIX)
    );
  }

  return channels;
};

const toHexChannel = (value: number): string => {
  const clamped = Math.min(CHANNEL_MAX, Math.max(0, Math.round(value)));

  return clamped.toString(HEX_RADIX).padStart(CHANNEL_HEX_LENGTH, '0');
};

/**
 * Сдвигает каждый канал цвета на случайную величину в пределах
 * `INK_COLOR_JITTER`.
 *
 * @param random — источник случайности прогона
 * @param color — цвет оттенка палитры в формате `#rrggbb`
 * @returns цвет в формате `#rrggbb`
 */
export const jitterInkColor = (random: RandomSource, color: string): string => {
  const jittered = toColorChannels(color).map((channel) => {
    return toHexChannel(channel + randomInt(random, -INK_COLOR_JITTER, INK_COLOR_JITTER));
  });

  return `#${jittered.join('')}`;
};

/**
 * Приводит вручную заданный цвет к виду `#rrggbb` в нижнем регистре.
 *
 * Годится только полная шестизначная запись в любом регистре. Пустая строка,
 * короткая запись `#abc` и любой другой мусор считаются «цвет не задан»:
 * рецепт в этом случае берёт оттенок из палитры, а не рисует чернила
 * неизвестно чем.
 *
 * @param color — цвет, заданный пользователем, или `null`
 * @returns цвет в формате `#rrggbb` либо `null`, если цвет не задан
 */
export const normalizeInkColor = (color: string | null): string | null => {
  if (!color || !HEX_COLOR_PATTERN.test(color)) {
    return null;
  }

  return color.toLowerCase();
};

/**
 * Цвет чернил прогона: оттенок из палитры с разбросом в пределах
 * `INK_COLOR_JITTER`. Расходует два вида черпаний из `random` — выбор оттенка
 * и сдвиг каналов, — поэтому вызывается на фиксированном месте
 * последовательности.
 *
 * @param random — источник случайности прогона
 * @returns цвет в формате `#rrggbb`
 */
export const pickInkColor = (random: RandomSource): string => {
  const tone = INK_PALETTE[randomInt(random, 0, INK_PALETTE.length - 1)];

  if (!tone) {
    throw new Error('Палитра чернил пуста: выбирать оттенок не из чего');
  }

  return jitterInkColor(random, tone.color);
};
