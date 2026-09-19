/**
 * @vitest-environment jsdom
 */
import type { LayoutPage } from '@pages/Generator/lib/paginate/paginate.types';
import { DEFAULT_INK_TONE_ID, INK_PALETTE } from '@pages/Generator/lib/recipe';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { usePageRender } from '@pages/Generator/model/usePageRender';
import { InkPicker } from '@pages/Generator/ui/Generator/SettingsPane/InkPicker';
import { cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildRenderFamily } from './helpers/paper-family';

const FAMILY = buildRenderFamily();

/**
 * Сколько прогонов перебирается в проверке, что выбранный тон с прогоном не
 * меняется: если бы рецепт подменял цвет, на семи тонах палитры хотя бы один
 * из стольких прогонов выдал бы другой.
 */
const RUN_ATTEMPTS = 20;

const store = () => {
  return useGeneratorStore.getState();
};

/**
 * Цвет чернил, с которым отрисовывается первая страница: параметры страницы, а
 * не стор — ручной цвет должен дойти до отрисовки.
 *
 * @returns цвет чернил в параметрах отрисовки страницы
 */
const readPageInkColor = (): string | undefined => {
  const pages: LayoutPage[] = [
    { sheetId: FAMILY.sheets[0]?.id || '', lines: [{ text: 'раз', paragraphIndex: 0 }] },
  ];
  const { result, unmount } = renderHook(() => {
    return usePageRender(pages);
  });
  const inkColor = result.current?.buildParams(1).inkColor;

  unmount();

  return inkColor;
};

beforeEach(() => {
  useGeneratorStore.setState({
    ...DEFAULT_GENERATOR_STATE,
    presetFamilies: [FAMILY],
    familyId: FAMILY.id,
    sheetId: FAMILY.sheets[0]?.id || '',
  });
});

afterEach(() => {
  cleanup();
});

describe('InkPicker', () => {
  it('в ряду только тоны палитры, по умолчанию отмечена синяя шариковая', () => {
    const defaultTone = INK_PALETTE.find(({ id }) => {
      return id === DEFAULT_INK_TONE_ID;
    });

    render(<InkPicker />);

    const labels = screen.getAllByRole('radio').map((swatch) => {
      return swatch.getAttribute('aria-label');
    });

    expect(labels).toEqual(
      INK_PALETTE.map(({ label }) => {
        return label;
      })
    );
    expect(defaultTone?.label).toBe('Синяя шариковая');
    expect(
      screen.getByRole('radio', { name: 'Синяя шариковая' }).getAttribute('aria-checked')
    ).toBe('true');
    expect(screen.getByText('Синяя шариковая', { selector: 'p' })).toBeDefined();
  });

  it('выбор тона отмечает его свотч и меняет подпись', async () => {
    const user = userEvent.setup();
    const tone = INK_PALETTE[2];

    render(<InkPicker />);

    await user.click(screen.getByRole('radio', { name: tone?.label || '' }));

    expect(store().ink).toEqual({ kind: 'tone', toneId: tone?.id });
    expect(
      screen.getByRole('radio', { name: tone?.label || '' }).getAttribute('aria-checked')
    ).toBe('true');
    expect(
      screen.getByRole('radio', { name: 'Синяя шариковая' }).getAttribute('aria-checked')
    ).toBe('false');
    expect(screen.getByText(tone?.label || '', { selector: 'p' })).toBeDefined();
  });

  it('при своём цвете не отмечен ни один свотч, подпись — «Свой цвет»', () => {
    store().setInk({ kind: 'custom', color: '#123456' });

    render(<InkPicker />);

    const checked = screen.getAllByRole('radio').filter((swatch) => {
      return swatch.getAttribute('aria-checked') === 'true';
    });

    expect(checked).toEqual([]);
    expect(screen.getByText('Свой цвет')).toBeDefined();
  });

  it('ручной цвет на странице не меняется после перегенерации', async () => {
    const user = userEvent.setup();
    const tone = INK_PALETTE[5];

    render(<InkPicker />);

    await user.click(screen.getByRole('radio', { name: tone?.label || '' }));

    const colors = new Set<string | undefined>();

    for (let attempt = 0; attempt < RUN_ATTEMPTS; attempt += 1) {
      store().startNewRun();
      colors.add(readPageInkColor());
    }

    expect([...colors]).toEqual([tone?.color]);
  });

  it('без выбора страница красится синей шариковой при любом прогоне', () => {
    const defaultColor = INK_PALETTE.find(({ id }) => {
      return id === DEFAULT_INK_TONE_ID;
    })?.color;
    const colors = new Set<string | undefined>();

    for (let attempt = 0; attempt < RUN_ATTEMPTS; attempt += 1) {
      store().startNewRun();
      colors.add(readPageInkColor());
    }

    expect([...colors]).toEqual([defaultColor]);
  });
});
