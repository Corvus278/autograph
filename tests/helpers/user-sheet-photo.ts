import { MARGIN_LINE_GAP_SHARE } from '@pages/Generator/lib/calibrate';
import type { SheetRuling } from '@pages/Generator/lib/paper';
import { useGeneratorStore } from '@pages/Generator/model/useGeneratorStore';
import { screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';
import { expect } from 'vitest';

import type { SyntheticField, SyntheticSheetParams } from './synthetic-sheet';

/**
 * Снимок листа в линейку с полями со всех сторон и линией поля слева. Верхнее
 * поле стоит ровно на линии разлиновки, нижнее — ровно под последней, поэтому
 * границы области с линиями совпадают с заданными полями.
 */
export const RULED_PHOTO = {
  width: 420,
  height: 560,
  step: 23.5,
  phase: 8,
  margins: { top: 78.5, right: 36, bottom: 82, left: 60 },
  marginLineX: 96,
};

/**
 * Поля, которые детектор находит на этом снимке: верх и низ — на крайних
 * линиях, а бока отступают от границы области с линиями на зазор, как от линии
 * поля, — граница сама служит полем.
 */
export const RULED_PHOTO_FOUND_MARGINS = {
  ...RULED_PHOTO.margins,
  right: RULED_PHOTO.margins.right + RULED_PHOTO.step * MARGIN_LINE_GAP_SHARE,
  left: RULED_PHOTO.margins.left + RULED_PHOTO.step * MARGIN_LINE_GAP_SHARE,
};

/**
 * Прогиб линий между линией поля и правыми концами линий: в середине на три
 * десятых шага вниз, к краям области сходит на нет без излома — за крайним
 * узлом сетка изгиба держит смещение постоянным.
 */
const sagInsideRuledArea: SyntheticField = (x) => {
  const left = RULED_PHOTO.marginLineX;
  const right = RULED_PHOTO.width - RULED_PHOTO.margins.right;
  const share = Math.max(-1, Math.min(1, (2 * x - left - right) / (right - left)));

  return 0.3 * RULED_PHOTO.step * Math.cos((Math.PI * share) / 2) ** 2;
};

/**
 * Тот же снимок с прогнутыми линиями.
 */
export const BENT_PHOTO = {
  ...RULED_PHOTO,
  bend: sagInsideRuledArea,
} satisfies SyntheticSheetParams;

/**
 * Наклон повёрнутого снимка в градусах: в пределах свипа детектора и заметно
 * дальше его допуска от нуля.
 */
export const TILTED_ANGLE = 1.2;

/**
 * Допуски те же, что у детектора: шаг усредняется по всей высоте кадра, поля
 * упираются в дискретность профиля, угол — в шаг свипа.
 */
export const STEP_TOLERANCE = 0.3;

export const MARGIN_TOLERANCE = 3;

export const ANGLE_TOLERANCE = 0.2;

/**
 * Файл фотографии. Содержимое не важно: пиксели приходят из подменённого
 * съёма, а по имени файла лист называется в списке.
 *
 * @returns файл фотографии листа
 */
export const buildPhotoFile = (): File => {
  return new File([new Uint8Array([1, 2, 3])], 'моя тетрадь.jpg', {
    type: 'image/jpeg',
  });
};

/**
 * Разлиновка единственного добавленного листа.
 *
 * @returns разлиновка из стора; `undefined` — листа ещё нет
 */
export const readUserRuling = (): SheetRuling | undefined => {
  const [record] = useGeneratorStore.getState().userSheets;

  return record?.sheet.ruling;
};

/**
 * Загружает фотографию через контрол группы «Бумага» и дожидается листа в
 * сторе: разбор асинхронный.
 *
 * @param user — сессия `userEvent`
 */
export const uploadUserPhoto = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.upload(screen.getByLabelText('Своя фотография листа'), buildPhotoFile());

  await waitFor(() => {
    expect(readUserRuling()).toBeDefined();
  });
};
