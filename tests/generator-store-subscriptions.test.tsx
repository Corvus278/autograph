/**
 * @vitest-environment jsdom
 */
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { act, cleanup, render } from '@testing-library/react';
import type { FC } from 'react';
import { useEffect } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useShallow } from 'zustand/react/shallow';

const renders = { geometry: 0, scene: 0 };

/**
 * Подписан на одно поле — запас снизу.
 */
const GeometryView: FC = () => {
  const bottomMargin = useGeneratorStore((state) => {
    return state.bottomMargin;
  });

  useEffect(() => {
    renders.geometry += 1;
  });

  return <span>{bottomMargin}</span>;
};

/**
 * Подписан на несколько полей сразу — через `useShallow`, иначе новый объект
 * из селектора перерисовывал бы контролы на любое изменение стора.
 */
const SceneView: FC = () => {
  const { sceneRotate, sceneScale } = useGeneratorStore(
    useShallow((state) => {
      return { sceneRotate: state.sceneRotate, sceneScale: state.sceneScale };
    })
  );

  useEffect(() => {
    renders.scene += 1;
  });

  return (
    <span>
      {sceneRotate}
      {sceneScale}
    </span>
  );
};

/**
 * Автоочистка `@testing-library/react` включается только с глобальными
 * матчерами vitest — здесь их нет, поэтому размонтируем дерево руками. Иначе
 * компоненты прошлого теста остаются подписанными на стор и портят счётчики.
 */
afterEach(() => {
  cleanup();
});

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
  renders.geometry = 0;
  renders.scene = 0;
});

describe('гранулярность подписок', () => {
  it('изменение запаса снизу не перерисовывает контролы сцены', () => {
    render(
      <>
        <GeometryView />
        <SceneView />
      </>
    );

    const sceneRendersBefore = renders.scene;
    const geometryRendersBefore = renders.geometry;

    act(() => {
      useGeneratorStore.getState().setGeometry({ bottomMargin: 4 });
    });

    expect(renders.geometry).toBe(geometryRendersBefore + 1);
    expect(renders.scene).toBe(sceneRendersBefore);
  });

  it('изменение параметров сцены не перерисовывает контролы геометрии', () => {
    render(
      <>
        <GeometryView />
        <SceneView />
      </>
    );

    const sceneRendersBefore = renders.scene;
    const geometryRendersBefore = renders.geometry;

    act(() => {
      useGeneratorStore.getState().setSceneParams({ sceneRotate: 7 });
    });

    expect(renders.scene).toBe(sceneRendersBefore + 1);
    expect(renders.geometry).toBe(geometryRendersBefore);
  });
});
