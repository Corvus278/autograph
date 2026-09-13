import { useEffect } from 'react';

import { loadPaperFamilies } from './paperProfiles';
import { useGeneratorStore } from './useGeneratorStore';

/**
 * Подставляет в стор предустановленные семьи с измеренными характеристиками
 * экземпляров.
 *
 * Без этого генератор работает на семьях из констант, у которых характеристик
 * нет: шаг там — доля кадра, а фаза и поля — догадка, тогда как настоящий шаг
 * разлиновки на фотографии отличается на проценты. Раскладка тогда посчитана
 * по синтезированной разлиновке, и строки садятся мимо линий фотографии — тем
 * заметнее, чем дальше от начала страницы.
 *
 * Артефакт грузится один раз за сеанс: характеристики привязаны к файлам
 * фотографий, а не к состоянию генератора.
 */
export const usePaperProfiles = (): void => {
  const setPresetFamilies = useGeneratorStore((state) => {
    return state.setPresetFamilies;
  });

  useEffect(() => {
    let isCancelled = false;

    const applyProfiles = async () => {
      const families = await loadPaperFamilies();

      if (!isCancelled) {
        setPresetFamilies(families);
      }
    };

    void applyProfiles();

    return () => {
      isCancelled = true;
    };
  }, [setPresetFamilies]);
};
