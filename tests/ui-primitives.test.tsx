/**
 * @vitest-environment jsdom
 */
import { Button } from '@shared/ui/Button';
import { Checkbox } from '@shared/ui/Checkbox';
import { ColorInput } from '@shared/ui/ColorInput';
import { Select } from '@shared/ui/Select';
import { Slider } from '@shared/ui/Slider';
import { TextArea } from '@shared/ui/TextArea';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

describe('Slider', () => {
  it('меняет значение стрелками с клавиатуры', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Slider
        label="Размер шрифта"
        value={5}
        min={0}
        max={10}
        step={1}
        onChange={handleChange}
      />
    );

    await user.tab();
    await user.keyboard('{ArrowRight}');

    expect(handleChange).toHaveBeenCalledWith(6);

    await user.keyboard('{ArrowLeft}');

    expect(handleChange).toHaveBeenLastCalledWith(4);
  });

  it('показывает текущее значение рядом с подписью', () => {
    render(
      <Slider
        label="Ширина блока"
        value={446}
        min={100}
        max={1000}
        step={1}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('446')).toBeDefined();
  });

  it('связывает подпись со слайдером', () => {
    render(
      <Slider
        label="Ширина блока"
        value={446}
        min={100}
        max={1000}
        step={1}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('slider', { name: 'Ширина блока' })).toBeDefined();
  });
});

describe('Checkbox', () => {
  it('связывает подпись с контролом и переключается кликом по подписи', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<Checkbox label="Съезд линий" isChecked={false} onChange={handleChange} />);

    await user.click(screen.getByText('Съезд линий'));

    expect(handleChange).toHaveBeenCalledWith(true);
  });

  it('не переключается, когда недоступен', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <Checkbox
        label="Съезд линий"
        isChecked={false}
        isDisabled
        onChange={handleChange}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: 'Съезд линий' }));

    expect(handleChange).not.toHaveBeenCalled();
  });
});

describe('Select', () => {
  it('связывает подпись с контролом', () => {
    render(
      <Select
        label="Шрифт"
        value="Abram"
        options={[
          { value: 'Abram', label: 'Абрам' },
          { value: 'Eskal', label: 'Эскаль' },
        ]}
        onChange={vi.fn()}
      />
    );

    expect(screen.getByRole('combobox', { name: 'Шрифт' })).toBeDefined();
  });
});

describe('TextArea', () => {
  it('отдаёт введённый текст', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<TextArea label="Текст" value="" onChange={handleChange} />);

    await user.type(screen.getByRole('textbox', { name: 'Текст' }), 'ы');

    expect(handleChange).toHaveBeenCalledWith('ы');
  });
});

describe('ColorInput', () => {
  it('связывает подпись с контролом', () => {
    render(<ColorInput label="Цвет чернил" value="#222222" onChange={vi.fn()} />);

    const control = screen.getByLabelText('Цвет чернил');

    expect(control).toBeDefined();
  });
});

describe('внешний className', () => {
  it('перекрывает дефолтные классы компонента', () => {
    render(
      <Button onClick={vi.fn()} className="rounded-none px-8">
        Сохранить
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Сохранить' });

    expect(button.className).toContain('rounded-none');
    expect(button.className).toContain('px-8');
    expect(button.className).not.toContain('rounded-md');
    expect(button.className).not.toContain('px-4');
  });
});
