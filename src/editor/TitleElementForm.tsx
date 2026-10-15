import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import type { TitleElementConfig, TitleHamburgerLinkConfig, TitleMenuOption } from '../config/types';
import { generateId } from './idUtils';

interface TitleElementFormProps {
  value: TitleElementConfig | undefined;
  onChange: (next: TitleElementConfig | undefined) => void;
}

const DEFAULT_TITLE_ELEMENT: TitleElementConfig = { title: 'Dashboard' };

// Dashboard-wide header settings - authored once, separate from any single page (unlike
// `titlePanel`, which is per-page - see TitlePanelForm).
export function TitleElementForm({ value, onChange }: TitleElementFormProps) {
  const enabled = value !== undefined;
  const config = value ?? DEFAULT_TITLE_ELEMENT;

  return (
    <Stack spacing={2}>
      <FormControlLabel
        control={<Checkbox checked={enabled} onChange={(e) => onChange(e.target.checked ? DEFAULT_TITLE_ELEMENT : undefined)} />}
        label="Show a title element (fixed header) above the dashboard"
      />
      {enabled && (
        <Stack spacing={2}>
          <TextField label="Title" value={config.title} size="small" fullWidth onChange={(e) => onChange({ ...config, title: e.target.value })} />
          <TextField
            label="Subtitle"
            value={config.subtitle ?? ''}
            size="small"
            fullWidth
            onChange={(e) => onChange({ ...config, subtitle: e.target.value || undefined })}
          />
          <TextField
            label="Background color"
            value={config.backgroundColor ?? ''}
            size="small"
            fullWidth
            placeholder="e.g. #1976d2"
            onChange={(e) => onChange({ ...config, backgroundColor: e.target.value || undefined })}
          />

          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Logo image</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!config.image}
                    onChange={(e) => onChange({ ...config, image: e.target.checked ? { src: '' } : undefined })}
                  />
                }
                label="Show a logo"
              />
              {config.image && (
                <Stack spacing={2} sx={{ mt: 1 }}>
                  <TextField
                    label="Image URL"
                    value={config.image.src}
                    size="small"
                    fullWidth
                    onChange={(e) => onChange({ ...config, image: { ...config.image!, src: e.target.value } })}
                  />
                  <TextField
                    label="Alt text"
                    value={config.image.alt ?? ''}
                    size="small"
                    fullWidth
                    onChange={(e) => onChange({ ...config, image: { ...config.image!, alt: e.target.value || undefined } })}
                  />
                  <TextField
                    label="Link (optional)"
                    value={config.image.href ?? ''}
                    size="small"
                    fullWidth
                    onChange={(e) => onChange({ ...config, image: { ...config.image!, href: e.target.value || undefined } })}
                  />
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Options menu</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!config.optionsMenu}
                    onChange={(e) => onChange({ ...config, optionsMenu: e.target.checked ? { options: [] } : undefined })}
                  />
                }
                label="Show an options menu"
              />
              {config.optionsMenu && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <TextField
                    label="Menu label"
                    value={config.optionsMenu.label ?? ''}
                    size="small"
                    fullWidth
                    onChange={(e) => onChange({ ...config, optionsMenu: { ...config.optionsMenu!, label: e.target.value || undefined } })}
                  />
                  {config.optionsMenu.options.map((option, index) => (
                    <OptionRow
                      key={option.id}
                      option={option}
                      onChange={(next) =>
                        onChange({
                          ...config,
                          optionsMenu: {
                            ...config.optionsMenu!,
                            options: config.optionsMenu!.options.map((o, i) => (i === index ? next : o)),
                          },
                        })
                      }
                      onRemove={() =>
                        onChange({ ...config, optionsMenu: { ...config.optionsMenu!, options: config.optionsMenu!.options.filter((_, i) => i !== index) } })
                      }
                    />
                  ))}
                  <Button
                    size="small"
                    onClick={() =>
                      onChange({
                        ...config,
                        optionsMenu: { ...config.optionsMenu!, options: [...config.optionsMenu!.options, { id: generateId('option'), label: 'Option' }] },
                      })
                    }
                  >
                    Add option
                  </Button>
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>

          <Accordion disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="body2">Hamburger menu</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={!!config.hamburgerMenu}
                    onChange={(e) => onChange({ ...config, hamburgerMenu: e.target.checked ? {} : undefined })}
                  />
                }
                label="Show a hamburger menu"
              />
              {config.hamburgerMenu && (
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    Links
                  </Typography>
                  {(config.hamburgerMenu.links ?? []).map((link, index) => (
                    <LinkRow
                      key={link.id}
                      link={link}
                      onChange={(next) =>
                        onChange({
                          ...config,
                          hamburgerMenu: {
                            ...config.hamburgerMenu!,
                            links: (config.hamburgerMenu!.links ?? []).map((l, i) => (i === index ? next : l)),
                          },
                        })
                      }
                      onRemove={() =>
                        onChange({
                          ...config,
                          hamburgerMenu: { ...config.hamburgerMenu!, links: (config.hamburgerMenu!.links ?? []).filter((_, i) => i !== index) },
                        })
                      }
                    />
                  ))}
                  <Button
                    size="small"
                    onClick={() =>
                      onChange({
                        ...config,
                        hamburgerMenu: {
                          ...config.hamburgerMenu!,
                          links: [...(config.hamburgerMenu!.links ?? []), { id: generateId('link'), label: 'Link', href: '' }],
                        },
                      })
                    }
                  >
                    Add link
                  </Button>

                  <FormControlLabel
                    sx={{ mt: 1 }}
                    control={
                      <Checkbox
                        checked={!!config.hamburgerMenu.notice}
                        onChange={(e) =>
                          onChange({
                            ...config,
                            hamburgerMenu: {
                              ...config.hamburgerMenu!,
                              notice: e.target.checked ? { label: 'Notice', title: 'Notice', content: '' } : undefined,
                            },
                          })
                        }
                      />
                    }
                    label="Include a notice (opens a modal)"
                  />
                  {config.hamburgerMenu.notice && (
                    <Stack spacing={1}>
                      <TextField
                        label="Menu item label"
                        value={config.hamburgerMenu.notice.label}
                        size="small"
                        fullWidth
                        onChange={(e) =>
                          onChange({ ...config, hamburgerMenu: { ...config.hamburgerMenu!, notice: { ...config.hamburgerMenu!.notice!, label: e.target.value } } })
                        }
                      />
                      <TextField
                        label="Modal title"
                        value={config.hamburgerMenu.notice.title}
                        size="small"
                        fullWidth
                        onChange={(e) =>
                          onChange({ ...config, hamburgerMenu: { ...config.hamburgerMenu!, notice: { ...config.hamburgerMenu!.notice!, title: e.target.value } } })
                        }
                      />
                      <TextField
                        label="Modal content"
                        value={config.hamburgerMenu.notice.content}
                        multiline
                        minRows={3}
                        size="small"
                        fullWidth
                        onChange={(e) =>
                          onChange({ ...config, hamburgerMenu: { ...config.hamburgerMenu!, notice: { ...config.hamburgerMenu!.notice!, content: e.target.value } } })
                        }
                      />
                    </Stack>
                  )}
                </Stack>
              )}
            </AccordionDetails>
          </Accordion>
        </Stack>
      )}
    </Stack>
  );
}

function OptionRow({ option, onChange, onRemove }: { option: TitleMenuOption; onChange: (next: TitleMenuOption) => void; onRemove: () => void }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <TextField label="Label" value={option.label} size="small" onChange={(e) => onChange({ ...option, label: e.target.value })} />
      <IconButton size="small" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

function LinkRow({
  link,
  onChange,
  onRemove,
}: {
  link: TitleHamburgerLinkConfig;
  onChange: (next: TitleHamburgerLinkConfig) => void;
  onRemove: () => void;
}) {
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField label="Label" value={link.label} size="small" onChange={(e) => onChange({ ...link, label: e.target.value })} />
      <TextField label="URL" value={link.href} size="small" fullWidth onChange={(e) => onChange({ ...link, href: e.target.value })} />
      <IconButton size="small" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}
