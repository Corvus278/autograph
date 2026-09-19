/**
 * @vitest-environment jsdom
 */
import { REALISM_LEVELS } from '@pages/Generator/config';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { RealismPicker } from '@pages/Generator/ui/Generator/SettingsPane/RealismPicker';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const store = () => {
  return useGeneratorStore.getState();
};

/**
 * Подпись ступени, которая сейчас нажата в переключателе.
 *
 * @returns текст нажатой ступени; `undefined` — не нажата ни одна
 */
const readPressedLevel = (): string | undefined => {
  const group = screen.getByRole('radiogroup', { name: 'Реализм' });
  const pressed = group.querySelector('[data-state="on"]');

  return pressed?.textContent || undefined;
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

afterEach(() => {
  cleanup();
});

describe('RealismPicker', () => {
  it('показывает ступени по порядку и по умолчанию выбирает «Обычно»', () => {
    render(<RealismPicker />);

    const group = screen.getByRole('radiogroup', { name: 'Реализм' });

    expect(
      [...group.querySelectorAll('button')].map((button) => {
        return button.textContent;
      })
    ).toEqual(
      REALISM_LEVELS.map(({ label }) => {
        return label;
      })
    );
    expect(readPressedLevel()).toBe('Обычно');
  });

  it('выбор ступени пишет её значения в реализм', async () => {
    const user = userEvent.setup();

    render(<RealismPicker />);

    await user.click(screen.getByRole('radio', { name: 'Ровно' }));

    expect(store().realism.level).toBe('even');
    expect(Object.values(store().realism.flags).some(Boolean)).toBe(false);
    expect(readPressedLevel()).toBe('Ровно');
  });

  it('правка отдельного искажения показывает «Свой»', () => {
    render(<RealismPicker />);

    act(() => {
      store().toggleDistortion('isWordRotated');
    });

    expect(store().realism.level).toBe('custom');
    expect(readPressedLevel()).toBe('Свой');
  });
});
