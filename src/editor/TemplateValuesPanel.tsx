import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import type { LinkingChannel, TemplateValueConfig } from '../config/types';
import { useEditorStore } from './store';
import { generateId } from './idUtils';

// Stable fallbacks - Zustand 5 selectors must not return a fresh `[]` each call (infinite render loop).
const NO_VALUES: TemplateValueConfig[] = [];
const NO_CHANNELS: LinkingChannel[] = [];

const AGGREGATION_LABELS: Record<NonNullable<TemplateValueConfig['aggregation']>, string> = {
  first: 'First row value',
  count: 'Count of rows',
  sum: 'Sum',
  avg: 'Average',
  min: 'Min',
  max: 'Max',
};

// Dashboard-wide named values (`DashboardConfig.templateValues`), referenced as `{{$id}}` in any
// title text or text/cards template.
export function TemplateValuesPanel() {
  const values = useEditorStore((s) => s.config.templateValues ?? NO_VALUES);
  const dataSources = useEditorStore((s) => s.config.dataSources);
  const channels = useEditorStore((s) => s.config.linking?.channels ?? NO_CHANNELS);
  const setTemplateValues = useEditorStore((s) => s.setTemplateValues);

  const update = (index: number, patch: Partial<TemplateValueConfig>) =>
    setTemplateValues(values.map((value, i) => (i === index ? { ...value, ...patch } : value)));

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        A named value pulled from a data source - use it as <code>{'{{$id}}'}</code> in the header title/subtitle, any
        page&apos;s title panel or page heading, or a text/cards panel template (where plain{' '}
        <code>{'{{Field}}'}</code> still means that panel&apos;s own row). Wrap text in{' '}
        <code>{'{{#$id}}...{{/$id}}'}</code> to hide it while the value is empty.
      </Typography>
      {values.map((value, index) => {
        const aggregation = value.aggregation ?? 'first';
        return (
          <Box key={index} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                <TextField
                  label="Id"
                  size="small"
                  value={value.id}
                  helperText={`Use as {{$${value.id}}}`}
                  error={!/^[A-Za-z0-9_-]+$/.test(value.id) || values.some((other, i) => i !== index && other.id === value.id)}
                  onChange={(e) => update(index, { id: e.target.value })}
                  sx={{ flex: 1 }}
                />
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Data source</InputLabel>
                  <Select label="Data source" value={value.dataSource} onChange={(e) => update(index, { dataSource: e.target.value })}>
                    {dataSources.map((source) => (
                      <MenuItem key={source.id} value={source.id}>
                        {source.id}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  size="small"
                  aria-label="Remove value"
                  onClick={() => setTemplateValues(values.filter((_, i) => i !== index))}
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Stack>
              <Stack direction="row" spacing={1}>
                <FormControl size="small" sx={{ flex: 1 }}>
                  <InputLabel>Value</InputLabel>
                  <Select
                    label="Value"
                    value={aggregation}
                    onChange={(e) =>
                      update(index, { aggregation: e.target.value === 'first' ? undefined : (e.target.value as TemplateValueConfig['aggregation']) })
                    }
                  >
                    {Object.entries(AGGREGATION_LABELS).map(([key, label]) => (
                      <MenuItem key={key} value={key}>
                        {label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Field"
                  size="small"
                  value={value.field ?? ''}
                  disabled={aggregation === 'count'}
                  error={aggregation !== 'count' && !value.field}
                  onChange={(e) => update(index, { field: e.target.value || undefined })}
                  sx={{ flex: 1 }}
                />
                <TextField
                  label="Decimals"
                  type="number"
                  size="small"
                  placeholder="as-is"
                  value={value.decimals ?? ''}
                  slotProps={{ htmlInput: { min: 0, max: 20 } }}
                  onChange={(e) =>
                    update(index, {
                      decimals: e.target.value === '' ? undefined : Math.min(20, Math.max(0, Math.round(Number(e.target.value)))),
                    })
                  }
                  sx={{ width: 100 }}
                />
              </Stack>
              <FormControl size="small" fullWidth disabled={channels.length === 0}>
                <InputLabel>Listens to</InputLabel>
                <Select
                  multiple
                  label="Listens to"
                  value={value.listensTo ?? []}
                  renderValue={(selected) => (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {(selected as string[]).map((v) => (
                        <Chip key={v} label={v} size="small" />
                      ))}
                    </Box>
                  )}
                  onChange={(e) => {
                    const next = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                    update(index, { listensTo: next.length > 0 ? next : undefined });
                  }}
                >
                  {channels.map((c) => (
                    <MenuItem key={c.id} value={c.id} title={c.description || c.id}>
                      {c.id}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>
          </Box>
        );
      })}
      <Box>
        <Button
          size="small"
          variant="outlined"
          disabled={dataSources.length === 0}
          onClick={() =>
            setTemplateValues([...values, { id: generateId('value').replace(/-/g, '_'), dataSource: dataSources[0]?.id ?? '' }])
          }
        >
          Add value
        </Button>
        {dataSources.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            Add a data source first.
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
