import { create } from 'zustand';

import {
  DEFAULT_BLOCK_ROTATE,
  DEFAULT_BLOCK_WIDTH,
  DEFAULT_BOTTOM_MARGIN,
  DEFAULT_EVEN_PAGE_LEFT_PADDING,
  DEFAULT_FONT_SIZE,
  DEFAULT_INK_COLOR,
  DEFAULT_LEFT_PADDING,
  DEFAULT_LETTER_FREQUENCY,
  DEFAULT_LINE_SPACING,
  DEFAULT_SCENE_DARKEN,
  DEFAULT_SCENE_ROTATE,
  DEFAULT_SCENE_SCALE,
  DEFAULT_SCENE_SHIFT_X,
  DEFAULT_SCENE_SHIFT_Y,
  DEFAULT_TOP_OFFSET,
  DEFAULT_WORD_FREQUENCY,
  HANDWRITING_FONTS,
  PAGE_BACKGROUNDS,
  SCENES,
} from '../config';

import type { GeneratorState, GeneratorStore } from './generator.types';

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
  evenPageLeftPadding: DEFAULT_EVEN_PAGE_LEFT_PADDING,
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
      return set({ inkColor });
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
  };
});

/**
 * Значения по умолчанию: нужны тестам и stories, чтобы вернуть стор в
 * исходное состояние.
 */
export const DEFAULT_GENERATOR_STATE = DEFAULT_STATE;
