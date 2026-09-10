import type { RunRenderPlan } from '../../../../model/pageTask.types';

export type BatchBarProps = {
  /**
   * План отрисовки прогона. `null` — выгружать пока нечего.
   */
  plan: RunRenderPlan | null;
};
