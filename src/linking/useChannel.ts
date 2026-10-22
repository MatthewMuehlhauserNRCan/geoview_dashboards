import { useCallback } from 'react';
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

// Reads and merges several named channels' FieldFilterValue into one combined object, so a panel
// can react to independently-managed cross-filters at once (e.g. a filter panel's own channel AND
// a legend's own channel) without the two having to share a single channel - which matters when
// their value spaces aren't compatible (see LegendPanel's "cesi-legend-filter" split for why).
// Non-FieldFilterValue channel values (or channels with nothing published yet) are ignored.
export function useListenChannels(channels: string[]): FieldFilterValue | undefined {
  const allValues = useChannelStore((state) => state.values);
  if (channels.length === 0) return undefined;
  return channels.reduce<FieldFilterValue>((merged, channel) => {
    const value = allValues[channel];
    return isFieldFilterValue(value) ? { ...merged, ...value } : merged;
  }, {});
}

// Merges one field's selected values into a channel's current FieldFilterValue - plain (non-hook)
// so it can be called imperatively for an arbitrary/dynamic channel (e.g. a title menu option's
// own configured list of {channel, field} pairs), not just a single fixed one resolved at render.
export function setChannelField(channel: string, field: string, values: string[]) {
  if (!channel) return;
  const { values: channelValues, emit } = useChannelStore.getState();
  const current = channelValues[channel];
  const base: FieldFilterValue = isFieldFilterValue(current) ? current : {};
  emit(channel, { ...base, [field]: values });
}

// Merges one field's selected values into a channel's current FieldFilterValue, so independent
// panels (e.g. a filter panel's dropdowns and a chart's click-to-select) can each contribute part
// of the same combined cross-filter without clobbering each other's fields. Memoized on `channel`
// so its identity stays stable across renders - needed by any caller that uses it inside a
// `useEffect` dependency array (an unstable function reference would otherwise re-fire that
// effect, and re-emitting on every render, every render forever if that effect's own emission
// causes this component to re-render too, e.g. by listening to the same channel it writes to).
export function useSetChannelField(channel: string) {
  return useCallback((field: string, values: string[]) => setChannelField(channel, field, values), [channel]);
}

