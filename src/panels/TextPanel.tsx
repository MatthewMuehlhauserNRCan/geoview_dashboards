import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { DataSourceConfig, TextPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { useDataSource } from '../dataSources/useDataSource';
import { fillTextTemplate } from './textTemplate';

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

  // Only fetches when `template` is actually set - `panel.dataSource` is expected to already be
  // filtered down to one feature server-side (e.g. a `where=` clause baked into its own URL), so
  // only the first returned row is used.
  const { data: templateRows, isLoading: templateLoading } = useDataSource(
    panel.template ? panel.dataSource : undefined,
    dataSources,
  );

  if (panel.template) {
    if (templateLoading) {
      return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
    }
    return (
      <PanelContainer title={panel.title}>
        <div className="markdown-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{fillTextTemplate(panel.template, templateRows?.[0])}</ReactMarkdown>
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
