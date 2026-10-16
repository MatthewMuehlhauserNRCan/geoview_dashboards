import { Alert, Stack, TextField } from '@mui/material';
import type { DashboardThemeConfig } from '../config/types';

interface ThemeFormProps {
  value: DashboardThemeConfig | undefined;
  onChange: (next: DashboardThemeConfig | undefined) => void;
}

// Colors only for v1 - any field left blank falls back to MUI's own default palette.
export function ThemeForm({ value, onChange }: ThemeFormProps) {
  const update = (fields: Partial<DashboardThemeConfig>) => {
    const next = { ...value, ...fields };
    // Drop the whole object once every field is empty, so an untouched theme stays `undefined`
    // (and the dashboard keeps using MUI's defaults) rather than an object of empty strings.
    const isEmpty = Object.values(next).every((v) => !v);
    onChange(isEmpty ? undefined : next);
  };

  return (
    <Stack spacing={2}>
      <Alert severity="info">Leave a field blank to use MUI's default color for it.</Alert>
      <TextField
        label="Primary color"
        value={value?.primaryColor ?? ''}
        size="small"
        fullWidth
        placeholder="e.g. #1976d2"
        helperText="Header/title panel background, buttons, links"
        onChange={(e) => update({ primaryColor: e.target.value || undefined })}
      />
      <TextField
        label="Secondary color"
        value={value?.secondaryColor ?? ''}
        size="small"
        fullWidth
        placeholder="e.g. #9c27b0"
        helperText="Accents"
        onChange={(e) => update({ secondaryColor: e.target.value || undefined })}
      />
      <TextField
        label="Page background"
        value={value?.backgroundColor ?? ''}
        size="small"
        fullWidth
        placeholder="e.g. #f5f5f5"
        helperText="Backdrop behind the grid"
        onChange={(e) => update({ backgroundColor: e.target.value || undefined })}
      />
      <TextField
        label="Panel background"
        value={value?.paperColor ?? ''}
        size="small"
        fullWidth
        placeholder="e.g. #ffffff"
        helperText="Card/panel surfaces"
        onChange={(e) => update({ paperColor: e.target.value || undefined })}
      />
      <TextField
        label="Text color"
        value={value?.textColor ?? ''}
        size="small"
        fullWidth
        placeholder="e.g. #000000"
        helperText={
          value?.backgroundColor || value?.paperColor
            ? "Leave blank to auto-pick a readable black/white for the panel background above"
            : 'Main text color'
        }
        onChange={(e) => update({ textColor: e.target.value || undefined })}
      />
    </Stack>
  );
}
