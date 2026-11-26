import { Box } from '@mui/material';
import type { PageHeadingConfig } from '../config/types';
import { useFillTemplateValues } from '../templateValues/context';

interface PageHeadingProps {
  config: PageHeadingConfig;
}

// A plain, non-resizable single-line heading below TitlePanel - unlike TitlePanel's 3-column
// left/image/right layout, this is just one line of text naming the current page/section.
export function PageHeading({ config }: PageHeadingProps) {
  const fill = useFillTemplateValues();
  return (
    <Box
      sx={{
        flex: '0 0 auto',
        width: '100%',
        px: 2,
        py: 1,
        textAlign: config.align ?? 'center',
        fontWeight: 'bold',
        bgcolor: config.backgroundColor ?? 'background.paper',
        color: config.textColor ?? 'text.primary',
      }}
    >
      {fill(config.text)}
    </Box>
  );
}
