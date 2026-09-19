import type { Meta, StoryObj } from '@storybook/react-vite';

import { Accordion } from './Accordion';
import { AccordionSection } from './AccordionSection';

const meta = {
  component: Accordion,
  args: {
    defaultOpenSections: ['text'],
    className: 'w-80',
    children: (
      <>
        <AccordionSection value="text" title="Текст и шрифт">
          <p className="text-sm text-fg-muted">Контролы группы «Текст и шрифт»</p>
        </AccordionSection>

        <AccordionSection value="geometry" title="Геометрия">
          <p className="text-sm text-fg-muted">Контролы группы «Геометрия»</p>
        </AccordionSection>
      </>
    ),
  },
} satisfies Meta<typeof Accordion>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FirstSectionOpen: Story = {};

export const AllCollapsed: Story = {
  args: { defaultOpenSections: [] },
};
