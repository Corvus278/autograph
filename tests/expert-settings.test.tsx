/**
 * @vitest-environment jsdom
 */
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { ExpertSettings } from '@pages/Generator/ui/Generator/SettingsPane/ExpertSettings';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildFamily } from './helpers/paper-family';

/**
 * Подписи групп экспертного режима: каждая — секция аккордеона.
 */
const SECTION_TITLES = ['Геометрия', 'Почерк', 'Лист', 'Чернила', 'Сцена'];

/**
 * Единица или слово шкалы в конце подписи значения: доли шага, градусы,
 * пиксели, проценты, частоты словами.
 */
const UNIT_PATTERN = /(шаг|шага|шагов|°|px|%|редко|иногда|часто)$/;

/**
 * Раскрывает экспертный режим и все его группы.
 *
 * @param user — сессия `userEvent`
 */
const openAll = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: 'Экспертный режим' }));

  for (const title of SECTION_TITLES) {
    await user.click(screen.getByRole('button', { name: title }));
  }
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  useGeneratorStore.getState().setPresetFamilies([buildFamily(3)]);
  globalThis.localStorage?.clear();
});

afterEach(() => {
  cleanup();
});

describe('экспертный режим', () => {
  it('свёрнут по умолчанию', () => {
    render(<ExpertSettings />);

    expect(
      screen
        .getByRole('button', { name: 'Экспертный режим' })
        .getAttribute('aria-expanded')
    ).toBe('false');
    expect(screen.queryByRole('slider')).toBeNull();
  });

  it('раскрытый даёт все настройки из спеки', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);

    [
      'Размер шрифта',
      'Ширина блока',
      'Межстрочный интервал',
      'Вертикальный сдвиг',
      'Левый отступ',
      'Запас снизу',
      'Как часто искажать слово',
      'Сколько букв искажать',
    ].forEach((name) => {
      expect(screen.getByRole('slider', { name })).toBeDefined();
    });
    [
      'Случайный поворот слова',
      'Случайный наклон слова',
      'Случайный сдвиг слова по вертикали',
      'Случайное расстояние между буквами',
      'Случайная подмена шрифта буквы',
      'Съезд линий',
      'Случайный сдвиг строки',
      'Вариативность контуров букв',
      'Вкладывать страницу в сцену',
    ].forEach((name) => {
      expect(screen.getByRole('checkbox', { name })).toBeDefined();
    });
    expect(screen.getByRole('radiogroup', { name: 'Экземпляр листа' })).toBeDefined();
    expect(screen.getByLabelText('Свой цвет чернил')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Сбросить поправку' })).toBeDefined();
  });

  it('у каждого слайдера значение подписано с единицей или словом шкалы', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);
    await user.click(
      screen.getByRole('checkbox', { name: 'Вкладывать страницу в сцену' })
    );

    const sliders = screen.getAllByRole('slider');

    /**
     * Восемь слайдеров геометрии и частот и пять — сцены: без счёта проверка
     * прошла бы и на экране, где часть слайдеров потерялась.
     */
    expect(sliders).toHaveLength(13);
    sliders.forEach((slider) => {
      expect(slider.getAttribute('aria-valuetext')).toMatch(UNIT_PATTERN);
    });
  });

  it('поправка интервала подписана долями шага со знаком', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);

    const slider = screen.getByRole('slider', { name: 'Межстрочный интервал' });

    slider.focus();
    await user.keyboard('{ArrowRight}');

    /**
     * Число и единица разделены неразрывным пробелом: подпись не рвётся
     * переносом между ними.
     */
    expect(slider.getAttribute('aria-valuetext')).toBe('+0,01\u00A0шага');
    expect(screen.getByText('+0,01 шага')).toBeDefined();
  });

  it('частоты подписаны словами, и шкалы у слова и буквы направлены по смыслу', async () => {
    const user = userEvent.setup();

    useGeneratorStore.setState({
      realism: {
        ...DEFAULT_GENERATOR_STATE.realism,
        wordFrequency: 1,
        letterFrequency: 1,
      },
    });
    render(<ExpertSettings />);
    await openAll(user);

    expect(
      screen
        .getByRole('slider', { name: 'Как часто искажать слово' })
        .getAttribute('aria-valuetext')
    ).toBe('очень часто');
    expect(
      screen
        .getByRole('slider', { name: 'Сколько букв искажать' })
        .getAttribute('aria-valuetext')
    ).toBe('очень редко');
  });

  it('шаг слайдера — один шаг истории, отменяется целиком', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);

    const slider = screen.getByRole('slider', { name: 'Ширина блока' });

    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(useGeneratorStore.getState().geometryCorrection.blockWidth).toBe(0.1);
    expect(useGeneratorStore.getState().history.past).toHaveLength(1);

    useGeneratorStore.getState().undo();

    expect(useGeneratorStore.getState().geometryCorrection.blockWidth).toBe(0);
  });

  it('правка частоты переводит уровень реализма в «Свой»', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);

    const slider = screen.getByRole('slider', { name: 'Сколько букв искажать' });

    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(useGeneratorStore.getState().realism.level).toBe('custom');
  });

  it('выключение искажения переводит уровень реализма в «Свой»', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);
    await user.click(screen.getByRole('checkbox', { name: 'Случайный поворот слова' }));

    expect(useGeneratorStore.getState().realism.level).toBe('custom');
    expect(useGeneratorStore.getState().realism.flags.isWordRotated).toBe(false);
  });

  it('закрепление экземпляра: выбор листа закрепляет его, «Авто» снимает', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);

    const [, second] = useGeneratorStore.getState().presetFamilies[0]?.sheets || [];

    await user.click(screen.getByRole('radio', { name: second?.label || '' }));

    expect(useGeneratorStore.getState()).toMatchObject({
      sheetId: second?.id,
      isSheetPinned: true,
    });

    await user.click(screen.getByRole('radio', { name: 'Авто — по рецепту' }));

    expect(useGeneratorStore.getState().isSheetPinned).toBe(false);
  });

  it('произвольный цвет чернил переключает чернила на свой цвет', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);
    fireEvent.input(screen.getByLabelText('Свой цвет чернил'), {
      target: { value: '#123456' },
    });

    expect(useGeneratorStore.getState().ink).toStrictEqual({
      kind: 'custom',
      color: '#123456',
    });
  });

  it('сцена выключена: виден только переключатель, параметры скрыты', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);

    expect(
      screen.getByRole('checkbox', { name: 'Вкладывать страницу в сцену' })
    ).toBeDefined();
    expect(screen.queryByRole('slider', { name: 'Поворот страницы' })).toBeNull();
    expect(screen.queryByRole('radiogroup', { name: 'Сцена' })).toBeNull();
    expect(screen.queryByLabelText('Своя сцена')).toBeNull();
  });

  it('поворот в сцене подписан градусами', async () => {
    const user = userEvent.setup();

    render(<ExpertSettings />);
    await openAll(user);
    await user.click(
      screen.getByRole('checkbox', { name: 'Вкладывать страницу в сцену' })
    );

    const slider = screen.getByRole('slider', { name: 'Поворот страницы' });

    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(slider.getAttribute('aria-valuetext')).toBe('1°');
    expect(useGeneratorStore.getState().sceneRotate).toBe(1);
  });
});
