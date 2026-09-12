/**
 * @vitest-environment jsdom
 */
import { GRID_RULING } from '@pages/Generator/config';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { SettingsPanel } from '@pages/Generator/ui/Generator/SettingsPanel';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createSyntheticSheet } from './helpers/synthetic-sheet';

/**
 * Съём пикселей с фотографии подменяется: канвы в jsdom нет, а проверяется
 * здесь не декодирование, а то, что панель делает с результатом измерений.
 */
const { decodeSheetImage } = vi.hoisted(() => {
  return { decodeSheetImage: vi.fn() };
});

vi.mock(
  '@pages/Generator/ui/Generator/SettingsPanel/PaperGroup/useSheetImport/decodeSheetImage',
  () => {
    return { decodeSheetImage };
  }
);

/**
 * Настоящий `.ttf` начинается с версии sfnt `00 01 00 00`; заглушка FontFace в
 * тестовом окружении разбирает файл по первому байту.
 */
const buildFontFile = (): File => {
  return new File([new Uint8Array([0, 1, 0, 0])], 'font.ttf');
};

/**
 * Имя с расширением `.ttf` обязательно: браузер (и `user.upload`) не отдаёт
 * контролу файл, который не подходит под `accept`, — до разбора дело не дойдёт.
 */
const buildBrokenFontFile = (): File => {
  return new File(['совсем не шрифт'], 'font.ttf');
};

/**
 * Фотография листа. Содержимое файла не важно: пиксели всё равно приходят из
 * подменённого съёма, а по имени файла лист называется в списке.
 */
const buildPhotoFile = (): File => {
  return new File([new Uint8Array([1, 2, 3])], 'моя тетрадь.jpg', {
    type: 'image/jpeg',
  });
};

/**
 * Снимок листа в линейку с известным шагом: по нему проверяется и удачное
 * определение, и то, что при пометке «чистый» разлиновку не ищут — хотя она на
 * снимке есть.
 */
const RULED_PHOTO = {
  width: 420,
  height: 560,
  step: 23.5,
  phase: 8,
  margins: { top: 78.5, right: 36, bottom: 82, left: 60 },
  marginLineX: 96,
};

/**
 * Снимок без разлиновки с шумом и неровным светом: на таком автоопределение
 * обязано сдаться, а не выдумать шаг.
 */
const BLANK_PHOTO = {
  ...RULED_PHOTO,
  kind: 'blank' as const,
  marginLineX: null,
  noise: 0.06,
  lighting: 0.3,
};

const store = () => {
  return useGeneratorStore.getState();
};

/**
 * Характеристики единственного загруженного листа.
 */
const readUserSheet = () => {
  const [record] = store().userSheets;

  return record?.sheet;
};

/**
 * Разворачивает группу настроек: по умолчанию открыта только первая.
 */
const openSection = async (user: ReturnType<typeof userEvent.setup>, title: string) => {
  await user.click(screen.getByRole('button', { name: title }));
};

/**
 * Открывает «Бумагу» и загружает фотографию листа, дождавшись, пока экземпляр
 * появится в сторе.
 */
const uploadPhoto = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.upload(screen.getByLabelText('Своя фотография листа'), buildPhotoFile());

  await waitFor(() => {
    expect(store().userSheets).toHaveLength(1);
  });
};

/**
 * Заполняет форму разлиновки и применяет её.
 */
const applyRuling = async (
  user: ReturnType<typeof userEvent.setup>,
  step: string,
  firstLine: string
) => {
  const stepField = screen.getByLabelText('Шаг строк, px');
  const firstLineField = screen.getByLabelText('Первая строка от верха, px');

  await user.clear(stepField);
  await user.type(stepField, step);
  await user.clear(firstLineField);
  await user.type(firstLineField, firstLine);
  await user.click(screen.getByRole('button', { name: 'Применить разлиновку' }));
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  globalThis.localStorage?.clear();
  decodeSheetImage.mockReset();
  decodeSheetImage.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
});

describe('группа «Текст и шрифт»', () => {
  it('меняет текст в сторе', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    const field = screen.getByRole('textbox', { name: 'Текст' });

    await user.clear(field);
    await user.type(field, 'привет');

    expect(store().text).toBe('привет');
  });

  it('подключает свой шрифт и позволяет вернуться к списку', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    await user.upload(screen.getByLabelText('Свой шрифт (.ttf)'), buildFontFile());

    await waitFor(() => {
      expect(store().customFontFamily).toBe('UserFont');
    });

    await user.click(screen.getByRole('button', { name: 'Вернуть из списка' }));

    expect(store().customFontFamily).toBeNull();
  });

  it('показывает ошибку на нечитаемом файле и не меняет шрифт', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    await user.upload(screen.getByLabelText('Свой шрифт (.ttf)'), buildBrokenFontFile());

    await waitFor(() => {
      expect(
        screen.getByText('Не удалось прочитать шрифт. Нужен файл .ttf')
      ).toBeDefined();
    });

    expect(store().customFontFamily).toBeNull();
  });

  it('меняет цвет чернил', async () => {
    render(<SettingsPanel />);

    const control = screen.getByLabelText('Цвет чернил');

    expect(control.getAttribute('value')).toBe(DEFAULT_GENERATOR_STATE.inkColor);
  });
});

