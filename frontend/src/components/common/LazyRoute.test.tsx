import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RoutePage } from './LazyRoute';
import { isChunkLoadError, lazyWithRetry } from '../../utils/lazyWithRetry';

// What Chromium throws when a dynamically imported chunk cannot be fetched.
const chunkError = () =>
  new TypeError('Failed to fetch dynamically imported module: http://localhost/assets/Page-abc123.js');

function Page() {
  return <h1>Loaded page</h1>;
}

describe('isChunkLoadError', () => {
  it('recognises the browsers’ messages for a failed dynamic import', () => {
    expect(isChunkLoadError(chunkError())).toBe(true);
    expect(isChunkLoadError(new TypeError('error loading dynamically imported module: /a.js'))).toBe(true);
    expect(isChunkLoadError(new TypeError('Importing a module script failed.'))).toBe(true);
    expect(isChunkLoadError(new Error('Unable to preload CSS for /assets/a.css'))).toBe(true);
  });

  it('does not treat ordinary errors as chunk failures', () => {
    expect(isChunkLoadError(new Error('Cannot read properties of undefined'))).toBe(false);
    expect(isChunkLoadError('Failed to fetch dynamically imported module')).toBe(false);
  });
});

describe('lazy route pages', () => {
  it('shows a loader, then the page', async () => {
    let resolve!: (m: { default: typeof Page }) => void;
    const Lazy = lazyWithRetry(
      () => new Promise<{ default: typeof Page }>((r) => (resolve = r)),
    );
    render(
      <RoutePage>
        <Lazy />
      </RoutePage>,
    );
    expect(screen.getByRole('status', { name: 'Loading page' })).toBeInTheDocument();
    resolve({ default: Page });
    expect(await screen.findByRole('heading', { name: 'Loaded page' })).toBeInTheDocument();
  });

  it('retries a chunk that failed to download once', async () => {
    const factory = vi
      .fn<() => Promise<{ default: typeof Page }>>()
      .mockRejectedValueOnce(chunkError())
      .mockResolvedValueOnce({ default: Page });
    const Lazy = lazyWithRetry(factory, { retryDelayMs: 1 });
    render(
      <RoutePage>
        <Lazy />
      </RoutePage>,
    );
    expect(await screen.findByRole('heading', { name: 'Loaded page' })).toBeInTheDocument();
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('shows a recoverable error, not a blank page, when the chunk keeps failing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const factory = vi.fn<() => Promise<{ default: typeof Page }>>().mockRejectedValue(chunkError());
    const onReload = vi.fn();
    const Lazy = lazyWithRetry(factory, { retryDelayMs: 1 });
    render(
      <RoutePage onReload={onReload}>
        <Lazy />
      </RoutePage>,
    );
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('This page could not be loaded');
    expect(factory).toHaveBeenCalledTimes(2);
    // A rejected lazy() import is cached, so re-rendering cannot help: only Reload is offered.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(onReload).toHaveBeenCalledTimes(1);
  });

  it('does not retry an error thrown while the module evaluates', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const factory = vi
      .fn<() => Promise<{ default: typeof Page }>>()
      .mockRejectedValue(new ReferenceError('x is not defined'));
    const Lazy = lazyWithRetry(factory, { retryDelayMs: 1 });
    render(
      <RoutePage>
        <Lazy />
      </RoutePage>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong on this page');
    expect(factory).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
