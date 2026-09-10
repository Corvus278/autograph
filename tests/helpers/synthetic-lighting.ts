import type { SheetImageData } from '@pages/Generator/lib/paper';
import { mulberry32 } from '@shared/lib/random';

/**
 * Параметры синтетического листа.
 */
export type SyntheticSheetOptions = {
  /**
   * Ширина в пикселях.
   */
  width: number;

  /**
   * Высота в пикселях.
   */
  height: number;

  /**
   * Яркость бумаги в центре листа.
   */
  level?: number;

  /**
   * Размах горизонтального градиента: слева темнее на половину размаха,
   * справа светлее на неё же.
   */
  gradient?: number;

  /**
   * Амплитуда зерна бумаги: равномерный шум в `[-grain, grain]`.
   */
  grain?: number;

  /**
   * Seed зерна: без него один и тот же образец давал бы разные амплитуды от
   * прогона к прогону.
   */
  seed?: number;

  /**
   * Локальное тёмное пятно: тень от пальца или клякса. Отсутствует — лист
   * чистый.
   */
  spot?: SyntheticSpot;
};

/**
 * Тёмное пятно на листе.
 */
export type SyntheticSpot = {
  /**
   * Отступ левого края пятна от левого края листа в пикселях.
   */
  left: number;

  /**
   * Отступ верхнего края пятна от верха листа в пикселях.
   */
  top: number;

  /**
   * Сторона квадратного пятна в пикселях.
   */
  size: number;

  /**
   * На сколько пятно темнее бумаги.
   */
  depth: number;
};

/**
 * Type-guard: заодно сужает `spot`, чтобы обращение к его глубине не
 * требовало второй проверки.
 */
const isInsideSpot = (
  spot: SyntheticSpot | undefined,
  x: number,
  y: number
): spot is SyntheticSpot => {
  if (!spot) {
    return false;
  }

  return (
    x >= spot.left &&
    x < spot.left + spot.size &&
    y >= spot.top &&
    y < spot.top + spot.size
  );
};

/**
 * Собирает полутоновый образец листа: ровная подложка, линейный градиент
 * освещения слева направо и зерно бумаги. Все три слагаемых независимы,
 * поэтому один и тот же построитель даёт и равномерный скан, и снятый под
 * боковым светом лист.
 *
 * @param options — размеры и слагаемые яркости
 * @returns образец в том же виде, в каком анализатор получает фотографию
 */
export const createSyntheticSheet = (options: SyntheticSheetOptions): SheetImageData => {
  const {
    width,
    height,
    level = 0.75,
    gradient = 0,
    grain = 0,
    seed = 1,
    spot,
  } = options;
  const luminance = new Float32Array(width * height);
  const random = mulberry32(seed);
  const span = 1 < width ? width - 1 : 1;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const slope = gradient * (x / span - 0.5);
      const noise = grain * (random() * 2 - 1);
      const shadow = isInsideSpot(spot, x, y) ? spot.depth : 0;

      luminance[y * width + x] = Math.min(1, Math.max(0, level + slope + noise - shadow));
    }
  }

  return { width, height, luminance };
};
