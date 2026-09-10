import { create } from 'zustand';

import {
  DEFAULT_BLOCK_ROTATE,
  DEFAULT_BLOCK_WIDTH,
  DEFAULT_BOTTOM_MARGIN,
  DEFAULT_FONT_SIZE,
  DEFAULT_GEOMETRY_CORRECTION,
  DEFAULT_INK_COLOR,
  DEFAULT_LEFT_PADDING,
  DEFAULT_LETTER_FREQUENCY,
  DEFAULT_LINE_SPACING,
  DEFAULT_RUN_SEED,
  DEFAULT_SCENE_DARKEN,
  DEFAULT_SCENE_ROTATE,
  DEFAULT_SCENE_SCALE,
  DEFAULT_SCENE_SHIFT_X,
  DEFAULT_SCENE_SHIFT_Y,
  DEFAULT_TOP_OFFSET,
  DEFAULT_WORD_FREQUENCY,
  HANDWRITING_FONTS,
  PAGE_BACKGROUNDS,
  PRESET_PAPER_FAMILIES,
  SCENES,
} from '../config';
import type { PaperFamily } from '../lib/paper/paper.types';

import type { GeneratorState, GeneratorStore } from './generator.types';
import { selectPaperFamilies } from './paperSelectors';
import type { PaperSelection } from './useGeneratorStore.types';
import { deleteUserSheet, readUserSheets, writeUserSheet } from './userSheetsStorage';

/**
 * Текст, с которым открывается генератор: экран не должен встречать пустым
 * листом, требование «страница уже отрисована» из спеки.
 */
const DEFAULT_TEXT = [
  'Здравствуй!',
  '',
  'Это рукописный текст: набери свой, выбери шрифт и подкрути настройки почерка.',
].join('\n');

const DEFAULT_STATE: GeneratorState = {
  text: DEFAULT_TEXT,
  fontFamily: HANDWRITING_FONTS[0]?.family ?? '',
  customFontFamily: null,
  inkColor: DEFAULT_INK_COLOR,
  fontSize: DEFAULT_FONT_SIZE,
  blockWidth: DEFAULT_BLOCK_WIDTH,
  lineSpacing: DEFAULT_LINE_SPACING,
  topOffset: DEFAULT_TOP_OFFSET,
  leftPadding: DEFAULT_LEFT_PADDING,
  blockRotate: DEFAULT_BLOCK_ROTATE,
  bottomMargin: DEFAULT_BOTTOM_MARGIN,
  backgroundId: PAGE_BACKGROUNDS[0]?.id ?? '',
  customBackgroundSrc: null,
  isBackgroundHidden: false,
  flags: {
    isWordRotated: false,
    isWordSkewed: false,
    isWordShifted: false,
    isLetterSpacingRandom: false,
    isLetterFontRandom: false,
    isLineRotated: false,
    isLineShifted: false,
  },
  /**
   * Вариативность включена по умолчанию: одинаковые буквы, совпадающие
   * контуром, — первое, по чему рукописный набор отличают от настоящего
   * почерка.
   */
  hasContourVariance: true,
  wordFrequency: DEFAULT_WORD_FREQUENCY,
  letterFrequency: DEFAULT_LETTER_FREQUENCY,
  isSceneEnabled: false,
  sceneId: SCENES[0]?.id ?? '',
  customSceneSrc: null,
  sceneRotate: DEFAULT_SCENE_ROTATE,
  sceneShiftX: DEFAULT_SCENE_SHIFT_X,
  sceneShiftY: DEFAULT_SCENE_SHIFT_Y,
  sceneScale: DEFAULT_SCENE_SCALE,
  sceneDarken: DEFAULT_SCENE_DARKEN,
  hasSceneShadow: false,
  pageIndex: 0,
  seed: 1,
  presetFamilies: PRESET_PAPER_FAMILIES,
  userSheets: [],
  familyId: PRESET_PAPER_FAMILIES[0]?.id || '',
  sheetId: PRESET_PAPER_FAMILIES[0]?.sheets[0]?.id || '',
  isSheetPinned: false,
  geometryCorrection: DEFAULT_GEOMETRY_CORRECTION,
  isInkColorAuto: true,
  runSeed: DEFAULT_RUN_SEED,
};

/**
 * Приводит выбор семьи и экземпляра к тому, что есть на самом деле: после
 * загрузки артефакта и после удаления листа прежний выбор может указывать в
 * никуда, а генератор обязан рисовать страницу.
 *
 * @param families — доступные семьи листов
 * @param familyId — желаемая семья
 * @param sheetId — желаемый экземпляр; пустая строка — взять первый в семье
 * @returns существующий выбор; пустые строки — семей нет вовсе
 */
const resolveSelection = (
  families: PaperFamily[],
  familyId: string,
  sheetId: string
): PaperSelection => {
  const family =
    families.find((item) => {
      return item.id === familyId;
    }) || families[0];

  if (!family) {
    return { familyId: '', sheetId: '' };
  }

  const sheet =
    family.sheets.find((item) => {
      return item.id === sheetId;
    }) || family.sheets[0];

  return { familyId: family.id, sheetId: sheet?.id || '' };
};

/**
 * Следующий seed — соседнее целое, а не случайное число: соседние seed дают
 * заметно разный рисунок почерка, зато переход предсказуем и проверяется
 * тестом.
 */
