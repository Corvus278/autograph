/**
 * @vitest-environment jsdom
 */
import type { LayoutPage } from '@pages/Generator/lib/paginate/paginate.types';
import { INK_PALETTE } from '@pages/Generator/lib/recipe';
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
 * Сколько прогонов перебирается в поисках смены цвета в режиме «Авто»: на
 * семи тонах палитры хотя бы один из стольких прогонов выдаёт другой цвет.
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
  it('первым идёт «Авто», за ним тоны палитры с названиями', () => {
    render(<InkPicker />);

    const labels = screen.getAllByRole('radio').map((swatch) => {
      return swatch.getAttribute('aria-label');
    });

    expect(labels).toEqual([
      'Авто',
      ...INK_PALETTE.map(({ label }) => {
        return label;
      }),
    ]);
    expect(screen.getByRole('radio', { name: 'Авто' }).getAttribute('aria-checked')).toBe(
      'true'
    );
  });

  it('выбор тона пишет тон, «Авто» возвращает рецепт', async () => {
    const user = userEvent.setup();
    const tone = INK_PALETTE[2];

    render(<InkPicker />);

    await user.click(screen.getByRole('radio', { name: tone?.label || '' }));

    expect(store().ink).toEqual({ kind: 'tone', toneId: tone?.id });

    await user.click(screen.getByRole('radio', { name: 'Авто' }));

    expect(store().ink).toEqual({ kind: 'auto' });
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

  it('в режиме «Авто» перегенерация меняет цвет на странице', () => {
    render(<InkPicker />);

    const colors = new Set<string | undefined>();

    for (let attempt = 0; attempt < RUN_ATTEMPTS; attempt += 1) {
      store().startNewRun();
      colors.add(readPageInkColor());
    }

    expect(colors.size).toBeGreaterThan(1);
  });
});
