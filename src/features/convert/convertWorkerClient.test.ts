import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { wrap } from 'comlink';
import { getConvertWorkerApi } from './convertWorkerClient';

vi.mock('comlink', () => ({ wrap: vi.fn() }));

class TestWorker {
  static instances: TestWorker[] = [];
  onerror: (() => void) | null = null;
  onmessageerror: (() => void) | null = null;
  terminate = vi.fn();
  constructor() { TestWorker.instances.push(this); }
}

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers();
  TestWorker.instances = [];
  vi.stubGlobal('window', {});
  vi.stubGlobal('Worker', TestWorker);
  vi.stubGlobal('OffscreenCanvas', class {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function mockRequest(promise: Promise<Blob>) {
  // Only the RPC method is exercised; Comlink's proxy-control symbols are unused.
  vi.mocked(wrap).mockReturnValueOnce({ convertImageInWorker: () => promise } as unknown as ReturnType<typeof wrap>);
}

describe('conversion worker lifecycle', () => {
  it('rejects a crashed job without interrupting another conversion', async () => {
    let finish!: (blob: Blob) => void;
    mockRequest(new Promise(() => {}));
    mockRequest(new Promise((resolve) => { finish = resolve; }));
    const api = getConvertWorkerApi()!;
    const failed = api.convertImageInWorker(new Blob(), 'png');
    const success = api.convertImageInWorker(new Blob(), 'webp');
    const rejection = expect(failed).rejects.toThrow('worker failed');
    TestWorker.instances[0].onerror!();
    await rejection;
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
    expect(TestWorker.instances[1].terminate).not.toHaveBeenCalled();
    const output = new Blob(['ok'], { type: 'image/webp' });
    finish(output);
    expect(await success).toBe(output);
    expect(TestWorker.instances[1].terminate).toHaveBeenCalledOnce();
  });

  it('disposes an ordinary failed job and can start a fresh one', async () => {
    mockRequest(Promise.reject(new Error('Invalid image')));
    await expect(getConvertWorkerApi()!.convertImageInWorker(new Blob(), 'png')).rejects.toThrow('Invalid image');
    const output = new Blob(['ok']);
    mockRequest(Promise.resolve(output));
    expect(await getConvertWorkerApi()!.convertImageInWorker(new Blob(), 'png')).toBe(output);
    expect(TestWorker.instances).toHaveLength(2);
    expect(TestWorker.instances.every((worker) => worker.terminate.mock.calls.length === 1)).toBe(true);
  });

  it('rejects an unreadable worker response', async () => {
    mockRequest(new Promise(() => {}));
    const request = getConvertWorkerApi()!.convertImageInWorker(new Blob(), 'png');
    const rejection = expect(request).rejects.toThrow('worker response');
    TestWorker.instances[0].onmessageerror!();
    await rejection;
  });

  it('times out a worker that never responds', async () => {
    mockRequest(new Promise(() => {}));
    const request = getConvertWorkerApi()!.convertImageInWorker(new Blob(), 'png');
    const rejection = expect(request).rejects.toThrow('timed out');
    await vi.advanceTimersByTimeAsync(120_000);
    await rejection;
    expect(TestWorker.instances[0].terminate).toHaveBeenCalledOnce();
  });
});