const nextSeed = (seed: number): number => {
  return (seed + 1) >>> 0;
};

export const useGeneratorStore = create<GeneratorStore>((set) => {
  return {
    ...DEFAULT_STATE,
    setText: (text) => {
      return set((state) => {
        return { text, seed: nextSeed(state.seed) };
      });
    },
    setFontFamily: (fontFamily) => {
      return set({ fontFamily });
    },
    setCustomFontFamily: (customFontFamily) => {
      return set({ customFontFamily });
    },
    setInkColor: (inkColor) => {
      return set({ inkColor, isInkColorAuto: false });
    },
    setGeometry: (patch) => {
      return set(patch);
    },
    selectBackground: (backgroundId) => {
      return set({ backgroundId, customBackgroundSrc: null });
    },
    setCustomBackground: (customBackgroundSrc) => {
      return set({ customBackgroundSrc });
    },
    setBackgroundHidden: (isBackgroundHidden) => {
      return set({ isBackgroundHidden });
    },
    toggleDistortion: (flag) => {
      return set((state) => {
        return {
          flags: { ...state.flags, [flag]: !state.flags[flag] },
          seed: nextSeed(state.seed),
        };
      });
    },
    setContourVariance: (hasContourVariance) => {
      return set({ hasContourVariance });
    },
    setWordFrequency: (wordFrequency) => {
      return set({ wordFrequency });
    },
    setLetterFrequency: (letterFrequency) => {
      return set({ letterFrequency });
    },
    regenerate: () => {
      return set((state) => {
        return { seed: nextSeed(state.seed) };
      });
    },
    setSceneEnabled: (isSceneEnabled) => {
      return set({ isSceneEnabled });
    },
    selectScene: (sceneId) => {
      return set({ sceneId, customSceneSrc: null });
    },
    setCustomScene: (customSceneSrc) => {
      return set({ customSceneSrc });
    },
    setSceneParams: (patch) => {
      return set(patch);
    },
    goToPage: (pageIndex) => {
      return set({ pageIndex: Math.max(pageIndex, 0) });
    },
    clampPageIndex: (pageCount) => {
      return set((state) => {
        const lastIndex = Math.max(pageCount - 1, 0);

        return { pageIndex: Math.min(state.pageIndex, lastIndex) };
      });
    },
    setPresetFamilies: (presetFamilies) => {
      return set((state) => {
        const families = selectPaperFamilies({ ...state, presetFamilies });

        return {
          presetFamilies,
          ...resolveSelection(families, state.familyId, state.sheetId),
        };
      });
    },
    selectFamily: (familyId) => {
      return set((state) => {
        /**
         * Экземпляр берётся первый в семье: прежний принадлежал другой семье.
         * Вместе с ним снимается и ручной выбор — раздачу листов по страницам
         * снова делает рецепт. Поправка геометрии при этом остаётся: она
         * задана дельтами.
         */
        return {
          ...resolveSelection(selectPaperFamilies(state), familyId, ''),
          isSheetPinned: false,
        };
      });
    },
    selectSheet: (sheetId) => {
      return set({ sheetId, isSheetPinned: true });
    },
    addUserSheet: (record) => {
      writeUserSheet(record);

      return set((state) => {
        const rest = state.userSheets.filter((item) => {
          return item.sheet.id !== record.sheet.id;
        });

        /**
         * Добавленный лист встаёт выбранным вручную: пользователь загрузил
         * свою фотографию, чтобы её увидеть, а не чтобы она встала в очередь
         * рецепта.
         */
        return {
          userSheets: [...rest, record],
          familyId: record.familyId,
          sheetId: record.sheet.id,
          isSheetPinned: true,
        };
      });
    },
    removeUserSheet: (sheetId) => {
      deleteUserSheet(sheetId);

      return set((state) => {
        const userSheets = state.userSheets.filter((item) => {
          return item.sheet.id !== sheetId;
        });
        const families = selectPaperFamilies({ ...state, userSheets });
        const selection = resolveSelection(families, state.familyId, state.sheetId);

        /**
         * Удалили выбранный вручную лист — ручной выбор снимается: держать
         * его на подставленном взамен экземпляре пользователь не просил.
         */
        return {
          userSheets,
          ...selection,
          isSheetPinned: state.isSheetPinned && selection.sheetId === state.sheetId,
        };
      });
    },
    restoreUserSheets: () => {
      const userSheets = readUserSheets();

      return set((state) => {
        const families = selectPaperFamilies({ ...state, userSheets });

        return {
          userSheets,
          ...resolveSelection(families, state.familyId, state.sheetId),
        };
      });
    },
    setGeometryCorrection: (patch) => {
      return set((state) => {
        return { geometryCorrection: { ...state.geometryCorrection, ...patch } };
      });
    },
    resetGeometryCorrection: () => {
      return set({ geometryCorrection: DEFAULT_GEOMETRY_CORRECTION });
    },
    startNewRun: () => {
      return set((state) => {
        return { runSeed: nextSeed(state.runSeed), seed: nextSeed(state.seed) };
      });
    },
  };
});

/**
 * Значения по умолчанию: нужны тестам и stories, чтобы вернуть стор в
 * исходное состояние.
 */
export const DEFAULT_GENERATOR_STATE = DEFAULT_STATE;
