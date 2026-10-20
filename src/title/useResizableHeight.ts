import { useCallback, useRef, useState } from 'react';

// Drives a "drag the bottom edge to resize" panel that otherwise sizes itself to its content
// (height starts as `undefined`/auto, so it only takes as much room as it needs) - unlike the
// main dashboard grid's panels, which always claim a fixed percentage share of the page.
export function useResizableHeight(minHeight = 32) {
  const [height, setHeight] = useState<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStartRef = useRef<{ pointerY: number; height: number } | null>(null);

  const onHandlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const currentHeight = containerRef.current?.getBoundingClientRect().height ?? minHeight;
      dragStartRef.current = { pointerY: event.clientY, height: currentHeight };
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [minHeight]
  );

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragStartRef.current) return;
      const delta = event.clientY - dragStartRef.current.pointerY;
      setHeight(Math.max(minHeight, dragStartRef.current.height + delta));
    },
    [minHeight]
  );

  const onHandlePointerUp = useCallback(() => {
    dragStartRef.current = null;
  }, []);

  // Keyboard equivalent of the pointer drag above (WCAG 2.1.1 - a draggable control needs a
  // non-pointer way to operate it too). Up/Left shrink, Down/Right grow, in fixed 16px steps.
  const onHandleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = 16;
      const currentHeight = height ?? containerRef.current?.getBoundingClientRect().height ?? minHeight;
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        setHeight(Math.max(minHeight, currentHeight - step));
      } else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        setHeight(currentHeight + step);
      }
    },
    [height, minHeight]
  );

  return { height, containerRef, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp, onHandleKeyDown };
}
