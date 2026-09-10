import type { RunRenderPlan } from '../../../model/pageTask.types';

export type SaveBarProps = {
  /**
   * План отрисовки прогона. `null` — сохранять пока нечего.
   */
  plan: RunRenderPlan | null;
};
