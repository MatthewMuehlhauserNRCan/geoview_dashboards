import { Checkbox, FormControl, FormControlLabel, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import type { PageHeadingConfig } from '../config/types';

interface PageHeadingFormProps {
  value: PageHeadingConfig | undefined;
  onChange: (next: PageHeadingConfig | undefined) => void;
}

const DEFAULT_PAGE_HEADING: PageHeadingConfig = { text: '' };

// A plain single-line heading, simpler than TitlePanelForm's left/image/right layout - for
// content that genuinely changes per page (e.g. naming the current page/section).
export function PageHeadingForm({ value, onChange }: PageHeadingFormProps) {
  const enabled = value !== undefined;
  const config = value ?? DEFAULT_PAGE_HEADING;

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={
          <Checkbox checked={enabled} onChange={(e) => onChange(e.target.checked ? DEFAULT_PAGE_HEADING : undefined)} />
        }
        label="Show a page heading on this page"
      />
      {enabled && (
        <Stack spacing={2}>
          <TextField
            label="Text"
            helperText="Can include {{$valueId}} placeholders (see Values in the toolbar)."
            value={config.text}
            size="small"
            fullWidth
            onChange={(e) => onChange({ ...config, text: e.target.value })}
          />
          <FormControl size="small" fullWidth>
            <InputLabel>Alignment</InputLabel>
            <Select
              label="Alignment"
              value={config.align ?? 'center'}
              onChange={(e) => onChange({ ...config, align: e.target.value as PageHeadingConfig['align'] })}
            >
              <MenuItem value="left">Left</MenuItem>
              <MenuItem value="center">Center</MenuItem>
              <MenuItem value="right">Right</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" fullWidth>
            <InputLabel>Text size</InputLabel>
            <Select
              label="Text size"
              value={config.size ?? 'medium'}
              onChange={(e) => onChange({ ...config, size: e.target.value as PageHeadingConfig['size'] })}
            >
              <MenuItem value="small">Small</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="large">Large</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Text color"
            value={config.textColor ?? ''}
            size="small"
            fullWidth
            placeholder="e.g. #c62828"
            onChange={(e) => onChange({ ...config, textColor: e.target.value || undefined })}
          />
          <TextField
            label="Background color"
            value={config.backgroundColor ?? ''}
            size="small"
            fullWidth
            placeholder="e.g. #ffffff"
            onChange={(e) => onChange({ ...config, backgroundColor: e.target.value || undefined })}
          />
        </Stack>
      )}
    </Stack>
  );
}
