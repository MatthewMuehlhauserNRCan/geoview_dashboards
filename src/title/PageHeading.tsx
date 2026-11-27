import { Typography } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import type { PageHeadingConfig } from '../config/types';
import { useFillTemplateValues } from '../templateValues/context';
import { contrastTextFor } from '../common/a11y';
import { headingTag } from '../common/headingLevel';

interface PageHeadingProps {
  config: PageHeadingConfig;
  level: number;
}

// `size` only picks the visual variant - the element itself is always a real heading at `level`.
const SIZE_VARIANTS = { small: 'subtitle1', medium: 'h6', large: 'h5' } as const;

// A plain, non-resizable single-line heading below TitlePanel - unlike TitlePanel's 3-column
// left/image/right layout, this is just one line of text naming the current page/section.
export function PageHeading({ config, level }: PageHeadingProps) {
  const fill = useFillTemplateValues();
  const theme = useTheme();
  // An author-set background with no explicit text color gets a readable black/white automatically.
  const color = config.textColor ?? contrastTextFor(theme, config.backgroundColor, theme.palette.text.primary);
  return (
    <Typography
      component={headingTag(level)}
      variant={SIZE_VARIANTS[config.size ?? 'medium']}
      sx={{
        flex: '0 0 auto',
        width: '100%',
        px: 2,
        py: 1,
        textAlign: config.align ?? 'center',
        fontWeight: 'bold',
        bgcolor: config.backgroundColor ?? 'background.paper',
        color,
      }}
    >
      {fill(config.text)}
    </Typography>
  );
}
