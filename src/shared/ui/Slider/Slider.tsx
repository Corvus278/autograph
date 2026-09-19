import type { FC } from 'react';

import { ValueSlider } from '../ValueSlider';

import type { SliderProps } from './Slider.types';

/**
 * Значение без единицы — голое число. Новому коду нужен `ValueSlider` с
 * форматтером: у каждого числа настройки есть единица.
 *
 * @param value — значение слайдера
 * @returns число строкой
 */
const formatPlainValue = (value: number): string => {
  return String(value);
};

export const Slider: FC<SliderProps> = (props) => {
  return <ValueSlider {...props} formatValue={formatPlainValue} />;
};
