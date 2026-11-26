import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DataSourceConfig, TemplateValueConfig } from '../config/types';
import { useDataSource } from '../dataSources/useDataSource';
import { useListenChannels } from '../linking/useChannel';
import { rowMatchesFieldFilter } from '../linking/rowFilter';
import type { TemplateValues } from '../panels/textTemplate';
import { TemplateValuesContext } from './context';
import { resolveTemplateValue } from './resolveTemplateValue';

interface TemplateValuesProviderProps {
  values: TemplateValueConfig[] | undefined;
  dataSources: DataSourceConfig[];
  children: ReactNode;
}

// Resolves every named value once, dashboard-wide (so they're available on every page), and
// exposes the results via context to the title components and text/cards templates.
export function TemplateValuesProvider({ values, dataSources, children }: TemplateValuesProviderProps) {
  const [resolved, setResolved] = useState<TemplateValues>({});

  const handleResult = useCallback((id: string, value: string | undefined) => {
    setResolved((current) => (id in current && current[id] === value ? current : { ...current, [id]: value }));
  }, []);
  const handleRemove = useCallback((id: string) => {
    setResolved((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  return (
    <TemplateValuesContext.Provider value={resolved}>
      {values?.map((value, index) => (
        <TemplateValueResolver
          // keyed by position, not id, so editing an id in the editor doesn't remount/refetch
          key={index}
          config={value}
          dataSources={dataSources}
          onResult={handleResult}
          onRemove={handleRemove}
        />
      ))}
      {children}
    </TemplateValuesContext.Provider>
  );
}

interface TemplateValueResolverProps {
  config: TemplateValueConfig;
  dataSources: DataSourceConfig[];
  onResult: (id: string, value: string | undefined) => void;
  onRemove: (id: string) => void;
}

// Invisible - one instance per named value, so a variable number of values can each own their own
// data-source/channel hooks safely (same pattern as SourceRowsFetcher).
function TemplateValueResolver({ config, dataSources, onResult, onRemove }: TemplateValueResolverProps) {
  const { data } = useDataSource(config.dataSource, dataSources);
  const filterValue = useListenChannels(config.listensTo ?? []);
  const value = useMemo(
    () => (data ? resolveTemplateValue(data.filter((row) => rowMatchesFieldFilter(row, filterValue)), config) : undefined),
    [data, filterValue, config],
  );

  useEffect(() => {
    onResult(config.id, value);
  }, [config.id, value, onResult]);
  useEffect(() => () => onRemove(config.id), [config.id, onRemove]);

  return null;
}
