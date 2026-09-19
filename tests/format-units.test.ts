import {
  formatDegrees,
  formatLetterFrequency,
  formatPercent,
  formatPixels,
  formatStepFraction,
  formatWordFrequency,
} from '@pages/Generator/lib/format';
import { describe, expect, it } from 'vitest';

const NBSP = ' ';
const MINUS = '−';

describe('formatStepFraction', () => {
  it('показывает доли шага со знаком и единицей', () => {
    expect(formatStepFraction(0.25)).toBe(`+0,25${NBSP}шага`);
    expect(formatStepFraction(-0.1)).toBe(`${MINUS}0,1${NBSP}шага`);
  });

  it('ноль — без знака', () => {
    expect(formatStepFraction(0)).toBe(`0${NBSP}шагов`);
    expect(formatStepFraction(-0)).toBe(`0${NBSP}шагов`);
    expect(formatStepFraction(-0.001)).toBe(`0${NBSP}шагов`);
  });

  it('целые шаги согласует с числом', () => {
    expect(formatStepFraction(1)).toBe(`+1${NBSP}шаг`);
    expect(formatStepFraction(-2)).toBe(`${MINUS}2${NBSP}шага`);
    expect(formatStepFraction(-4)).toBe(`${MINUS}4${NBSP}шага`);
    expect(formatStepFraction(5)).toBe(`+5${NBSP}шагов`);
  });

  it('округляет до сотых', () => {
    expect(formatStepFraction(0.123)).toBe(`+0,12${NBSP}шага`);
  });
});

describe('formatDegrees', () => {
  it('ставит знак градуса вплотную', () => {
    expect(formatDegrees(5)).toBe('5°');
    expect(formatDegrees(0)).toBe('0°');
    expect(formatDegrees(-3)).toBe(`${MINUS}3°`);
    expect(formatDegrees(1.25)).toBe('1,3°');
  });
});

describe('formatPixels', () => {
  it('показывает пиксели через неразрывный пробел', () => {
    expect(formatPixels(12)).toBe(`12${NBSP}px`);
    expect(formatPixels(0)).toBe(`0${NBSP}px`);
    expect(formatPixels(-150)).toBe(`${MINUS}150${NBSP}px`);
    expect(formatPixels(12.4)).toBe(`12${NBSP}px`);
  });
});

describe('formatPercent', () => {
  it('переводит долю в проценты', () => {
    expect(formatPercent(0.06)).toBe(`6${NBSP}%`);
    expect(formatPercent(0)).toBe(`0${NBSP}%`);
    expect(formatPercent(-0.5)).toBe(`${MINUS}50${NBSP}%`);
    expect(formatPercent(0.125)).toBe(`12,5${NBSP}%`);
  });
});

describe('шкала частот', () => {
  it('у букв большее число — чаще', () => {
    expect(formatLetterFrequency(1)).toBe('очень редко');
    expect(formatLetterFrequency(2)).toBe('редко');
    expect(formatLetterFrequency(3)).toBe('иногда');
    expect(formatLetterFrequency(4)).toBe('часто');
    expect(formatLetterFrequency(5)).toBe('очень часто');
  });

  it('у слов 1 — каждое слово, то есть очень часто', () => {
    expect(formatWordFrequency(1)).toBe('очень часто');
    expect(formatWordFrequency(2)).toBe('часто');
    expect(formatWordFrequency(3)).toBe('иногда');
    expect(formatWordFrequency(4)).toBe('редко');
    expect(formatWordFrequency(5)).toBe('очень редко');
  });

  it('значение вне шкалы прижимает к краю', () => {
    expect(formatLetterFrequency(0)).toBe('очень редко');
    expect(formatLetterFrequency(-2)).toBe('очень редко');
    expect(formatLetterFrequency(9)).toBe('очень часто');
    expect(formatWordFrequency(0)).toBe('очень часто');
    expect(formatWordFrequency(2.6)).toBe('иногда');
  });
});
