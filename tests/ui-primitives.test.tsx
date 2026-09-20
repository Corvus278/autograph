/**
 * @vitest-environment jsdom
 */
import { Button } from '@shared/ui/Button';
import { Checkbox } from '@shared/ui/Checkbox';
import { ColorInput } from '@shared/ui/ColorInput';
import { Dialog } from '@shared/ui/Dialog';
import { Disclosure } from '@shared/ui/Disclosure';
import { FileInput } from '@shared/ui/FileInput';
import { IconButton } from '@shared/ui/IconButton';
import { SegmentedControl } from '@shared/ui/SegmentedControl';
import { Select } from '@shared/ui/Select';
import { Swatch, SwatchGroup } from '@shared/ui/Swatch';
import { TextArea } from '@shared/ui/TextArea';
import { TileRadio } from '@shared/ui/TileRadio';
import { Toolbar, ToolbarItem } from '@shared/ui/Toolbar';
import { ValueSlider } from '@shared/ui/ValueSlider';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

describe('ValueSlider', () => {
  const formatDegrees = (value: number) => {
    return `${value}°`;
  };

  it('показывает значение через форматтер и в тексте, и в aria-valuetext', () => {
    render(
      <ValueSlider
        label="Поворот"
        value={-3}
        min={-10}
        max={10}
        step={1}
        formatValue={formatDegrees}
        onChange={vi.fn()}
      />
    );

    const slider = screen.getByRole('slider', { name: 'Поворот' });

    expect(screen.getByText('-3°')).toBeDefined();
    expect(slider.getAttribute('aria-valuetext')).toBe('-3°');
  });

  it('отдаёт окончательное значение в onValueCommit', async () => {
    const user = userEvent.setup();
    const handleCommit = vi.fn();

    render(
      <ValueSlider
        label="Поворот"
        value={0}
        min={-10}
        max={10}
        step={1}
        formatValue={formatDegrees}
        onChange={vi.fn()}
        onValueCommit={handleCommit}
      />
    );

    screen.getByRole('slider').focus();
    await user.keyboard('{ArrowRight}');

    expect(handleCommit).toHaveBeenLastCalledWith(1);
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

describe('Button в состоянии загрузки', () => {
  it('не пропускает повторное нажатие', async () => {
    const handleClick = vi.fn();

    render(
      <Button isLoading onClick={handleClick}>
        Обновить
      </Button>
    );

    await userEvent.click(screen.getByRole('button', { name: 'Обновить' }));

    expect(handleClick).not.toHaveBeenCalled();
  });

  it('помечает кнопку занятой для читалки', () => {
    render(
      <Button isLoading onClick={vi.fn()}>
        Обновить
      </Button>
    );

    const button = screen.getByRole('button', { name: 'Обновить' });

    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.getAttribute('aria-disabled')).toBe('true');
  });

  it('держит подпись в разметке, чтобы кнопка не меняла ширину', () => {
    const { rerender } = render(<Button onClick={vi.fn()}>Обновить</Button>);

    const label = screen.getByText('Обновить');

    rerender(
      <Button isLoading onClick={vi.fn()}>
        Обновить
      </Button>
    );

    expect(screen.getByText('Обновить')).toBe(label);
    expect(label.className).toContain('opacity-0');

    /**
     * Подпись гасится прозрачностью, а не `visibility`: скрытая подпись ушла
     * бы из дерева доступности, и читалка озвучила бы кнопку безымянной.
     */
    expect(label.className).not.toContain('invisible');
    expect(screen.getByRole('button', { name: 'Обновить' })).toBe(label.parentElement);
  });

  it('оставляет подпись видимой, пока загрузки нет', () => {
    render(<Button onClick={vi.fn()}>Обновить</Button>);

    const button = screen.getByRole('button', { name: 'Обновить' });

    expect(screen.getByText('Обновить').className).not.toContain('opacity-0');
    expect(button.getAttribute('aria-busy')).toBe('false');
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

describe('SegmentedControl', () => {
  const LEVELS = [
    { value: 'even', label: 'Ровно' },
    { value: 'neat', label: 'Аккуратно' },
    { value: 'normal', label: 'Обычно' },
  ];

  it('ходит стрелками по сегментам и выбирает пробелом', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SegmentedControl
        label="Реализм"
        value="neat"
        options={LEVELS}
        onChange={handleChange}
      />
    );

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Аккуратно' }));

    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Обычно' }));

    await user.keyboard(' ');

    expect(handleChange).toHaveBeenLastCalledWith('normal');
  });

  it('не снимает выбор повторным нажатием на выбранный сегмент', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SegmentedControl
        label="Реализм"
        value="neat"
        options={LEVELS}
        onChange={handleChange}
      />
    );

    await user.click(screen.getByRole('radio', { name: 'Аккуратно' }));

    expect(handleChange).not.toHaveBeenCalled();
  });
});

/**
 * Радио Radix выбирает пункт, когда фокус пришёл на него при зажатой
 * стрелке, а роуминг переводит фокус таймером. Поэтому стрелку держим
 * (`{ArrowRight>}`): отпущенная до таймера, она сняла бы признак нажатия
 * раньше, чем фокус доедет, — в браузере keyup приходит позже.
 */
describe('TileRadio', () => {
  it('ходит стрелками по плиткам и выбирает', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <TileRadio
        label="Бумага"
        value="grid"
        options={[
          { value: 'grid', label: 'Клетка' },
          { value: 'lined', label: 'Линейка' },
        ]}
        onChange={handleChange}
      />
    );

    expect(screen.getByRole('radiogroup', { name: 'Бумага' })).toBeDefined();

    await user.tab();
    await user.keyboard('{ArrowRight>}');

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Линейка' }));
    expect(handleChange).toHaveBeenLastCalledWith('lined');
  });
});

describe('SwatchGroup', () => {
  it('ходит стрелками по образцам и выбирает', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <SwatchGroup label="Чернила" value="blue" onChange={handleChange}>
        <Swatch value="blue" label="Синие" color="#1c3f94" />

        <Swatch value="black" label="Чёрные" color="#1a1a1a" />
      </SwatchGroup>
    );

    expect(screen.getByRole('radiogroup', { name: 'Чернила' })).toBeDefined();

    await user.tab();
    await user.keyboard('{ArrowRight>}');

    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Чёрные' }));
    expect(handleChange).toHaveBeenLastCalledWith('black');
  });
});

