/**
 * @vitest-environment jsdom
 */
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { PaperPicker } from '@pages/Generator/ui/Generator/SettingsPane/PaperPicker';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSyntheticSheet } from './helpers/synthetic-sheet';

/**
 * Съём пикселей подменяется: канвы в jsdom нет, а проверяется здесь не
 * декодирование, а то, что выбор бумаги делает с добавленным листом.
 */
const { decodeSheetImage } = vi.hoisted(() => {
  return { decodeSheetImage: vi.fn() };
});

vi.mock(
  '@pages/Generator/ui/Generator/SettingsPane/useSheetImport/decodeSheetImage',
  () => {
    return { decodeSheetImage };
  }
);

/**
 * Снимок листа в линейку с известной разлиновкой: автоопределение на нём
 * удаётся, и лист попадает в семью без ручного ввода.
 */
const RULED_PHOTO = {
  width: 420,
  height: 560,
  step: 23.5,
  phase: 8,
  margins: { top: 78.5, right: 36, bottom: 82, left: 60 },
  marginLineX: 96,
};

const buildPhotoFile = (): File => {
  return new File([new Uint8Array([1, 2, 3])], 'моя тетрадь.jpg', {
    type: 'image/jpeg',
  });
};

const store = () => {
  return useGeneratorStore.getState();
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  globalThis.localStorage?.clear();
  decodeSheetImage.mockReset();
  decodeSheetImage.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe('PaperPicker', () => {
  it('показывает каждую семью плиткой с изображением и подписью', () => {
    render(<PaperPicker onSheetSettingsOpen={vi.fn()} />);

    const { presetFamilies } = store();

    expect(presetFamilies.length).toBeGreaterThan(0);

    for (const family of presetFamilies) {
      const tile = screen.getByRole('radio', { name: family.label });
      const image = tile.querySelector('img');

      expect(image?.getAttribute('src')).toBe(family.sheets[0]?.src);
    }

    expect(screen.getByRole('button', { name: 'Своё фото' })).toBeDefined();
  });

  it('выбор семьи снимает закрепление экземпляра', async () => {
    const user = userEvent.setup();

    store().selectSheet('grid-3');

    expect(store().isSheetPinned).toBe(true);

    render(<PaperPicker onSheetSettingsOpen={vi.fn()} />);

    await user.click(screen.getByRole('radio', { name: 'В линейку' }));

    expect(store().familyId).toBe('lined');
    expect(store().isSheetPinned).toBe(false);
    expect(
      screen.getByRole('radio', { name: 'В линейку' }).getAttribute('aria-checked')
    ).toBe('true');
  });

  it('добавленный лист — плитка с выбором и кнопкой настройки', async () => {
    const user = userEvent.setup();
    const handleSettingsOpen = vi.fn();

    decodeSheetImage.mockResolvedValue(createSyntheticSheet(RULED_PHOTO));

    render(<PaperPicker onSheetSettingsOpen={handleSettingsOpen} />);

    await user.upload(screen.getByLabelText('Своя фотография листа'), buildPhotoFile());

    await waitFor(() => {
      expect(store().userSheets).toHaveLength(1);
    });

    const [record] = store().userSheets;
    const sheetId = record?.sheet.id || '';
    const ownSheets = screen.getByRole('list', { name: 'Свои листы' });
    const tile = within(ownSheets).getByRole('button', { name: 'моя тетрадь' });

    expect(tile.querySelector('img')?.getAttribute('src')).toBe(record?.sheet.src);

    store().selectFamily('grid');
    await user.click(tile);

    expect(store().sheetId).toBe(sheetId);
    expect(store().isSheetPinned).toBe(true);

    await user.click(
      within(ownSheets).getByRole('button', { name: 'Настроить «моя тетрадь»' })
    );

    expect(handleSettingsOpen).toHaveBeenCalledWith(sheetId);
  });
});
