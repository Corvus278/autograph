/**
 * @vitest-environment jsdom
 */
import { useExportPage } from '@pages/Generator/model/useExportPage';
import type { ExportDeps } from '@pages/Generator/model/useExportPage.types';
import {
  DEFAULT_GENERATOR_STATE,
  useGeneratorStore,
} from '@pages/Generator/model/useGeneratorStore';
import { Button } from '@shared/ui/Button';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { FC } from 'react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type HarnessProps = {
  /**
   * Подменённые зависимости экспорта.
   */
  deps: Partial<ExportDeps>;
};

/**
 * Повторяет кнопку сохранения, но с подменёнными снимком и скачиванием:
 * настоящий `html-to-image` в jsdom не работает.
 */
const Harness: FC<HarnessProps> = (props) => {
  const { deps } = props;
  const pageRef = useRef<HTMLDivElement>(null);
  const { error, save } = useExportPage(pageRef, deps);

  const handleSaveClick = () => {
    void save();
  };

  return (
    <>
      <div ref={pageRef} />

      <Button onClick={handleSaveClick}>Сохранить PNG</Button>

      {error ? <p role="alert">{error}</p> : null}
    </>
  );
};

beforeEach(() => {
  useGeneratorStore.setState(DEFAULT_GENERATOR_STATE);
});

afterEach(() => {
  cleanup();
});

describe('сохранение страницы', () => {
  it('скачивает снимок страницы, когда сцена выключена', async () => {
    const user = userEvent.setup();
    const download = vi.fn();
    const composeScene = vi.fn();

    render(
      <Harness
        deps={{
          renderPage: () => {
            return Promise.resolve('data:image/png;base64,page');
          },
          composeScene,
          download,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Сохранить PNG' }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith(
        'data:image/png;base64,page',
        'handwriting_page.png'
      );
    });

    expect(composeScene).not.toHaveBeenCalled();
  });

  it('скачивает композицию, когда режим сцены включён', async () => {
    const user = userEvent.setup();
    const download = vi.fn();

    useGeneratorStore.setState({ isSceneEnabled: true });

    render(
      <Harness
        deps={{
          renderPage: () => {
            return Promise.resolve('data:image/png;base64,page');
          },
          composeScene: () => {
            return Promise.resolve('data:image/png;base64,scene');
          },
          download,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Сохранить PNG' }));

    await waitFor(() => {
      expect(download).toHaveBeenCalledWith(
        'data:image/png;base64,scene',
        'handwriting_with_bg.png'
      );
    });
  });

  it('при отказе рендера не скачивает файл и показывает сообщение', async () => {
    const user = userEvent.setup();
    const download = vi.fn();

    render(
      <Harness
        deps={{
          renderPage: () => {
            return Promise.reject(new Error('рендер не удался'));
          },
          download,
        }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Сохранить PNG' }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain(
        'Не удалось сохранить страницу'
      );
    });

    expect(download).not.toHaveBeenCalled();
  });
});
