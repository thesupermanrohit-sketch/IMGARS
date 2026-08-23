import { describe, it, expect, beforeEach } from 'vitest';
import { useForgeStore } from './useForgeStore';

describe('useForgeStore', () => {
  beforeEach(() => {
    useForgeStore.setState({
      activeTab: 'compress',
      queue: [],
      isProcessingAll: false,
      globalConvertFormat: 'webp',
      compressTargetSizeKb: 100,
      compressResolutionPreset: 'web',
      increaseSizeTargetSizeKb: 500,
    });
  });

  it('initializes with default values', () => {
    const state = useForgeStore.getState();
    expect(state.activeTab).toBe('compress');
    expect(state.queue).toEqual([]);
    expect(state.globalConvertFormat).toBe('webp');
    expect(state.compressTargetSizeKb).toBe(100);
    expect(state.compressResolutionPreset).toBe('web');
    expect(state.increaseSizeTargetSizeKb).toBe(500);
  });

  it('updates activeTab correctly', () => {
    const { setActiveTab } = useForgeStore.getState();
    setActiveTab('convert');
    expect(useForgeStore.getState().activeTab).toBe('convert');

    setActiveTab('imagePdf');
    expect(useForgeStore.getState().activeTab).toBe('imagePdf');

    setActiveTab('increaseSize');
    expect(useForgeStore.getState().activeTab).toBe('increaseSize');
  });

  it('updates increaseSize settings and clamps bounds', () => {
    const { setIncreaseSizeTargetSizeKb } = useForgeStore.getState();
    setIncreaseSizeTargetSizeKb(750);
    expect(useForgeStore.getState().increaseSizeTargetSizeKb).toBe(750);

    // Should clamp lower bound to 1 KB
    setIncreaseSizeTargetSizeKb(-100);
    expect(useForgeStore.getState().increaseSizeTargetSizeKb).toBe(1);
  });

  it('updates compress settings and clamps bounds', () => {
    const { setCompressTargetSizeKb, setCompressResolutionPreset } = useForgeStore.getState();
    setCompressTargetSizeKb(250);
    expect(useForgeStore.getState().compressTargetSizeKb).toBe(250);


    // Should clamp lower bound to 1 KB
    setCompressTargetSizeKb(-50);
    expect(useForgeStore.getState().compressTargetSizeKb).toBe(1);

    setCompressResolutionPreset('fullHd');
    expect(useForgeStore.getState().compressResolutionPreset).toBe('fullHd');
  });

  it('updates global convert format and synchronizes queue formats', () => {
    useForgeStore.setState({
      queue: [
        {
          id: '1',
          name: 'test.jpg',
          type: 'image/jpeg',
          originalSize: 1024,
          status: 'pending',
          outputFormat: 'webp',
        },
      ],
    });

    const { setGlobalConvertFormat } = useForgeStore.getState();
    setGlobalConvertFormat('png');

    const state = useForgeStore.getState();
    expect(state.globalConvertFormat).toBe('png');
    expect(state.queue[0].outputFormat).toBe('png');
  });

  it('reorders queue correctly', () => {
    useForgeStore.setState({
      queue: [
        { id: '1', name: 'img1.png', type: 'image/png', originalSize: 100, status: 'pending' },
        { id: '2', name: 'img2.png', type: 'image/png', originalSize: 200, status: 'pending' },
        { id: '3', name: 'img3.png', type: 'image/png', originalSize: 300, status: 'pending' },
      ],
    });

    const { reorderQueue } = useForgeStore.getState();
    // Move item '3' to position of '1'
    reorderQueue('3', '1');

    const newOrder = useForgeStore.getState().queue.map((i) => i.id);
    expect(newOrder).toEqual(['3', '1', '2']);
  });
});
