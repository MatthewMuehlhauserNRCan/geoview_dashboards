import { useState } from 'react';
import { Box, IconButton } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { CardsPanelConfig, DataSourceConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import type { DataSourceRecord } from '../dataSources/types';
import { fillTextTemplate, isEmptyValue } from './textTemplate';

interface CardsPanelProps {
  panel: CardsPanelConfig;
  dataSources: DataSourceConfig[];
}

// One card's fully-resolved content, regardless of whether it came from a manual `cards` entry
// or a `dataSource` row - lets `CardItem` stay agnostic of which mode produced it.
interface ResolvedCard {
  key: string;
  title: string;
  summary?: string;
  detail?: string;
  icon?: string;
  color?: string;
}

function resolveManualCard(panel: CardsPanelConfig, index: number): ResolvedCard {
  const entry = panel.cards![index];
  return {
    key: `${entry.title}-${index}`,
    title: entry.title,
    summary: entry.summary,
    detail: entry.detail,
    icon: entry.icon ?? panel.defaultIcon,
    color: entry.color ?? panel.defaultColor,
  };
}

function resolveRowCard(panel: CardsPanelConfig, row: DataSourceRecord, index: number): ResolvedCard {
  const title = String(row[panel.titleField!] ?? '');
  const style = panel.cardStyles?.[title];
  return {
    key: `${title}-${index}`,
    title,
    summary: panel.summaryTemplate ? fillTextTemplate(panel.summaryTemplate, row) : undefined,
    detail: panel.detailTemplate ? fillTextTemplate(panel.detailTemplate, row) : undefined,
    icon: (panel.iconField ? (row[panel.iconField] as string | undefined) : undefined) ?? style?.icon ?? panel.defaultIcon,
    color: (panel.colorField ? (row[panel.colorField] as string | undefined) : undefined) ?? style?.color ?? panel.defaultColor,
  };
}

// Whether a `dataSource` row should become a card at all - checked BEFORE `resolveRowCard`, so an
// excluded row never even reaches templating. `requireFields` drops a row missing any of the
// listed fields (e.g. a mostly-null placeholder row); `excludeValues` drops a row whose field
// exactly matches one of a known list of values to hide outright.
function rowIsIncluded(panel: CardsPanelConfig, row: DataSourceRecord): boolean {
  if (panel.requireFields?.some((field) => isEmptyValue(row[field]))) return false;
  if (panel.excludeValues) {
    for (const [field, values] of Object.entries(panel.excludeValues)) {
      if (values.some((value) => String(value) === String(row[field]))) return false;
    }
  }
  return true;
}

export function CardsPanel({ panel, dataSources }: CardsPanelProps) {
  // A non-empty `cards` list takes priority - no point fetching a data source that'd just be
  // discarded (same "manual wins" precedent as TextPanel's template-vs-contentUrl).
  const isManual = Boolean(panel.cards?.length);
  const { data, isLoading } = useDataSource(isManual ? undefined : panel.dataSource, dataSources);

  if (!isManual && isLoading) {
    return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
  }

  const cards = isManual
    ? panel.cards!.map((_, index) => resolveManualCard(panel, index))
    : (data ?? []).filter((row) => rowIsIncluded(panel, row)).map((row, index) => resolveRowCard(panel, row, index));

  if (cards.length === 0 && panel.emptyText) {
    return <PanelContainer title={panel.title}>{panel.emptyText}</PanelContainer>;
  }

  return (
    <PanelContainer title={panel.title} disablePadding>
      <Box sx={{ display: 'grid', gridTemplateColumns: gridTemplateColumns(panel.columns), gap: 2, p: 2, alignContent: 'start' }}>
        {cards.map((card) => (
          <CardItem key={card.key} card={card} />
        ))}
      </Box>
    </PanelContainer>
  );
}

// Grid gap below is `gap: 2` (MUI spacing(2)), i.e. 16px with this app's default (unmodified)
// theme spacing unit.
const GRID_GAP_PX = 16;

function gridTemplateColumns(columns: number | undefined): string {
  if (!columns || columns < 1) return 'repeat(auto-fill, minmax(220px, 1fr))';
  // There's no native CSS way to say "auto-fit, but cap at N columns" - this computes what N
  // equal columns would be (accounting for the row's own gaps) and uses THAT as the auto-fill
  // breakpoint, so it targets exactly `columns` per row on a wide-enough container while still
  // naturally wrapping to fewer (never narrower than 200px per card) on narrower ones.
  return `repeat(auto-fill, minmax(max(200px, calc((100% - ${(columns - 1) * GRID_GAP_PX}px) / ${columns})), 1fr))`;
}

const ICON_MAX_HEIGHT = 200;
// Every card's fixed total height - content past this scrolls inside the summary area instead of
// growing the card (see CardItem).
const CARD_HEIGHT = ICON_MAX_HEIGHT * 2.5;

function CardItem({ card }: { card: ResolvedCard }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const color = card.color ?? theme.palette.primary.main;
  // Nothing to reveal (no supplied header image to swap away, no extra detail text) - just show
  // the static front, no hover/tap affordance at all.
  const canFlip = Boolean(card.icon) || Boolean(card.detail);
  // Shared by the outer card and the header band below, so the band's own top corners visibly
  // match even though it's a separate element from the card's own rounded border.
  const cardRadius = 12;

  return (
    <Box
      sx={{
        position: 'relative',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: `${cardRadius}px`,
        bgcolor: 'background.paper',
        // A single fixed height for EVERY card (not just a per-card minimum) - otherwise a CSS
        // Grid row stretches every card in it to match whichever one has the most content, so
        // different rows end up different heights depending on what happened to land in them.
        // Content past this fixed size scrolls inside the summary area below, rather than
        // growing the card.
        height: CARD_HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        // The front (below) is laid out as a flex column so the header band keeps its own
        // natural size while the summary area fills/scrolls whatever's left; the back is
        // absolutely positioned over the whole thing and never participates in that sizing -
        // `overflow: hidden` here clips its slide-in so hovering/expanding never grows this card.
        overflow: 'hidden',
        ...(canFlip && { '&:hover .card-back': { transform: 'translateY(0)' } }),
      }}
    >
      {canFlip && (
        <IconButton
          size="small"
          aria-label={expanded ? 'Show the front of this card' : 'Show more about this card'}
          aria-expanded={expanded}
          onClick={() => setExpanded((prev) => !prev)}
          sx={{
            position: 'absolute',
            top: 4,
            right: 4,
            zIndex: 2,
            bgcolor: 'background.paper',
            '&:hover': { bgcolor: 'action.hover' },
            // A real pointer device already reveals the back on hover alone - this tap target
            // only matters where hover doesn't exist (touch).
            '@media (hover: hover)': { display: 'none' },
          }}
        >
          {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
        </IconButton>
      )}

      {/* Front: a colored band (always shown, even alongside an image) - the author-supplied
          header image IS the card's title/branding, assumed to have a transparent background, so
          it sits smaller/centered within the band rather than stretched edge-to-edge (that's also
          what makes the band's own color visible well beyond the image's own narrower width). A
          card with no image shows the title as text in the band instead. */}
      <Box
        sx={{
          flex: '0 0 auto',
          p: 3,
          textAlign: 'center',
          bgcolor: color,
          color: theme.palette.getContrastText(color),
          borderTopLeftRadius: `${cardRadius}px`,
          borderTopRightRadius: `${cardRadius}px`,
          borderBottomLeftRadius: `${cardRadius}px`,
          borderBottomRightRadius: `${cardRadius}px`,
        }}
      >
        {card.icon ? (
          <Box
            component="img"
            src={card.icon}
            alt=""
            sx={{ maxWidth: '55%', maxHeight: ICON_MAX_HEIGHT, display: 'block', mx: 'auto' }}
          />
        ) : (
          <Box sx={{ fontWeight: 'bold' }}>{card.title}</Box>
        )}
      </Box>
      {card.summary && (
        // No scrollbar here - overflowing text just clips, since hovering/tapping the card to
        // read more would immediately flip to the back anyway (which shows the full summary,
        // unclipped), making a scrollbar on the front redundant.
        <Box className="markdown-content" sx={{ flex: '1 1 auto', minHeight: 0, overflow: 'hidden', p: 2.5 }}>
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{card.summary}</ReactMarkdown>
        </Box>
      )}

      {/* Back: slides up to cover the front - the title re-appears here as plain text (the image
          itself isn't shown anymore), followed by the summary again and the detail content. Its
          own `overflow-y: auto` scrolls internally, rather than growing the card, if it's taller
          than the card's own fixed `CARD_HEIGHT`. */}
      {canFlip && (
        <Box
          className="card-back"
          sx={{
            position: 'absolute',
            inset: 0,
            overflowY: 'auto',
            bgcolor: 'background.paper',
            transform: expanded ? 'translateY(0)' : 'translateY(100%)',
            transition: 'transform 0.3s ease',
          }}
        >
          {/* One shared padding block, with a small gap BETWEEN sections instead of each section
              having its own full padding (which doubled up into an overly large gap between them). */}
          <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Box sx={{ textAlign: 'center', fontWeight: 'bold' }}>{card.title}</Box>
            {card.summary && (
              <Box className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{card.summary}</ReactMarkdown>
              </Box>
            )}
            {card.detail && (
              <Box className="markdown-content">
                <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{card.detail}</ReactMarkdown>
              </Box>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
