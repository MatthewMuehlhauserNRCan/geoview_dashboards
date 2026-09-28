import { useChannelStore } from './eventBus';

// Emits a value on a named linking channel (e.g. a chart selection).
export function useEmitChannel(channel: string) {
  const emit = useChannelStore((state) => state.emit);
  return (value: unknown) => {
    if (channel) emit(channel, value);
  };
}

// Reads the current value published on a named linking channel.
export function useListenChannel(channel: string) {
  return useChannelStore((state) => state.values[channel]);
}
