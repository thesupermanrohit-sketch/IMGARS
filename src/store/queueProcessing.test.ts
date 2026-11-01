import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useForgeStore } from './useForgeStore';
import { db } from '../db/db';
import { convertImage } from '../features/convert/convertUtil';
import { increaseImageSize } from '../features/increaseSize/increaseSizeUtil';
import type { FileItem } from '../types/store';

vi.mock('../db/db', () => ({
  ensureDbSession: vi.fn().mockResolvedValue(undefined),
  getDbSessionId: () => 'test-session',
  db: {
    images: { get: vi.fn(), update: vi.fn(), delete: vi.fn() },
    deleteImages: vi.fn(),
  },
}));
vi.mock('../features/convert/convertUtil', () => ({ convertImage: vi.fn() }));
vi.mock('../features/increaseSize/increaseSizeUtil', () => ({ increaseImageSize: vi.fn() }));

const originalBlob = new Blob(['original'], { type: 'image/jpeg' });
const webp = new Blob(['webp'], { type: 'image/webp' });
const png = new Blob(['png'], { type: 'image/png' });
const item = (id: string, mode: FileItem['mode'] = 'convert'): FileItem => ({
  id, mode, name: `${id}.jpg`, type: 'image/jpeg', originalSize: originalBlob.size,
  status: 'pending', outputFormat: 'webp',
});

beforeEach(() => {
  vi.resetAllMocks();
  useForgeStore.setState(useForgeStore.getInitialState(), true);
  useForgeStore.setState({ activeTab: 'convert' });
  vi.mocked(db.images.get).mockResolvedValue({ id: 'photo', originalBlob, processedBlob: webp });
  vi.mocked(db.images.update).mockResolvedValue(1);
  vi.mocked(convertImage).mockResolvedValue(png);
  vi.mocked(increaseImageSize).mockResolvedValue({ blob: png, skipped: false });
});

describe('queue processing and downloads', () => {
  it('pins legacy entries to Convert before tab changes, processing, or clearing', async () => {
    useForgeStore.setState({
      activeTab: 'compress',
      queue: [{ ...item('legacy'), mode: undefined, outputFormat: undefined }],
    });
    const legacyEntry = useForgeStore.getState().queue[0];
    expect(legacyEntry.mode).toBe('convert');

    for (const tab of ['compress', 'increaseSize', 'imagePdf'] as const) {
      useForgeStore.getState().setActiveTab(tab);
      await useForgeStore.getState().processAll();
      await useForgeStore.getState().clearQueue();
      expect(useForgeStore.getState().queue).toEqual([legacyEntry]);
      expect(useForgeStore.getState().queue[0]).toBe(legacyEntry);
    }
    expect(db.images.get).not.toHaveBeenCalled();
    expect(db.deleteImages).not.toHaveBeenCalled();

    useForgeStore.getState().setGlobalConvertFormat('png');
    expect(useForgeStore.getState().queue[0].outputFormat).toBe('png');
    useForgeStore.getState().setActiveTab('convert');
    await useForgeStore.getState().processAll();
    expect(convertImage).toHaveBeenCalledExactlyOnceWith(originalBlob, 'png');

    vi.mocked(db.images.get).mockResolvedValue({ id: 'legacy', originalBlob, processedBlob: png });
    for (const tab of ['convert', 'compress', 'increaseSize', 'imagePdf'] as const) {
      useForgeStore.getState().setActiveTab(tab);
      expect(await useForgeStore.getState().getDownloadItem('legacy')).toEqual({
        fileName: 'legacy.png', blob: png,
      });
    }
  });

  it('normalizes functional queue updates without reinterpreting explicit modes', () => {
    const explicit = [item('compress', 'compress'), item('increase', 'increaseSize'), item('pdf', 'imagePdf')];
    useForgeStore.setState({ activeTab: 'imagePdf', queue: explicit });
    useForgeStore.setState((state) => ({ queue: [
      ...state.queue, { ...item('legacy'), mode: undefined },
    ] }));
    useForgeStore.getState().setGlobalConvertFormat('png');
    expect(useForgeStore.getState().queue.map((file) => file.mode)).toEqual([
      'compress', 'increaseSize', 'imagePdf', 'convert',
    ]);
    explicit.forEach((file, index) => expect(useForgeStore.getState().queue[index]).toBe(file));
    expect(useForgeStore.getState().queue[3].outputFormat).toBe('png');
  });

  it('invalidates a completed conversion and processes the new format', async () => {
    useForgeStore.setState({ queue: [{ ...item('photo'), status: 'done', processedSize: webp.size }] });
    useForgeStore.getState().setGlobalConvertFormat('png');
    expect(useForgeStore.getState().queue[0].status).toBe('pending');
    expect(useForgeStore.getState().queue[0].processedSize).toBeUndefined();
    expect(await useForgeStore.getState().getDownloadItem('photo')).toBeNull();
    await useForgeStore.getState().processAll();
    expect(convertImage).toHaveBeenCalledWith(originalBlob, 'png');
    expect(useForgeStore.getState().queue[0].status).toBe('done');
  });

  it('uses the actual output MIME type for download filenames', async () => {
    useForgeStore.setState({ queue: [{ ...item('photo'), status: 'done', outputFormat: 'png' }] });
    const result = await useForgeStore.getState().getDownloadItem('photo');
    expect(result).toEqual({ fileName: 'photo.webp', blob: webp });
  });

  it('discards a result when the format changes during conversion', async () => {
    let finish!: (blob: Blob) => void;
    vi.mocked(convertImage).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    useForgeStore.setState({ queue: [item('photo')] });
    const processing = useForgeStore.getState().processAll();
    await vi.waitFor(() => expect(convertImage).toHaveBeenCalledOnce());
    useForgeStore.getState().setGlobalConvertFormat('png');
    finish(webp);
    await processing;
    expect(db.images.update).not.toHaveBeenCalled();
    expect(useForgeStore.getState().queue[0].status).toBe('pending');
    await useForgeStore.getState().processAll();
    expect(convertImage).toHaveBeenLastCalledWith(originalBlob, 'png');
    expect(useForgeStore.getState().queue[0].status).toBe('done');
  });

  it('processes only files belonging to the active tab', async () => {
    useForgeStore.setState({
      activeTab: 'increaseSize',
      queue: [item('compress', 'compress'), item('convert'), item('increase', 'increaseSize')],
    });
    await useForgeStore.getState().processAll();
    expect(db.images.get).toHaveBeenCalledExactlyOnceWith('increase');
    expect(convertImage).not.toHaveBeenCalled();
    expect(useForgeStore.getState().queue.map((file) => file.status)).toEqual(['pending', 'pending', 'done']);
  });

  it('clears only the visible tab queue', async () => {
    useForgeStore.setState({ queue: [item('compress', 'compress'), item('convert')] });
    await useForgeStore.getState().clearQueue();
    expect(useForgeStore.getState().queue.map((file) => file.id)).toEqual(['compress']);
    expect(db.deleteImages).toHaveBeenCalledExactlyOnceWith(['convert']);
  });

  it('does not invalidate a completed result when selecting the same format', () => {
    useForgeStore.setState({ queue: [{ ...item('photo'), status: 'done' }] });
    useForgeStore.getState().setGlobalConvertFormat('webp');
    expect(useForgeStore.getState().queue[0].status).toBe('done');
  });
});
