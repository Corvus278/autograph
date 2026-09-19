/**
 * @vitest-environment jsdom
 */
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { ActionBar } from '@pages/Generator/ui/Generator/ActionBar';
import { HistoryControls } from '@pages/Generator/ui/Generator/HistoryControls';
import { TextPane } from '@pages/Generator/ui/Generator/TextPane';
import { useHistoryHotkeys } from '@pages/Generator/ui/Generator/useHistoryHotkeys';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

/**
 * Кусок экрана генератора, где живут правки и их отмена: поле текста, кнопки
 * истории, полоса действий и обработчик клавиш на документе.
 */
const Harness: FC = () => {
  useHistoryHotkeys();

  return (
    <>
      <HistoryControls />

      <TextPane pageCount={1} />

      <ActionBar plan={null} />
    </>
  );
};

const INITIAL_TEXT = 'раз';

const getButton = (name: string): HTMLButtonElement => {
  const button = screen.getByRole('button', { name });

  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`«${name}» — не кнопка`);
  }

  return button;
};

const getText = (): string => {
  return useGeneratorStore.getState().text;
};

beforeEach(() => {
  useGeneratorStore.setState({ ...DEFAULT_GENERATOR_STATE, text: INITIAL_TEXT });
});

afterEach(() => {
  cleanup();
});

describe('отмена и повтор', () => {
  it('после загрузки отменять и повторять нечего', () => {
    render(<Harness />);

    expect(getButton('Отменить').disabled).toBe(true);
    expect(getButton('Повторить').disabled).toBe(true);
  });

  it('набранное без пауз слово отменяется одним шагом клавишами в поле текста', async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole('textbox', { name: 'Текст' }));
    await user.keyboard(' слово');

    expect(getText()).toBe(`${INITIAL_TEXT} слово`);

    await user.keyboard('{Control>}z{/Control}');

    expect(getText()).toBe(INITIAL_TEXT);
    expect(screen.getByDisplayValue(INITIAL_TEXT)).toBeDefined();

    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');

    expect(getText()).toBe(`${INITIAL_TEXT} слово`);
  });

  it('клавиши отмены в поле текста не доходят до браузера', () => {
    render(<Harness />);

    const field = screen.getByRole('textbox', { name: 'Текст' });

    expect(fireEvent.keyDown(field, { key: 'z', code: 'KeyZ', metaKey: true })).toBe(
      false
    );
    expect(fireEvent.keyDown(field, { key: 'y', code: 'KeyY', ctrlKey: true })).toBe(
      false
    );
  });

  it('отмена перегенерации возвращает прежний прогон, повтор — новый', async () => {
    const user = userEvent.setup();

    render(<Harness />);

    const seedBefore = useGeneratorStore.getState().runSeed;

    await user.click(getButton('Перегенерировать'));

    const seedAfter = useGeneratorStore.getState().runSeed;

    expect(seedAfter).not.toBe(seedBefore);

    await user.click(getButton('Отменить'));

    expect(useGeneratorStore.getState().runSeed).toBe(seedBefore);

    await user.click(getButton('Повторить'));

    expect(useGeneratorStore.getState().runSeed).toBe(seedAfter);
  });

  it('понимает клавиши в русской раскладке и Ctrl+Y', async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(getButton('Перегенерировать'));

    const seedAfter = useGeneratorStore.getState().runSeed;

    fireEvent.keyDown(document.body, { key: 'я', code: 'KeyZ', ctrlKey: true });

    expect(useGeneratorStore.getState().runSeed).not.toBe(seedAfter);

    fireEvent.keyDown(document.body, { key: 'н', code: 'KeyY', ctrlKey: true });

    expect(useGeneratorStore.getState().runSeed).toBe(seedAfter);
  });

  it('во время перетаскивания слайдера клавиши отмены не трогают историю', () => {
    render(<Harness />);

    useGeneratorStore.getState().commit({ text: 'шаг' });
    useGeneratorStore.getState().preview({ bottomMargin: 3 });

    const { history } = useGeneratorStore.getState();

    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });

    const state = useGeneratorStore.getState();

    expect(state.history).toBe(history);
    expect(state.history.previewBase).not.toBeNull();
    expect(state.text).toBe('шаг');
    expect(state.bottomMargin).toBe(3);

    /**
     * Отпускание слайдера записывает шаг от значения до перетаскивания, и
     * отмена возвращает к нему, а не к промежуточному значению.
     */
    useGeneratorStore.getState().commit({ bottomMargin: 3 });
    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });

    expect(useGeneratorStore.getState().bottomMargin).toBe(
      DEFAULT_GENERATOR_STATE.bottomMargin
    );
    expect(useGeneratorStore.getState().text).toBe('шаг');
  });
});
