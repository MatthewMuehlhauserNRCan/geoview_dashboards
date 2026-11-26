import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';
import type { DataSourceConfig, TextPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { renderTextTemplate } from './textTemplate';
import { useTemplateValues } from '../templateValues/context';

interface TextPanelProps {
  panel: TextPanelConfig;
  dataSources: DataSourceConfig[];
}

export function TextPanel({ panel, dataSources }: TextPanelProps) {
  const {
    data: urlContent,
    isLoading: urlLoading,
    error: urlError,
  } = useQuery({
    queryKey: ['text-panel-content', panel.contentUrl],
    queryFn: async () => {
      const response = await fetch(panel.contentUrl!);
      if (!response.ok) {
        throw new Error(`Failed to fetch "${panel.contentUrl}": ${response.status} ${response.statusText}`);
      }
      return response.text();
    },
    // `template` takes priority over `contentUrl` - no point fetching a whole document that
    // would just be discarded.
    enabled: Boolean(panel.contentUrl) && !panel.template,
  });

  // Only fetches when `template` is actually set - `panel.dataSource` is expected to be filtered
  // down to the feature(s) this panel cares about server-side (e.g. a `where=` clause baked into
  // its own URL).
  const { data: templateRows, isLoading: templateLoading } = useDataSource(
    panel.template ? panel.dataSource : undefined,
    dataSources,
  );
  const templateValues = useTemplateValues();

  if (panel.template) {
    if (templateLoading) {
      return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
    }
    // A template with no `dataSource` at all (only `{{$name}}` dashboard values) has no rows to be
    // "empty" of - render it as-is rather than falling back to `emptyContent`.
    const text =
      panel.dataSource && (templateRows?.length ?? 0) === 0 && panel.emptyContent !== undefined
        ? panel.emptyContent
        : renderTextTemplate(panel.template, templateRows, panel.repeatTemplate ?? true, templateValues);
    return (
      <PanelContainer title={panel.title}>
        <div className="markdown-content">
          {/* `remarkBreaks` so a single `\n` in an author-written template renders as a real line
              break (standard markdown otherwise collapses it into a mere space - easy to trip over
              when a template's own header/value lines use just one newline between them). Only
              applied here, not to a `contentUrl`/`content` document, which is more likely genuine
              multi-paragraph prose relying on normal markdown line-wrapping. */}
          <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{text}</ReactMarkdown>
        </div>
      </PanelContainer>
    );
  }

  if (panel.contentUrl) {
    if (urlLoading) {
      return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
    }
    if (urlError) {
      return (
        <PanelContainer title={panel.title}>
          <div>{(urlError as Error).message}</div>
        </PanelContainer>
      );
    }
  }

  // `contentUrl` is always treated as markdown (that's the point of linking to a document);
  // inline `content` follows `format`, defaulting to plain text for backward compatibility.
  const renderMarkdown = Boolean(panel.contentUrl) || panel.format === 'markdown';
  const text = (panel.contentUrl ? urlContent : panel.content) ?? '';

  return (
    <PanelContainer title={panel.title}>
      {renderMarkdown ? (
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{text}</ReactMarkdown>
        </div>
      ) : (
        <div>{text}</div>
      )}
    </PanelContainer>
  );
}
