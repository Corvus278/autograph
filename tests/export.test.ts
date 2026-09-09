import { fitPageIntoScene } from '@pages/Generator/lib/export/fitPageIntoScene';
import { describe, expect, it } from 'vitest';

describe('fitPageIntoScene', () => {
  it('оставляет размер, когда страница помещается в сцену', () => {
    const placement = fitPageIntoScene({
      pageWidth: 400,
      pageHeight: 500,
      sceneWidth: 1000,
      sceneHeight: 1000,
      scale: 0,
    });

    expect(placement.width).toBe(400);
    expect(placement.height).toBe(500);
    expect(placement.x).toBe(300);
    expect(placement.y).toBe(250);
  });

  it('уменьшает страницу шире сцены с сохранением пропорций', () => {
    const placement = fitPageIntoScene({
      pageWidth: 2000,
      pageHeight: 1000,
      sceneWidth: 1000,
      sceneHeight: 1000,
      scale: 0,
    });

    expect(placement.width).toBe(1000);
    expect(placement.height).toBe(500);
    expect(placement.width / placement.height).toBe(2);
  });

  it('вписывает по высоте в вертикальную сцену', () => {
    const placement = fitPageIntoScene({
      pageWidth: 700,
      pageHeight: 900,
      sceneWidth: 800,
      sceneHeight: 450,
      scale: 0,
    });

    expect(placement.height).toBeCloseTo(450);
    expect(placement.width).toBeCloseTo(350);
    expect(placement.y).toBeCloseTo(0);
  });

  it('прибавляет масштаб к ширине и держит пропорции', () => {
    const placement = fitPageIntoScene({
      pageWidth: 400,
      pageHeight: 800,
      sceneWidth: 1000,
      sceneHeight: 2000,
      scale: 100,
    });

    expect(placement.width).toBe(500);
    expect(placement.height).toBe(1000);
  });

  it('не уходит в отрицательный размер при большом отрицательном масштабе', () => {
    const placement = fitPageIntoScene({
      pageWidth: 400,
      pageHeight: 800,
      sceneWidth: 1000,
      sceneHeight: 2000,
      scale: -1000,
    });

    expect(placement.width).toBeGreaterThan(0);
    expect(placement.height).toBeGreaterThan(0);
  });

  it('на пустом снимке не делит на ноль', () => {
    const placement = fitPageIntoScene({
      pageWidth: 0,
      pageHeight: 0,
      sceneWidth: 1000,
      sceneHeight: 800,
      scale: 0,
    });

    expect(placement).toEqual({ width: 0, height: 0, x: 500, y: 400 });
  });
});
