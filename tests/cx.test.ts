import { cx } from '@shared/lib/styles';
import { describe, expect, it } from 'vitest';

describe('cx', () => {
  it('схлопывает конфликтующие классы одной группы', () => {
    expect(cx('p-4', 'p-8')).toBe('p-8');
    expect(cx('text-zinc-100', 'text-zinc-400')).toBe('text-zinc-400');
  });

  it('оставляет классы разных групп', () => {
    expect(cx('p-4', 'text-zinc-100')).toBe('p-4 text-zinc-100');
  });

  it('даёт внешнему className перекрыть дефолт компонента', () => {
    const componentClassName = 'rounded-md bg-zinc-900 px-3';
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
    expect(cx('bg-neutral-850', 'bg-zinc-900')).toBe('bg-zinc-900');
    expect(cx('bg-zinc-900', 'bg-neutral-850')).toBe('bg-neutral-850');
  });
});
