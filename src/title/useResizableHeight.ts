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

  return { height, containerRef, onHandlePointerDown, onHandlePointerMove, onHandlePointerUp };
}
