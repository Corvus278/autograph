import { create } from 'zustand';

import {
  DEFAULT_BOTTOM_MARGIN,
  DEFAULT_GEOMETRY_CORRECTION,
  DEFAULT_REALISM_LEVEL_ID,
  DEFAULT_RUN_SEED,
  DEFAULT_SCENE_DARKEN,
  DEFAULT_SCENE_ROTATE,
  DEFAULT_SCENE_SCALE,
  DEFAULT_SCENE_SHIFT_X,
  DEFAULT_SCENE_SHIFT_Y,
  HANDWRITING_FONTS,
  PRESET_PAPER_FAMILIES,
  REALISM_LEVELS,
  type RealismLevelId,
  SCENES,
} from '../config';
import type { PaperFamily } from '../lib/paper/paper.types';

import type { GeneratorRealism, GeneratorState, GeneratorStore } from './generator.types';
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

/**
 * Реализм ступени: её значения вместе с её идентификатором.
 *
 * @param levelId — идентификатор ступени
 * @returns реализм ступени; `null` — такой ступени в таблице нет
 */
const findLevelRealism = (levelId: RealismLevelId): GeneratorRealism | null => {
  const level = REALISM_LEVELS.find(({ id }) => {
    return id === levelId;
  });

  if (!level) {
    return null;
  }

  const { id, flags, wordFrequency, letterFrequency, hasContourVariance } = level;

  return { level: id, flags, wordFrequency, letterFrequency, hasContourVariance };
};

/**
 * Реализм ступени по умолчанию. Таблица ступеней без неё — ошибка сборки
 * конфига, а не состояние, которое стор мог бы пережить.
 *
 * @param levelId — идентификатор ступени
 * @returns реализм ступени
 */
const toLevelRealism = (levelId: RealismLevelId): GeneratorRealism => {
  const realism = findLevelRealism(levelId);

  if (!realism) {
    throw new Error(`Нет ступени реализма: ${levelId}`);
  }

  return realism;
};

const DEFAULT_STATE: GeneratorState = {
  text: DEFAULT_TEXT,
  fontFamily: HANDWRITING_FONTS[0]?.family ?? '',
  ink: { kind: 'auto' },
  familyId: PRESET_PAPER_FAMILIES[0]?.id || '',
  sheetId: PRESET_PAPER_FAMILIES[0]?.sheets[0]?.id || '',
  isSheetPinned: false,
  realism: toLevelRealism(DEFAULT_REALISM_LEVEL_ID),
  geometryCorrection: DEFAULT_GEOMETRY_CORRECTION,
  bottomMargin: DEFAULT_BOTTOM_MARGIN,
  isSceneEnabled: false,
  sceneId: SCENES[0]?.id ?? '',
  sceneRotate: DEFAULT_SCENE_ROTATE,
  sceneShiftX: DEFAULT_SCENE_SHIFT_X,
  sceneShiftY: DEFAULT_SCENE_SHIFT_Y,
  sceneScale: DEFAULT_SCENE_SCALE,
  sceneDarken: DEFAULT_SCENE_DARKEN,
  hasSceneShadow: false,
  runSeed: DEFAULT_RUN_SEED,
  pageIndex: 0,
  isSpread: false,
  zoom: 'fit',
  presetFamilies: PRESET_PAPER_FAMILIES,
  userSheets: [],
  customFontFamily: null,
  customSceneSrc: null,
  isBackgroundHidden: false,
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
 * заметно разный рецепт, зато переход предсказуем и проверяется тестом.
 */
const nextSeed = (seed: number): number => {
  return (seed + 1) >>> 0;
};

/**
 * Реализм после правки отдельного поля: ступень снимается, потому что набор
 * значений больше не её.
 *
 * @param state — текущее состояние генератора
 * @param patch — изменённые поля реализма
 * @returns реализм с правкой и ступенью `custom`
 */
const toCustomRealism = (
  state: GeneratorState,
  patch: Partial<GeneratorRealism>
): GeneratorRealism => {
  return { ...state.realism, ...patch, level: 'custom' };
};

export const useGeneratorStore = create<GeneratorStore>((set) => {
  return {
    ...DEFAULT_STATE,
    setText: (text) => {
      return set({ text });
    },
    setFontFamily: (fontFamily) => {
      return set({ fontFamily });
    },
    setCustomFontFamily: (customFontFamily) => {
      return set({ customFontFamily });
    },
    setInk: (ink) => {
      return set({ ink });
    },
    setGeometry: (patch) => {
      return set(patch);
    },
    setBackgroundHidden: (isBackgroundHidden) => {
      return set({ isBackgroundHidden });
    },
    toggleDistortion: (flag) => {
      return set((state) => {
        const { flags } = state.realism;

        return {
          realism: toCustomRealism(state, { flags: { ...flags, [flag]: !flags[flag] } }),
        };
      });
    },
    setContourVariance: (hasContourVariance) => {
      return set((state) => {
        return { realism: toCustomRealism(state, { hasContourVariance }) };
      });
    },
    setWordFrequency: (wordFrequency) => {
      return set((state) => {
        return { realism: toCustomRealism(state, { wordFrequency }) };
      });
    },
    setLetterFrequency: (letterFrequency) => {
      return set((state) => {
        return { realism: toCustomRealism(state, { letterFrequency }) };
      });
    },
    selectRealismLevel: (levelId) => {
      const realism = findLevelRealism(levelId);

      if (!realism) {
        return;
      }

      set({ realism });
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
    setIsSpread: (isSpread) => {
      return set({ isSpread });
    },
    setZoom: (zoom) => {
      return set({ zoom });
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
        return { runSeed: nextSeed(state.runSeed) };
      });
    },
  };
});

/**
 * Значения по умолчанию: нужны тестам и stories, чтобы вернуть стор в
 * исходное состояние.
 */
export const DEFAULT_GENERATOR_STATE = DEFAULT_STATE;
