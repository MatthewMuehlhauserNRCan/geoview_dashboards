import { useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import type {
  DataSourceConfig,
  LinkingChannel,
  TitleElementConfig,
  TitleHamburgerLinkConfig,
  TitleMenuFilterTarget,
  TitleMenuOption,
} from '../config/types';
import { generateId } from './idUtils';

interface TitleElementFormProps {
  value: TitleElementConfig | undefined;
  channels: LinkingChannel[];
  dataSources: DataSourceConfig[];
  onChange: (next: TitleElementConfig | undefined) => void;
}

const DEFAULT_TITLE_ELEMENT: TitleElementConfig = { title: 'Dashboard' };

// Dashboard-wide header settings - authored once, separate from any single page (unlike
// `titlePanel`, which is per-page - see TitlePanelForm).
export function TitleElementForm({ value, channels, dataSources, onChange }: TitleElementFormProps) {
  const enabled = value !== undefined;
  const config = value ?? DEFAULT_TITLE_ELEMENT;
  const [matrixDialogOpen, setMatrixDialogOpen] = useState(false);

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
                  <Button size="small" variant="outlined" onClick={() => setMatrixDialogOpen(true)} sx={{ alignSelf: 'flex-start' }}>
                    Filter targets & values {config.optionsMenu.targets?.length ? `(${config.optionsMenu.targets.length})` : ''}
                  </Button>
                  {config.optionsMenu.options.map((option, index) => (
                    <OptionRow
                      key={option.id}
                      option={option}
                      index={index}
                      total={config.optionsMenu!.options.length}
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
                      onMove={(direction) => {
                        const options = [...config.optionsMenu!.options];
                        const target = index + direction;
                        if (target < 0 || target >= options.length) return;
                        [options[index], options[target]] = [options[target], options[index]];
                        onChange({ ...config, optionsMenu: { ...config.optionsMenu!, options } });
                      }}
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

                  <FilterMatrixDialog
                    open={matrixDialogOpen}
                    onClose={() => setMatrixDialogOpen(false)}
                    channels={channels}
                    dataSources={dataSources}
                    targets={config.optionsMenu.targets ?? []}
                    options={config.optionsMenu.options}
                    onTargetsChange={(targets) => {
                      const targetIds = new Set(targets.map((t) => t.id));
                      onChange({
                        ...config,
                        optionsMenu: {
                          ...config.optionsMenu!,
                          targets: targets.length ? targets : undefined,
                          // drop values for any removed target so stale ids don't linger
                          options: config.optionsMenu!.options.map((o) => ({
                            ...o,
                            values: o.values
                              ? Object.fromEntries(Object.entries(o.values).filter(([id]) => targetIds.has(id)))
                              : o.values,
                          })),
                        },
                      });
                    }}
                    onValuesChange={(optionId, targetId, values) =>
                      onChange({
                        ...config,
                        optionsMenu: {
                          ...config.optionsMenu!,
                          options: config.optionsMenu!.options.map((o) =>
                            o.id === optionId ? { ...o, values: { ...o.values, [targetId]: values } } : o,
                          ),
                        },
                      })
                    }
                  />
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

function OptionRow({
  option,
  index,
  total,
  onChange,
  onRemove,
  onMove,
}: {
  option: TitleMenuOption;
  index: number;
  total: number;
  onChange: (next: TitleMenuOption) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <IconButton size="small" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Move up">
        <ArrowUpwardIcon fontSize="small" />
      </IconButton>
      <IconButton size="small" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Move down">
        <ArrowDownwardIcon fontSize="small" />
      </IconButton>
      <TextField label="Label" value={option.label} size="small" onChange={(e) => onChange({ ...option, label: e.target.value })} />
      <IconButton size="small" onClick={onRemove}>
        <DeleteIcon fontSize="small" />
      </IconButton>
    </Stack>
  );
}

// Lets an author define, once per menu, the channel/field "targets" every option can set a value
// for, then fill in each option's short values list per target as a matrix - instead of repeating
// channel/field/dataSources for every single option (see TitleMenuFilterTarget).
function FilterMatrixDialog({
  open,
  onClose,
  channels,
  dataSources,
  targets,
  options,
  onTargetsChange,
  onValuesChange,
}: {
  open: boolean;
  onClose: () => void;
  channels: LinkingChannel[];
  dataSources: DataSourceConfig[];
  targets: TitleMenuFilterTarget[];
  options: TitleMenuOption[];
  onTargetsChange: (next: TitleMenuFilterTarget[]) => void;
  onValuesChange: (optionId: string, targetId: string, values: string[]) => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Filter targets & values</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          A "target" is a channel/field this menu can set - defined once below and shared by every
          option, instead of repeating it per option. Group data source(s) into the same target
          only when they use the identical field name AND value representation - if a data source
          needs a different field name or value, give it its OWN target (targets can still share
          one channel). "Data source(s)" is a note to yourself shown here for convenience only -
          only channel/field are actually applied at runtime.
        </Typography>

        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          Targets
        </Typography>
        {channels.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No linking channels defined yet - add one in the Linking section first.
          </Typography>
        ) : (
          <Stack spacing={1} sx={{ mb: 2 }}>
            {targets.map((target, index) => (
              <TargetRow
                key={target.id}
                target={target}
                channels={channels}
                dataSources={dataSources}
                onChange={(next) => onTargetsChange(targets.map((t, i) => (i === index ? next : t)))}
                onRemove={() => onTargetsChange(targets.filter((_, i) => i !== index))}
              />
            ))}
            <Button
              size="small"
              onClick={() => onTargetsChange([...targets, { id: generateId('target'), channel: channels[0].id, field: '' }])}
            >
              + Add target
            </Button>
          </Stack>
        )}

        {targets.length > 0 && options.length > 0 && (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Values per option
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Target</TableCell>
                    {options.map((option) => (
                      <TableCell key={option.id}>{option.label}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {targets.map((target) => (
                    <TableRow key={target.id}>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{target.label || target.field || target.channel}</TableCell>
                      {options.map((option) => (
                        <TableCell key={option.id} sx={{ minWidth: 200 }}>
                          <Autocomplete
                            multiple
                            freeSolo
                            autoSelect
                            size="small"
                            options={[]}
                            value={option.values?.[target.id] ?? []}
                            onChange={(_event, newValue) => onValuesChange(option.id, target.id, newValue as string[])}
                            renderInput={(params) => <TextField {...params} placeholder="Add value" />}
                          />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
        {targets.length > 0 && options.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            Add at least one option below to assign values to these targets.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

function TargetRow({
  target,
  channels,
  dataSources,
  onChange,
  onRemove,
}: {
  target: TitleMenuFilterTarget;
  channels: LinkingChannel[];
  dataSources: DataSourceConfig[];
  onChange: (next: TitleMenuFilterTarget) => void;
  onRemove: () => void;
}) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      <TextField
        label="Label (optional)"
        size="small"
        sx={{ width: '20%' }}
        value={target.label ?? ''}
        onChange={(e) => onChange({ ...target, label: e.target.value || undefined })}
      />
      <FormControl size="small" sx={{ width: '18%' }}>
        <InputLabel>Channel</InputLabel>
        <Select
          label="Channel"
          value={target.channel}
          SelectDisplayProps={{ title: target.channel }}
          onChange={(e) => onChange({ ...target, channel: e.target.value })}
        >
          {channels.map((c) => (
            <MenuItem key={c.id} value={c.id} title={c.description}>
              {c.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <TextField
        label="Field"
        size="small"
        sx={{ width: '18%' }}
        value={target.field}
        onChange={(e) => onChange({ ...target, field: e.target.value })}
      />
      <FormControl size="small" sx={{ flex: 1 }}>
        <InputLabel>Data source(s)</InputLabel>
        <Select
          multiple
          label="Data source(s)"
          value={target.dataSources ?? []}
          renderValue={(selected) => (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {(selected as string[]).map((id) => (
                <Chip key={id} label={id} size="small" />
              ))}
            </Box>
          )}
          onChange={(e) => {
            const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
            onChange({ ...target, dataSources: value.length ? value : undefined });
          }}
        >
          {dataSources.map((d) => (
            <MenuItem key={d.id} value={d.id} title={d.id}>
              {d.id}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
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
