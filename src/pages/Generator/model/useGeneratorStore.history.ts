import { REALISM_LEVELS } from '../config';

import type {
  GeneratorDocument,
  GeneratorRealism,
  GeneratorState,
} from './generator.types';
import { isJsonRecord } from './paperSheetJson';
import { toSession } from './sessionSchema';
import type {
  CommitOptions,
  DocumentUpdate,
  GeneratorHistory,
  GeneratorStateWithHistory,
} from './useGeneratorStore.types';

/**
 * Глубина истории: при переполнении теряются самые старые шаги. Снимок —
 * десятки килобайт даже с длинным текстом, сотня шагов памяти не заметна.
 */
export const HISTORY_DEPTH = 100;

/**
 * Окно склейки, мс: правка с тем же ключом не позже этого срока после
 * предыдущей продолжает её шаг. Пауза длиннее — начало нового шага.
 */
export const COALESCE_WINDOW_MS = 800;

/**
 * История без шагов: так она начинается при каждой загрузке страницы.
 */
export const EMPTY_HISTORY: GeneratorHistory = {
  past: [],
  future: [],
  coalesceKey: null,
  committedAt: 0,
  previewBase: null,
};

/**
 * Документ из состояния стора: то, что попадает в историю. Просмотр и
 * ресурсы в нём не участвуют.
 *
 * @param state — состояние генератора
 * @returns снимок документа
 */
export const toDocument = (state: GeneratorState): GeneratorDocument => {
  const { isSpread: _isSpread, ...document } = toSession(state);

  return document;
};

/**
 * Структурное равенство значений документа: строк, чисел, булевых и простых
 * объектов из них. Экшены пересобирают вложенные объекты при каждой правке,
 * поэтому сравнение по ссылке считало бы правку без изменений шагом.
 *
 * @param left — первое значение
 * @param right — второе значение
 * @returns равны ли значения
 */
const isSameValue = (left: unknown, right: unknown): boolean => {
  if (left === right) {
    return true;
  }

  if (!isJsonRecord(left) || !isJsonRecord(right)) {
    return false;
  }

  const leftEntries = Object.entries(left);

  if (leftEntries.length !== Object.keys(right).length) {
    return false;
  }

  return leftEntries.every(([key, value]) => {
    return isSameValue(value, right[key]);
  });
};

/**
 * Реализм, которому названная ступень больше не соответствует, становится
 * своей ступенью: значение уровня хранится явно и должно совпадать с
 * таблицей. Так правка поля реализма через `commit` не оставляет в сторе
 * «Обычно» с чужими частотами.
 *
 * @param realism — реализм из правки
 * @returns реализм с верной ступенью
 */
const normalizeRealism = (realism: GeneratorRealism): GeneratorRealism => {
  if (realism.level === 'custom') {
    return realism;
  }

  const level = REALISM_LEVELS.find(({ id }) => {
    return id === realism.level;
  });
  const isLevelMatched =
    level !== undefined &&
    isSameValue(realism, {
      level: level.id,
      flags: level.flags,
      wordFrequency: level.wordFrequency,
      letterFrequency: level.letterFrequency,
      hasContourVariance: level.hasContourVariance,
    });

  return isLevelMatched ? realism : { ...realism, level: 'custom' };
};

/**
 * Переход по истории: документ, к которому перейти, и история после
 * перехода.
 */
export type HistoryStep = {
  /**
   * Документ после перехода.
   */
  document: GeneratorDocument;

  /**
   * История после перехода.
   */
  history: GeneratorHistory;
};

/**
 * Правка документа в виде полей.
 *
 * @param state — текущее состояние
 * @param update — правка полями или функцией от состояния
 * @returns поля правки
 */
const resolveUpdate = (
  state: GeneratorState,
  update: DocumentUpdate
): Partial<GeneratorDocument> => {
  const patch = typeof update === 'function' ? update(state) : update;

  return patch.realism ? { ...patch, realism: normalizeRealism(patch.realism) } : patch;
};

/**
 * Добавляет снимок в прошлое, отбрасывая самые старые сверх глубины.
 *
 * @param past — снимки прошлого
 * @param document — новый снимок
 * @returns прошлое с новым снимком
 */
const pushPast = (
  past: GeneratorDocument[],
  document: GeneratorDocument
): GeneratorDocument[] => {
  return [...past, document].slice(-HISTORY_DEPTH);
};

/**
 * Правка документа шагом истории. Шагом отменяется к документу до
 * предпросмотра, если он шёл, иначе — к текущему. Правка, после которой
 * документ равен исходному, шага не создаёт. Правка с тем же ключом склейки
 * в пределах окна продолжает прежний шаг.
 *
 * @param state — текущее состояние
 * @param update — правка
 * @param options — параметры шага
 * @param now — текущее время, мс
 * @returns изменения состояния
 */
export const recordCommit = (
  state: GeneratorStateWithHistory,
  update: DocumentUpdate,
  options: CommitOptions,
  now: number
): Partial<GeneratorStateWithHistory> => {
  const { history } = state;
  const patch = resolveUpdate(state, update);
  const current = toDocument(state);
  const base = history.previewBase || current;

  if (isSameValue({ ...current, ...patch }, base)) {
    return { ...patch, history: { ...history, previewBase: null } };
  }

  const coalesceKey = options.coalesceKey || null;
  const isCoalesced =
    !history.previewBase &&
    coalesceKey !== null &&
    history.coalesceKey === coalesceKey &&
    now - history.committedAt <= COALESCE_WINDOW_MS;

  return {
    ...patch,
    history: {
      past: isCoalesced ? history.past : pushPast(history.past, base),
      future: [],
      coalesceKey,
      committedAt: now,
      previewBase: null,
    },
  };
};

/**
 * Правка документа без шага истории: промежуточное значение перетаскивания.
 * Первая такая правка запоминает документ, к которому отменится шаг по
 * отпусканию.
 *
 * @param state — текущее состояние
 * @param update — правка
 * @returns изменения состояния
 */
export const recordPreview = (
  state: GeneratorStateWithHistory,
  update: DocumentUpdate
): Partial<GeneratorStateWithHistory> => {
  const { history } = state;

  return {
    ...resolveUpdate(state, update),
    history: {
      ...history,
      coalesceKey: null,
      previewBase: history.previewBase || toDocument(state),
    },
  };
};

/**
 * Отмена последнего шага.
 *
 * @param state — текущее состояние
 * @returns документ, к которому вернуться, и новая история; `null` — отменять
 * нечего
 */
export const recordUndo = (state: GeneratorStateWithHistory): HistoryStep | null => {
  const { past, future } = state.history;
  const document = past.at(-1);

  if (!document) {
    return null;
  }

  return {
    document,
    history: {
      ...EMPTY_HISTORY,
      past: past.slice(0, -1),
      future: [toDocument(state), ...future],
    },
  };
};

/**
 * Повтор отменённого шага.
 *
 * @param state — текущее состояние
 * @returns документ, к которому перейти, и новая история; `null` — повторять
 * нечего
 */
export const recordRedo = (state: GeneratorStateWithHistory): HistoryStep | null => {
  const { past, future } = state.history;
  const [document, ...rest] = future;

  if (!document) {
    return null;
  }

  return {
    document,
    history: {
      ...EMPTY_HISTORY,
      past: pushPast(past, toDocument(state)),
      future: rest,
    },
  };
};
