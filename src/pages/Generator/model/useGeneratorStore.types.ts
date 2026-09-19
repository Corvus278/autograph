import type {
  GeneratorDocument,
  GeneratorState,
  GeneratorStore,
  GeneratorView,
} from './generator.types';

/**
 * Выбор бумаги: семья и экземпляр внутри неё. Пара, а не два поля, потому что
 * меняются они только вместе — экземпляр из чужой семьи выбором не бывает.
 */
export type PaperSelection = {
  /**
   * Идентификатор выбранной семьи. Пустая строка — семей нет вовсе.
   */
  familyId: string;

  /**
   * Идентификатор выбранного экземпляра. Пустая строка — в семье нет
   * экземпляров.
   */
  sheetId: string;
};

/**
 * Сессия — то, что переживает перезагрузку страницы: документ и режим
 * разворота. Остальной просмотр (страница, зум) и ресурсы в неё не входят:
 * номер страницы зависит от текста и листов, а свои шрифт и сцена — файлы,
 * которых после перезагрузки уже нет.
 */
export type GeneratorSession = GeneratorDocument & Pick<GeneratorView, 'isSpread'>;

/**
 * Правка документа: поля целиком или функция от текущего состояния — для
 * правки вложенного поля (реализм, поправка геометрии) поверх текущего.
 */
export type DocumentUpdate =
  Partial<GeneratorDocument> | ((state: GeneratorState) => Partial<GeneratorDocument>);

/**
 * Параметры шага истории.
 */
export type CommitOptions = {
  /**
   * Ключ склейки: смежные шаги с одним ключом в пределах окна склейки
   * становятся одним шагом (набор текста, щелчки одного слайдера).
   */
  coalesceKey?: string;
};

/**
 * История правок документа. Живёт только в памяти: в сессию не пишется, и
 * после перезагрузки начинается заново.
 */
export type GeneratorHistory = {
  /**
   * Снимки документа до каждой правки, от старых к новым.
   */
  past: GeneratorDocument[];

  /**
   * Снимки для повтора, ближайший — первый.
   */
  future: GeneratorDocument[];

  /**
   * Ключ склейки последнего шага. `null` — следующая правка начнёт новый шаг.
   */
  coalesceKey: string | null;

  /**
   * Время последней правки шага, мс. По нему решается, склеивать ли
   * следующую правку с тем же ключом.
   */
  committedAt: number;

  /**
   * Документ до начала предпросмотра (перетаскивания слайдера). `null` —
   * предпросмотра нет. Шаг, записанный по отпусканию, отменяется к нему.
   */
  previewBase: GeneratorDocument | null;
};

/**
 * API истории правок. Все правки документа идут через `commit`.
 *
 * Слайдер: на каждое `onValueChange` — `preview` (значение пишется, шага нет),
 * на `onValueCommit` — `commit` с итоговым значением (один шаг от значения до
 * перетаскивания). Кнопки и клавиши отмены — `undo`/`redo`; доступны ли они —
 * `selectIsUndoAvailable`/`selectIsRedoAvailable`.
 */
export type GeneratorHistoryActions = {
  /**
   * Применяет правку документа шагом истории. Правка без изменений шага не
   * создаёт, любая правка с изменением очищает повтор. Правка полей реализма
   * без смены ступени снимает названную ступень (`custom`).
   */
  commit: (update: DocumentUpdate, options?: CommitOptions) => void;

  /**
   * Применяет правку документа без шага истории — промежуточное значение
   * перетаскивания.
   */
  preview: (update: DocumentUpdate) => void;

  /**
   * Отменяет последний шаг. Нечего отменять — ничего не меняет.
   */
  undo: () => void;

  /**
   * Повторяет отменённый шаг. Нечего повторять — ничего не меняет.
   */
  redo: () => void;
};

/**
 * Состояние стора генератора вместе с историей правок.
 */
export type GeneratorStateWithHistory = GeneratorState & {
  /**
   * История правок документа.
   */
  history: GeneratorHistory;
};

/**
 * Стор генератора целиком: состояние, экшены и история правок.
 */
export type GeneratorStoreWithHistory = GeneratorStore &
  GeneratorStateWithHistory &
  GeneratorHistoryActions;
