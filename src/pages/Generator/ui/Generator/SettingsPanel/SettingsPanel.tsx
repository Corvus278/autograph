import { Accordion, AccordionSection } from '@shared/ui/Accordion';
import type { FC } from 'react';

import { BackgroundGroup } from './BackgroundGroup';
import { DistortionGroup } from './DistortionGroup';
import { GeometryGroup } from './GeometryGroup';
import { SceneGroup } from './SceneGroup';
import type { SettingsPanelProps } from './SettingsPanel.types';
import { TextGroup } from './TextGroup';

/**
 * Развёрнуты только «Текст и шрифт»: с них начинают, остальное открывают по
 * необходимости.
 */
const DEFAULT_OPEN_SECTIONS = ['text'];

/**
 * Панель настроек. Липкая: лист длинный, и прокрутка страницы не должна
 * уводить контролы из виду.
 */
export const SettingsPanel: FC<SettingsPanelProps> = (props) => {
  const { defaultOpenSections = DEFAULT_OPEN_SECTIONS } = props;

  return (
    <aside className="sticky top-6 w-96 shrink-0">
      <Accordion defaultOpenSections={defaultOpenSections}>
        <AccordionSection value="text" title="Текст и шрифт">
          <TextGroup />
        </AccordionSection>

        <AccordionSection value="geometry" title="Геометрия">
          <GeometryGroup />
        </AccordionSection>

        <AccordionSection value="background" title="Фон">
          <BackgroundGroup />
        </AccordionSection>

        <AccordionSection value="distortions" title="Модификации почерка">
          <DistortionGroup />
        </AccordionSection>

        <AccordionSection value="scene" title="Сцена для сохранения">
          <SceneGroup />
        </AccordionSection>
      </Accordion>
    </aside>
  );
};
