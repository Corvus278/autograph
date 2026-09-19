import { cx } from '@shared/lib/styles';
import { describe, expect, it } from 'vitest';

describe('cx', () => {
  it('схлопывает конфликтующие классы одной группы', () => {
    expect(cx('p-4', 'p-8')).toBe('p-8');
    expect(cx('text-fg', 'text-fg-muted')).toBe('text-fg-muted');
  });

  it('оставляет классы разных групп', () => {
    expect(cx('p-4', 'text-fg')).toBe('p-4 text-fg');
  });

  it('даёт внешнему className перекрыть дефолт компонента', () => {
    const componentClassName = 'rounded-md bg-surface px-3';
    const external = 'bg-blue-600';

    expect(cx(componentClassName, external)).toBe('rounded-md px-3 bg-blue-600');
  });

  it('разбирает условия', () => {
    const isLarge = false;

    expect(cx('p-4', isLarge && 'p-8', undefined, ['text-sm'])).toBe('p-4 text-sm');
  });

  it('схлопывает классы с токеном из @theme', () => {
    expect(cx('w-desktop', 'w-full')).toBe('w-full');
    expect(cx('w-full', 'w-desktop')).toBe('w-desktop');
    expect(cx('bg-canvas', 'bg-surface')).toBe('bg-surface');
    expect(cx('bg-surface', 'bg-canvas')).toBe('bg-canvas');
  });
});
