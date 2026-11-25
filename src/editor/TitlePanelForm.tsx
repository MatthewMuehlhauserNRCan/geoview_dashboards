import { Button, Checkbox, FormControlLabel, Stack, TextField } from '@mui/material';
import type { TitlePanelConfig } from '../config/types';

interface TitlePanelFormProps {
  value: TitlePanelConfig | undefined;
  onChange: (next: TitlePanelConfig | undefined) => void;
  // Omitted when there's only one page (nothing else to copy to).
  onApplyToAllPages?: () => void;
}

const DEFAULT_TITLE_PANEL: TitlePanelConfig = {};

// A thin, resizable strip below the title element - unlike `titleElement`, this is authored
// per-page (see TitleElementForm for the dashboard-wide header).
export function TitlePanelForm({ value, onChange, onApplyToAllPages }: TitlePanelFormProps) {
  const enabled = value !== undefined;
  const config = value ?? DEFAULT_TITLE_PANEL;

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={<Checkbox checked={enabled} onChange={(e) => onChange(e.target.checked ? DEFAULT_TITLE_PANEL : undefined)} />}
        label="Show a title panel on this page"
      />
      {enabled && (
        <Stack spacing={2}>
          <TextField
            label="Left text"
            value={config.left ?? ''}
            size="small"
            fullWidth
            onChange={(e) => onChange({ ...config, left: e.target.value || undefined })}
          />
          <TextField
            label="Right text"
            value={config.right ?? ''}
            size="small"
            fullWidth
            onChange={(e) => onChange({ ...config, right: e.target.value || undefined })}
          />
          <TextField
            label="Image URL"
            value={config.image?.src ?? ''}
            size="small"
            fullWidth
            onChange={(e) => onChange({ ...config, image: e.target.value ? { ...config.image, src: e.target.value } : undefined })}
          />
          <TextField
            label="Background color"
            value={config.backgroundColor ?? ''}
            size="small"
            fullWidth
            placeholder="e.g. #1976d2"
            onChange={(e) => onChange({ ...config, backgroundColor: e.target.value || undefined })}
          />
          {onApplyToAllPages && (
            <Button size="small" onClick={onApplyToAllPages}>
              Apply to all pages
            </Button>
          )}
        </Stack>
      )}
    </Stack>
  );
}
