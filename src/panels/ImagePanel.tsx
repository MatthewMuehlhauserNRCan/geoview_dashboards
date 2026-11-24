import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FocusEvent, KeyboardEvent } from 'react';
import { Box, Dialog, IconButton, Typography } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import type { ImagePanelConfig } from '../config/types';
import { PanelContainer } from './PanelContainer';
import { toImageItems } from './imageItems';

interface ImagePanelProps {
  panel: ImagePanelConfig;
}

// Controls sit on top of arbitrary image content, so they use a fixed translucent-dark style
// (like most lightboxes/carousels) rather than the dashboard theme, to stay legible on any image.
const overlayButtonSx = {
  color: '#fff',
  bgcolor: 'rgba(0, 0, 0, 0.45)',
  '&:hover': { bgcolor: 'rgba(0, 0, 0, 0.65)' },
} as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

export function ImagePanel({ panel }: ImagePanelProps) {
  const images = useMemo(() => toImageItems(panel).filter((item) => item.src), [panel]);
  const count = images.length;
  const isCarousel = count > 1;
  const lightboxEnabled = panel.lightbox ?? true;
  const autoplay = isCarousel && (panel.autoplay ?? false);
  const intervalMs = (panel.autoplaySeconds ?? 5) * 1000;
  const fit = panel.fit ?? 'contain';

  const [rawIndex, setIndex] = useState(0);
  // modulo keeps the index valid if the image list shrinks (e.g. while editing)
  const index = count ? rawIndex % count : 0;
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  // temporarily paused while the pointer is over the carousel / keyboard focus is inside it
  const [hovered, setHovered] = useState(false);
  const [keyboardFocused, setKeyboardFocused] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const go = useCallback((delta: number) => setIndex((i) => (((i % count) + delta) % count + count) % count), [count]);

  useEffect(() => {
    if (!autoplay || !playing || hovered || keyboardFocused || lightboxOpen) return;
    const timer = window.setTimeout(() => go(1), intervalMs);
    return () => window.clearTimeout(timer);
  }, [autoplay, playing, hovered, keyboardFocused, lightboxOpen, index, intervalMs, go]);

  const handleArrowKeys = (e: KeyboardEvent) => {
    if (!isCarousel) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      go(-1);
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      go(1);
    }
  };

  // Only keyboard focus (not the focus a mouse click leaves on e.g. the play button) suspends
  // autoplay - otherwise clicking "play" would keep it paused until the button lost focus.
  const handleFocus = (e: FocusEvent) => {
    if ((e.target as HTMLElement).matches?.(':focus-visible')) setKeyboardFocused(true);
  };
  const handleBlur = (e: FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setKeyboardFocused(false);
  };

  if (count === 0) {
    return (
      <PanelContainer title={panel.title} expandable={false} centerContent>
        <Typography variant="body2" color="text.secondary">
          No image
        </Typography>
      </PanelContainer>
    );
  }

  const current = images[index];

  return (
    <PanelContainer title={panel.title} disablePadding expandable={false}>
      <Box
        role={isCarousel ? 'region' : undefined}
        aria-roledescription={isCarousel ? 'carousel' : undefined}
        aria-label={isCarousel ? (panel.title ?? 'Image carousel') : undefined}
        onKeyDown={handleArrowKeys}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={handleFocus}
        onBlur={handleBlur}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
          '&:hover .image-expand-button': { opacity: 1 },
          '@media (hover: none)': { '& .image-expand-button': { opacity: 1 } },
        }}
      >
        <Box aria-live={autoplay && playing ? 'off' : 'polite'} sx={{ position: 'absolute', inset: 0 }}>
          {images.map((item, i) => {
            const active = i === index;
            const img = (
              <Box
                component="img"
                src={item.src}
                alt={item.alt ?? ''}
                sx={{ display: 'block', width: '100%', height: '100%', objectFit: fit }}
              />
            );
            let content = img;
            if (item.link) {
              content = (
                <a href={item.link} target="_blank" rel="noopener noreferrer" style={{ display: 'block', width: '100%', height: '100%' }}>
                  {img}
                </a>
              );
            } else if (lightboxEnabled) {
              content = (
                <Box
                  component="button"
                  type="button"
                  aria-label={`View ${item.alt || 'image'} full screen`}
                  onClick={() => setLightboxOpen(true)}
                  sx={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    p: 0,
                    m: 0,
                    border: 0,
                    background: 'none',
                    cursor: 'zoom-in',
                    '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -2 },
                  }}
                >
                  {img}
                </Box>
              );
            }
            return (
              <Box
                key={i}
                role={isCarousel ? 'group' : undefined}
                aria-roledescription={isCarousel ? 'slide' : undefined}
                aria-label={isCarousel ? `${i + 1} of ${count}` : undefined}
                aria-hidden={!active}
                sx={{
                  position: 'absolute',
                  inset: 0,
                  opacity: active ? 1 : 0,
                  // visibility (not just opacity) keeps hidden slides out of the tab order
                  visibility: active ? 'visible' : 'hidden',
                  transition: 'opacity 0.4s ease, visibility 0.4s',
                  '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
                }}
              >
                {content}
              </Box>
            );
          })}
        </Box>

        {lightboxEnabled && (
          <IconButton
            className="image-expand-button"
            size="small"
            aria-label="View full screen"
            onClick={() => setLightboxOpen(true)}
            sx={{
              ...overlayButtonSx,
              position: 'absolute',
              top: 4,
              right: 4,
              opacity: 0,
              transition: 'opacity 0.15s ease',
              '&:focus-visible': { opacity: 1 },
            }}
          >
            <FullscreenIcon fontSize="small" />
          </IconButton>
        )}

        {isCarousel && (
          <>
            <IconButton
              size="small"
              aria-label="Previous image"
              onClick={() => go(-1)}
              sx={{ ...overlayButtonSx, position: 'absolute', left: 4, top: '50%', transform: 'translateY(-50%)' }}
            >
              <ChevronLeftIcon />
            </IconButton>
            <IconButton
              size="small"
              aria-label="Next image"
              onClick={() => go(1)}
              sx={{ ...overlayButtonSx, position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
            >
              <ChevronRightIcon />
            </IconButton>
          </>
        )}

        {(isCarousel || current.caption) && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              px: 1,
              pt: 3,
              pb: 0.5,
              color: '#fff',
              background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.6))',
              // lets clicks on the gradient fall through to the image; buttons re-enable it
              pointerEvents: 'none',
            }}
          >
            {current.caption && (
              <Typography variant="body2" sx={{ textAlign: 'center', textShadow: '0 1px 2px rgba(0,0,0,0.8)', mb: isCarousel ? 0.25 : 0.5 }}>
                {current.caption}
              </Typography>
            )}
            {isCarousel && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5, minHeight: 28 }}>
                {autoplay && (
                  <IconButton
                    size="small"
                    aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
                    onClick={() => setPlaying((p) => !p)}
                    sx={{ color: '#fff', pointerEvents: 'auto', p: 0.25, mr: 0.5 }}
                  >
                    {playing ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
                  </IconButton>
                )}
                {images.map((_, i) => (
                  <Box
                    key={i}
                    component="button"
                    type="button"
                    aria-label={`Go to image ${i + 1}`}
                    aria-current={i === index ? 'true' : undefined}
                    onClick={() => setIndex(i)}
                    sx={{
                      pointerEvents: 'auto',
                      width: 8,
                      height: 8,
                      p: 0,
                      border: '1px solid rgba(255, 255, 255, 0.9)',
                      borderRadius: '50%',
                      cursor: 'pointer',
                      bgcolor: i === index ? '#fff' : 'transparent',
                      '&:focus-visible': { outline: '2px solid #fff', outlineOffset: 2 },
                    }}
                  />
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>

      {lightboxEnabled && (
        <Dialog
          open={lightboxOpen}
          onClose={() => setLightboxOpen(false)}
          fullScreen
          aria-label={current.alt || panel.title || 'Image'}
          onKeyDown={handleArrowKeys}
          slotProps={{ paper: { sx: { bgcolor: 'rgba(0, 0, 0, 0.92)', color: '#fff', backgroundImage: 'none' } } }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              p: { xs: '56px 8px', sm: '56px 72px' },
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Box
              component="img"
              src={current.src}
              alt={current.alt ?? ''}
              sx={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />
          </Box>

          <Box sx={{ position: 'absolute', top: 8, left: 12, right: 8, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ flex: 1 }}>
              {isCarousel ? `${index + 1} / ${count}` : ''}
            </Typography>
            {current.link && (
              <IconButton
                component="a"
                href={current.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open link in new tab"
                sx={overlayButtonSx}
              >
                <OpenInNewIcon />
              </IconButton>
            )}
            <IconButton aria-label="Close full screen" onClick={() => setLightboxOpen(false)} sx={overlayButtonSx}>
              <CloseIcon />
            </IconButton>
          </Box>

          {isCarousel && (
            <>
              <IconButton
                aria-label="Previous image"
                onClick={() => go(-1)}
                sx={{ ...overlayButtonSx, position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
              >
                <ChevronLeftIcon fontSize="large" />
              </IconButton>
              <IconButton
                aria-label="Next image"
                onClick={() => go(1)}
                sx={{ ...overlayButtonSx, position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}
              >
                <ChevronRightIcon fontSize="large" />
              </IconButton>
            </>
          )}

          {current.caption && (
            <Typography sx={{ position: 'absolute', left: 16, right: 16, bottom: 16, textAlign: 'center' }}>
              {current.caption}
            </Typography>
          )}
        </Dialog>
      )}
    </PanelContainer>
  );
}
