import { useQuery } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { TextPanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';

interface TextPanelProps {
  panel: TextPanelConfig;
}

export function TextPanel({ panel }: TextPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['text-panel-content', panel.contentUrl],
    queryFn: async () => {
      const response = await fetch(panel.contentUrl!);
      if (!response.ok) {
        throw new Error(`Failed to fetch "${panel.contentUrl}": ${response.status} ${response.statusText}`);
      }
      return response.text();
    },
    enabled: Boolean(panel.contentUrl),
  });

  if (panel.contentUrl) {
    if (isLoading) {
      return <PanelContainer title={panel.title}>Loading…</PanelContainer>;
    }
    if (error) {
      return (
        <PanelContainer title={panel.title}>
          <div>{(error as Error).message}</div>
        </PanelContainer>
      );
    }
  }

  // `contentUrl` is always treated as markdown (that's the point of linking to a document);
  // inline `content` follows `format`, defaulting to plain text for backward compatibility.
  const renderMarkdown = Boolean(panel.contentUrl) || panel.format === 'markdown';
  const text = (panel.contentUrl ? data : panel.content) ?? '';

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
