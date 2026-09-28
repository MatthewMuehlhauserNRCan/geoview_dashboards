import { MenuItem, TextField } from '@mui/material';
import type { FilterPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useEmitChannel } from '../linking/useChannel';

interface FilterPanelProps {
  panel: FilterPanelConfig;
}

export function FilterPanel({ panel }: FilterPanelProps) {
  const channel = panel.interactions?.emits?.[0] ?? panel.field;
  const emit = useEmitChannel(channel);

  if (panel.control !== 'dropdown') {
    // TODO: implement slider / date-range / search controls
    return <PanelContainer title={panel.title}>Control type "{panel.control}" not yet implemented</PanelContainer>;
  }

  return (
    <PanelContainer title={panel.title}>
      <TextField
        select
        label={panel.field}
        fullWidth
        size="small"
        defaultValue=""
        onChange={(event) => emit(event.target.value)}
      >
        <MenuItem value="">All</MenuItem>
      </TextField>
    </PanelContainer>
  );
}
