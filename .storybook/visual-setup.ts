import { afterEach, expect } from 'vitest';
import { page } from 'vitest/browser';

import '../src/app/styles/app.css';

/**
 * Переходы и анимации выключены: снимок мог поймать середину раскрытия
 * аккордеона или появления фокусного кольца — и эталон разъезжался от прогона
 * к прогону.
 */
const style = document.createElement('style');

style.textContent = `*, *::before, *::after {
  animation: none !important;
  transition: none !important;
}`;
document.head.append(style);

/**
 * Stories, снимать которые незачем: это функциональные пробы разбивки на
 * настоящем измерителе, а не витрина — оформления в них нет, и эталон ничего
 * не сторожит.
 */
const SKIPPED_STORY_FILES = ['RealLayout.stories.tsx'];

/**
 * Снимок после каждой story. Снимается всё окно предпросмотра: у панели и
 * страницы важна вся раскладка, а не отдельный узел.
 *
 * Стили подключаются выше: в прогоне stories через vitest тестовая страница
 * своя, и без явного импорта снимок вышел бы без оформления.
 */
afterEach(async (context) => {
  const fileName = context.task.file?.name ?? '';

  if (
    SKIPPED_STORY_FILES.some((skipped) => {
      return fileName.endsWith(skipped);
    })
  ) {
    return;
  }

  /**
   * Рукописные шрифты грузятся асинхронно: снимок, сделанный до их
   * применения, отличается от эталона целыми строками текста.
   */
  await document.fonts.ready;

  await expect(page.elementLocator(document.body)).toMatchScreenshot(context.task.name);
});
