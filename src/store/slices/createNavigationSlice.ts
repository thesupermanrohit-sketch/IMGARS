import type { StateCreator } from 'zustand';
import type { ForgeState, NavigationSlice } from '../../types/store';

export const createNavigationSlice: StateCreator<
  ForgeState,
  [],
  [],
  NavigationSlice
> = (set) => ({
  activeTab: 'compress',
  setActiveTab: (tab) => set({ activeTab: tab }),
});
