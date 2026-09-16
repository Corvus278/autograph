import type {
  LightingField,
  RulingKind,
  SheetOutline,
  SheetRulingSource,
  TextureMap,
} from './paper.types';

/**
 * Настройки измерения фотографии листа.
 */
export type SheetPhotoOptions = {
  /**
   * Вид разлиновки семьи. У чистого листа разлиновка не ищется.
   */
  kind: RulingKind;

  /**
   * Контур листа, заданный руками. Не передан — ищется на фотографии; `null` —
   * лист во весь кадр без поиска.
   */
  outline?: SheetOutline | null;
};

/**
 * Числа, по которым решено, хранить ли перспективу.
 */
export type SheetPhotoPerspectiveReport = {
  /**
   * Доля узлов «линия × полоса», где линия нашлась, от 0 до 1.
   */
  foundNodeShare: number;

  /**
   * Шаг у верхней найденной линии в середине вырезки по ширине, px. `0` —
   * трассу проложить не удалось.
   */
  topStep: number;

  /**
   * Шаг у нижней найденной линии в середине вырезки по ширине, px. `0` —
   * трассу проложить не удалось.
   */
  bottomStep: number;

  /**
   * Наибольшее расхождение перспективной и ровной гребёнки, px.
   */
  deviation: number;

  /**
   * Перспектива прошла проверку надёжности, но разлиновка на выпрямленной копии
   * не нашлась, и лист сохранён ровным.
   */
  isRectifiedRulingMissing: boolean;
};

/**
 * Всё, что измерение знает о своих решениях сверх самой разлиновки: отчёты
 * сборки профилей и замера листа печатают это, а не пересчитывают.
 */
export type SheetPhotoDiagnostics = {
  /**
   * Разлиновка найдена. У чистого листа — `false`.
   */
  isRulingDetected: boolean;

  /**
   * Уверенность поиска шага, от 0 до 1.
   */
  confidence: number;

  /**
   * Вид найденной разлиновки; `blank` — не найдена или не искалась.
   */
  kind: RulingKind;

  /**
   * Доля узлов области с линиями, где при измерении изгиба линия нашлась.
   */
  bendFoundNodeShare: number;

  /**
   * Отчёт измерения перспективы. `null` — перспектива не мерилась: разлиновка
   * не найдена.
   */
  perspective: SheetPhotoPerspectiveReport | null;
};

/**
 * Результат измерения фотографии листа. Все длины — в пикселях её кадра.
 */
export type SheetPhotoMeasurement = {
  /**
   * Разлиновка для сборки экземпляра: ненайденные поля — нули, шаг `0` —
   * разлиновка не найдена, лист уходит в ручной ввод.
   */
  source: SheetRulingSource;

  /**
   * Контур листа; `null` — лист во весь кадр.
   */
  outline: SheetOutline | null;

  /**
   * Поле освещения, измеренное только по бумаге.
   */
  lighting: LightingField;

  /**
   * Карта текстуры, измеренная только по бумаге.
   */
  textureMap: TextureMap;

  /**
   * Числа для отчётов.
   */
  diagnostics: SheetPhotoDiagnostics;
};
