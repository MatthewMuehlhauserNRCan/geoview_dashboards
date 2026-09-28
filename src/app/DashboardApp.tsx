import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DashboardConfig } from '../config/types';
import { DashboardGrid } from '../grid/DashboardGrid';

const queryClient = new QueryClient();

interface DashboardAppProps {
  config: DashboardConfig;
}

export function DashboardApp({ config }: DashboardAppProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardGrid config={config} />
    </QueryClientProvider>
  );
}
