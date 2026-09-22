"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Element width and height, tracked. Charts need real pixels, not guesses.
 *
 * A callback ref rather than an object ref, so an element that unmounts and
 * comes back (the mosaic behind its Table toggle) is observed again instead of
 * leaving the size stuck at the zero reported when the old one detached.
 */
export function useMeasure<T extends HTMLElement>() {
  const observer = useRef<ResizeObserver | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const ref = useCallback((node: T | null) => {
    observer.current?.disconnect();
    observer.current = null;
    if (!node) return;
    observer.current = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize({ width: box.width, height: box.height });
    });
    observer.current.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });
  }, []);

  return { ref, ...size };
}