describe('группа «Геометрия»', () => {
  it('слайдер правит поправку геометрии и подпись рядом с контролом', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Геометрия');

    const slider = screen.getByRole('slider', { name: 'Ширина блока' });

    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(store().geometryCorrection.blockWidth).toBe(0.1);
    expect(slider.getAttribute('aria-valuenow')).toBe('0.1');
  });

  it('поправка и запас снизу ходят долями шага разлиновки', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Геометрия');

    const fontSize = screen.getByRole('slider', { name: 'Размер шрифта' });
    const topOffset = screen.getByRole('slider', { name: 'Вертикальный сдвиг' });
    const bottomMargin = screen.getByRole('slider', { name: 'Высота нижнего поля' });

    expect(fontSize.getAttribute('aria-valuemax')).toBe('0.25');
    expect(topOffset.getAttribute('aria-valuemin')).toBe('-2');
    expect(topOffset.getAttribute('aria-valuemax')).toBe('2');
    expect(bottomMargin.getAttribute('aria-valuemax')).toBe('20');

    fontSize.focus();
    await user.keyboard('{ArrowRight}');
    topOffset.focus();
    await user.keyboard('{ArrowLeft}');
    bottomMargin.focus();
    await user.keyboard('{ArrowRight}');

    expect(store().geometryCorrection.fontSizePx).toBe(0.01);
    expect(store().geometryCorrection.topOffset).toBe(-0.05);
    expect(store().bottomMargin).toBe(1);
  });

  it('«Сбросить поправку» возвращает геометрию к вычисленной', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Геометрия');

    const slider = screen.getByRole('slider', { name: 'Левый отступ' });

    slider.focus();
    await user.keyboard('{ArrowRight}');

    expect(store().geometryCorrection.leftPadding).toBe(0.05);

    await user.click(screen.getByRole('button', { name: 'Сбросить поправку' }));

    expect(store().geometryCorrection).toEqual(
      DEFAULT_GENERATOR_STATE.geometryCorrection
    );
  });

  it('отступ чётных страниц и поворот блока отдельно не настраиваются', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Геометрия');

    expect(screen.queryByRole('slider', { name: 'Отступ чётных страниц' })).toBeNull();
    expect(screen.queryByRole('slider', { name: 'Поворот блока' })).toBeNull();
  });
});

