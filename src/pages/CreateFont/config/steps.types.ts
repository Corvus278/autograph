/**
 * Шаг инструкции по созданию своего шрифта.
 */
export type CreateFontStep = {
  /**
   * Номер шага, как он показывается.
   */
  number: string;

  /**
   * Заголовок шага.
   */
  title: string;

  /**
   * Что нужно сделать на этом шаге.
   */
  text: string;
};

/**
 * Вопрос и ответ из блока частых вопросов.
 */
export type CreateFontQuestion = {
  /**
   * Вопрос.
   */
  question: string;

  /**
   * Ответ.
   */
  answer: string;
};
