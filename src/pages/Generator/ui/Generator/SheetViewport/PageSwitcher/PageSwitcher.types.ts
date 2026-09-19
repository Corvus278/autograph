export type PageSwitcherProps = {
  /**
   * Показанная страница, считая с нуля.
   */
  pageIndex: number;

  /**
   * Число страниц прогона.
   */
  pageCount: number;

  /**
   * Показываются ли развороты: шаг кнопками — целый разворот.
   */
  isSpread: boolean;
};
