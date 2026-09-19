export type PageHotkeysInput = {
  /**
   * Показанная страница, считая с нуля.
   */
  pageIndex: number;

  /**
   * Число страниц прогона.
   */
  pageCount: number;

  /**
   * Показываются ли развороты: стрелка шагает на целый разворот.
   */
  isSpread: boolean;
};
