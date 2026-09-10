import { useEffect } from 'react';

import { loadPaperFamilies } from './paperProfiles';
import { useGeneratorStore } from './useGeneratorStore';

/**
 * Подставляет в стор предустановленные семьи с измеренными характеристиками
 * экземпляров.
 *
 * Без этого генератор работает на семьях из констант, у которых характеристик
 * нет: там нормировка и фаза выведены из предположения «кадр — это и есть
 * канонический лист», а настоящий шаг разлиновки на фотографии от
 * канонического отличается на проценты. Разлиновка листа тогда не совпадает с
 * той, по которой посчитана раскладка, и строки садятся мимо линий — тем
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
