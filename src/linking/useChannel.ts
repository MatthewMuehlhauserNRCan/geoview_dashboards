import { useChannelStore } from './eventBus';
import { isFieldFilterValue, type FieldFilterValue } from './rowFilter';

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

// Merges one field's selected values into a channel's current FieldFilterValue, so independent
// panels (e.g. a filter panel's dropdowns and a chart's click-to-select) can each contribute part
// of the same combined cross-filter without clobbering each other's fields.
export function useSetChannelField(channel: string) {
  return (field: string, values: string[]) => {
    if (!channel) return;
    const { values: channelValues, emit } = useChannelStore.getState();
    const current = channelValues[channel];
    const base: FieldFilterValue = isFieldFilterValue(current) ? current : {};
    emit(channel, { ...base, [field]: values });
  };
}