describe('Dialog', () => {
  const ControlledDialog = () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <Dialog
        isOpen={isOpen}
        title="Свой лист"
        trigger={<button type="button">Настроить лист</button>}
        onOpenChange={setIsOpen}
      >
        <input aria-label="Шаг" />
      </Dialog>
    );
  };

  it('закрывается по Esc и возвращает фокус на кнопку-триггер', async () => {
    const user = userEvent.setup();

    render(<ControlledDialog />);

    const trigger = screen.getByRole('button', { name: 'Настроить лист' });

    await user.click(trigger);

    expect(screen.getByRole('dialog', { name: 'Свой лист' })).toBeDefined();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('закрывается кнопкой «Закрыть»', async () => {
    const user = userEvent.setup();

    render(<ControlledDialog />);

    await user.click(screen.getByRole('button', { name: 'Настроить лист' }));
    await user.click(screen.getByRole('button', { name: 'Закрыть' }));

    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Disclosure', () => {
  it('раскрывается с клавиатуры', async () => {
    const user = userEvent.setup();

    render(
      <Disclosure title="Экспертный режим">
        <p>Поправка геометрии</p>
      </Disclosure>
    );

    const trigger = screen.getByRole('button', { name: 'Экспертный режим' });

    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Поправка геометрии')).toBeNull();

    await user.tab();
    await user.keyboard('{Enter}');

    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('Поправка геометрии')).toBeDefined();
  });
});

describe('Toolbar', () => {
  it('ходит стрелками между кнопками', async () => {
    const user = userEvent.setup();
    const handleUndoClick = vi.fn();
    const handleRedoClick = vi.fn();

    render(
      <Toolbar label="История">
        <ToolbarItem>
          <IconButton label="Отменить" onClick={handleUndoClick}>
            ↶
          </IconButton>
        </ToolbarItem>

        <ToolbarItem>
          <IconButton label="Повторить" onClick={handleRedoClick}>
            ↷
          </IconButton>
        </ToolbarItem>
      </Toolbar>
    );

    expect(screen.getByRole('toolbar', { name: 'История' })).toBeDefined();

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Отменить' }));

    await user.keyboard('{ArrowRight}');

    expect(document.activeElement).toBe(
      screen.getByRole('button', { name: 'Повторить' })
    );

    await user.keyboard('{Enter}');

    expect(handleRedoClick).toHaveBeenCalledOnce();
    expect(handleUndoClick).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('называется подписью и не нажимается, когда недоступна', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    render(
      <IconButton label="Отменить" isDisabled onClick={handleClick}>
        ↶
      </IconButton>
    );

    await user.click(screen.getByRole('button', { name: 'Отменить' }));

    expect(handleClick).not.toHaveBeenCalled();
  });
});

describe('FileInput', () => {
  /**
   * Скрытое поле выбора файла: в дереве доступности его нет, файл в него
   * кладёт тест, как положил бы системный диалог.
   *
   * @param container — корень отрисованного контрола
   * @returns поле выбора файла
   */
  const getFileField = (container: HTMLElement): HTMLInputElement => {
    const field = container.querySelector<HTMLInputElement>('input[type="file"]');

    if (!field) {
      throw new Error('Нет поля выбора файла');
    }

    return field;
  };

  it('показывает кнопку с русским текстом вместо родного вида поля', () => {
    render(<FileInput label="Свой шрифт (.ttf)" accept=".ttf" onSelect={vi.fn()} />);

    const button = screen.getByRole('button', { name: 'Свой шрифт (.ttf)' });

    expect(button.textContent).toBe('Выбрать файл');
    expect(screen.getByText('Файл не выбран')).toBeDefined();
    expect(screen.queryByText(/choose file|no file chosen/i)).toBeNull();
  });

  it('отдаёт выбранный файл и показывает его имя', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();
    const file = new File(['x'], 'почерк.ttf', { type: 'font/ttf' });
    const { container } = render(
      <FileInput label="Свой шрифт (.ttf)" accept=".ttf" onSelect={handleSelect} />
    );

    await user.upload(getFileField(container), file);

    expect(handleSelect).toHaveBeenCalledWith(file);
    expect(screen.getByText('почерк.ttf')).toBeDefined();
  });

  it.each([['{Enter}'], [' ']])(
    'клавиша %s на кнопке открывает выбор файла',
    async (key) => {
      const user = userEvent.setup();
      const { container } = render(
        <FileInput label="Своя сцена" accept="image/*" onSelect={vi.fn()} />
      );
      const handleFieldClick = vi.fn();

      getFileField(container).addEventListener('click', handleFieldClick);

      await user.tab();

      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Своя сцена' })
      );

      await user.keyboard(key);

      expect(handleFieldClick).toHaveBeenCalledTimes(1);
    }
  );

  it('связывает ошибку и имя файла с кнопкой как описание', () => {
    render(
      <FileInput
        label="Свой шрифт (.ttf)"
        accept=".ttf"
        error="Не удалось прочитать шрифт"
        onSelect={vi.fn()}
      />
    );

    const button = screen.getByRole('button', { name: 'Свой шрифт (.ttf)' });
    const describedBy = button.getAttribute('aria-describedby') || '';
    const description = describedBy
      .split(' ')
      .map((id) => {
        return document.getElementById(id)?.textContent;
      })
      .join(' ');

    expect(description).toBe('Файл не выбран Не удалось прочитать шрифт');
  });

  it('недоступный контрол не открывает выбор', () => {
    render(
      <FileInput label="Своя сцена" accept="image/*" isDisabled onSelect={vi.fn()} />
    );

    expect(screen.getByRole('button', { name: 'Своя сцена' })).toHaveProperty(
      'disabled',
      true
    );
  });
});
