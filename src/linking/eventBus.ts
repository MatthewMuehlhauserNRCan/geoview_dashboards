import { create } from 'zustand';

interface ChannelState {
  values: Record<string, unknown>;
  emit: (channel: string, value: unknown) => void;
}

// Named pub/sub channels for cross-panel linking (see docs/ARCHITECTURE.md section 6).
export const useChannelStore = create<ChannelState>((set) => ({
  values: {},
  emit: (channel, value) => set((state) => ({ values: { ...state.values, [channel]: value } })),
}));