describe('группа «Бумага»', () => {
  it('обе предустановленные семьи доступны сразу, без своих фотографий', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Бумага');

    expect(store().userSheets).toHaveLength(0);
    expect(
      screen.getByRole('radio', { name: 'В клетку' }).getAttribute('data-disabled')
    ).toBeNull();
    expect(
      screen.getByRole('radio', { name: 'В линейку' }).getAttribute('data-disabled')
    ).toBeNull();
    expect(screen.getAllByRole('radio', { name: /^Клетка \d$/ })).toHaveLength(4);

    await user.click(screen.getByRole('radio', { name: 'В линейку' }));

    expect(store().familyId).toBe('lined');
    expect(store().sheetId).toBe('lined-1');
    expect(screen.getAllByRole('radio', { name: /^Линейка \d$/ })).toHaveLength(4);
  });

  it('экземпляр выбирается внутри семьи', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Бумага');

    await user.click(screen.getByRole('radio', { name: 'Клетка 3' }));

    expect(store().sheetId).toBe('grid-3');
    expect(store().familyId).toBe('grid');
  });

  it('при неудачном определении показывает ручной ввод и оставляет фотографию', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(createSyntheticSheet(BLANK_PHOTO));

    render(<SettingsPanel />);
    await openSection(user, 'Бумага');
    await uploadPhoto(user);

    expect(readUserSheet()?.measuredStep).toBe(0);
    expect(screen.getByRole('radio', { name: 'моя тетрадь' })).toBeDefined();
    expect(
      screen.getByText(
        'Разлиновка не найдена. Задайте шаг, положение первой строки и поля вручную.'
      )
    ).toBeDefined();

    await applyRuling(user, '25', '40');

    expect(readUserSheet()?.measuredStep).toBe(25);
    expect(readUserSheet()?.firstLinePhase).toBe(40);
    expect(readUserSheet()?.normalizeScale).toBeCloseTo(GRID_RULING.step / 25, 6);
  });

  it('найденную разлиновку показывает в форме и даёт поправить', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(createSyntheticSheet(RULED_PHOTO));

    render(<SettingsPanel />);
    await openSection(user, 'Бумага');
    await uploadPhoto(user);

    expect(readUserSheet()?.measuredStep).toBeCloseTo(RULED_PHOTO.step, 0);
    expect(
      Number(screen.getByLabelText('Шаг строк, px').getAttribute('value'))
    ).toBeCloseTo(RULED_PHOTO.step, 0);

    await applyRuling(user, '30', '12');

    expect(readUserSheet()?.measuredStep).toBe(30);
    expect(readUserSheet()?.firstLinePhase).toBe(12);
  });

  it('на чистом листе разлиновку не ищет, а берёт шаг строк от пользователя', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(createSyntheticSheet(RULED_PHOTO));

    render(<SettingsPanel />);
    await openSection(user, 'Бумага');
    await user.click(screen.getByRole('checkbox', { name: 'Лист без разлиновки' }));
    await uploadPhoto(user);

    expect(readUserSheet()?.measuredStep).toBe(0);
    expect(screen.getByLabelText('Шаг строк, px').getAttribute('value')).toBe('');

    await applyRuling(user, '32', '60');

    expect(readUserSheet()?.measuredStep).toBe(32);
    expect(readUserSheet()?.normalizeScale).toBeCloseTo(GRID_RULING.step / 32, 6);
  });

  it('удаляет свой лист из списка', async () => {
    const user = userEvent.setup();

    decodeSheetImage.mockResolvedValue(createSyntheticSheet(RULED_PHOTO));

    render(<SettingsPanel />);
    await openSection(user, 'Бумага');
    await uploadPhoto(user);

    await user.click(screen.getByRole('button', { name: 'Удалить «моя тетрадь»' }));

    expect(store().userSheets).toHaveLength(0);
    expect(screen.queryByRole('radio', { name: 'моя тетрадь' })).toBeNull();
    expect(store().sheetId).toBe('grid-1');
  });
});

describe('группа «Модификации почерка»', () => {
  it('переключатель меняет соответствующий флаг', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Модификации почерка');

    await user.click(screen.getByRole('checkbox', { name: 'Съезд линий' }));

    expect(store().flags.isLineRotated).toBe(true);
    expect(store().flags.isWordRotated).toBe(false);
  });

  it('вариативность контуров включена по умолчанию и выключается', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Модификации почерка');

    const toggle = screen.getByRole('checkbox', { name: 'Вариативность контуров букв' });

    expect(toggle.getAttribute('data-state')).toBe('checked');
    expect(store().hasContourVariance).toBe(true);

    await user.click(toggle);

    expect(toggle.getAttribute('data-state')).toBe('unchecked');
    /**
     * Флаг живёт в сторе, а не в панели: до отрисовки он доходит оттуда же,
     * откуда и остальные параметры почерка.
     */
    expect(store().hasContourVariance).toBe(false);
  });

  it('«Перегенерировать» меняет seed', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Модификации почерка');

    const before = store().seed;

    await user.click(screen.getByRole('button', { name: 'Перегенерировать' }));

    expect(store().seed).not.toBe(before);
  });
});

describe('группа «Сцена для сохранения»', () => {
  it('при выключенном режиме контролы сцены недоступны', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Сцена для сохранения');

    expect(
      screen.getByRole('radio', { name: 'Стол' }).getAttribute('data-disabled')
    ).not.toBeNull();
    expect(screen.getByLabelText('Своя сцена').hasAttribute('disabled')).toBe(true);
    expect(
      screen
        .getByRole('checkbox', { name: 'Тень под страницей' })
        .hasAttribute('disabled')
    ).toBe(true);
  });

  it('после включения режима контролы сцены доступны', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);
    await openSection(user, 'Сцена для сохранения');

    await user.click(
      screen.getByRole('checkbox', { name: 'Вкладывать страницу в сцену' })
    );

    expect(store().isSceneEnabled).toBe(true);
    expect(screen.getByLabelText('Своя сцена').hasAttribute('disabled')).toBe(false);
  });
});

describe('панель настроек', () => {
  it('сворачивает группу, не трогая параметры', async () => {
    const user = userEvent.setup();

    render(<SettingsPanel />);

    expect(screen.getByRole('textbox', { name: 'Текст' })).toBeDefined();

    await user.click(screen.getByRole('button', { name: 'Текст и шрифт' }));

    await waitFor(() => {
      expect(screen.queryByRole('textbox', { name: 'Текст' })).toBeNull();
    });

    expect(store().text).toBe(DEFAULT_GENERATOR_STATE.text);
  });
});
