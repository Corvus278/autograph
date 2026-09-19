import { Accordion, AccordionSection } from '@shared/ui/Accordion';
import { Disclosure } from '@shared/ui/Disclosure';
import type { FC } from 'react';

import { GeometrySection } from './GeometrySection';
import { HandwritingSection } from './HandwritingSection';
import { InkSection } from './InkSection';
import { SceneSection } from './SceneSection';
import { SheetPinSection } from './SheetPinSection';

/**
 * Группы открываются по одной: раскрытый экспертный режим со всеми группами
 * сразу вытолкнул бы основной путь из виду.
 */
const NO_OPEN_SECTIONS: string[] = [];

/**
 * Экспертный режим: всё, что основной путь выражает уровнем реализма и
 * выбором бумаги и чернил, но что бывает нужно подстроить по отдельности.
 * Свёрнут по умолчанию.
 */
export const ExpertSettings: FC = () => {
  return (
    <Disclosure title="Экспертный режим">
      <Accordion defaultOpenSections={NO_OPEN_SECTIONS}>
        <AccordionSection value="geometry" title="Геометрия">
          <GeometrySection />
        </AccordionSection>

        <AccordionSection value="handwriting" title="Почерк">
          <HandwritingSection />
        </AccordionSection>

        <AccordionSection value="sheet" title="Бумага">
          <SheetPinSection />
        </AccordionSection>

        <AccordionSection value="ink" title="Чернила">
          <InkSection />
        </AccordionSection>

        <AccordionSection value="scene" title="Сцена">
          <SceneSection />
        </AccordionSection>
      </Accordion>
    </Disclosure>
  );
};
