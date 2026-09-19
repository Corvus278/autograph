import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';

import { LINED_FAMILY_ID } from '../../../../config';
import { loadPaperFamilies } from '../../../../model/paperProfiles';
import { findFamily } from '../../../../model/paperSelectors';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '../../../../model/useGeneratorStore';

import { SheetDialog } from './SheetDialog';

/**
 * Свой лист story: фотография из пресет-пака под своим идентификатором — так
 * у диалога настоящие фотография и разлиновка, а сети и импорта не нужно.
 */
const USER_SHEET_ID = 'user-story-sheet';

const USER_SHEET_LABEL = 'Моя тетрадь';

const meta = {
  component: SheetDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    sheetId: USER_SHEET_ID,
    onSheetIdChange: fn(),
  },
  loaders: [
    async () => {
      const presetFamilies = await loadPaperFamilies();
      const preset = findFamily(presetFamilies, LINED_FAMILY_ID)?.sheets[0];

      if (!preset) {
        throw new Error('В пресет-паке нет листа в линейку');
      }

      useGeneratorStore.setState({
        ...DEFAULT_GENERATOR_STATE,
        presetFamilies,
        familyId: LINED_FAMILY_ID,
        userSheets: [
          {
            familyId: LINED_FAMILY_ID,
            sheet: { ...preset, id: USER_SHEET_ID, label: USER_SHEET_LABEL },
            isBlank: false,
            isAnalyzed: true,
          },
        ],
      });

      return {};
    },
  ],
} satisfies Meta<typeof SheetDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * Диалог своего листа: поля границ и разлиновки заполнены измеренным, «Отмена»
 * закрывает его, не трогая лист.
 */
export const Open: Story = {
  play: async ({ args, canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    const dialog = await body.findByRole('dialog', {
      name: `Лист «${USER_SHEET_LABEL}»`,
    });
    const sheetBefore = useGeneratorStore.getState().userSheets[0]?.sheet;

    await expect(within(dialog).getByLabelText('Шаг строк, px')).not.toHaveValue(null);

    await userEvent.click(within(dialog).getByRole('button', { name: 'Отмена' }));

    await expect(args.onSheetIdChange).toHaveBeenCalledWith(null);
    await expect(useGeneratorStore.getState().userSheets[0]?.sheet).toBe(sheetBefore);
  },
};
