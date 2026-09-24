"use client";

import { useEffect, useRef, useState } from "react";

const NUMBER = /\d[\d,]*(?:\.\d+)?/;
const DURATION_MS = 550;

function split(text: string) {
  const match = NUMBER.exec(text);
  if (!match) return null;
  const digits = match[0];
  return {
    head: text.slice(0, match.index),
    tail: text.slice(match.index + digits.length),
    value: Number(digits.replaceAll(",", "")),
    decimals: digits.split(".")[1]?.length ?? 0,
    grouped: digits.includes(","),
  };
}

/**
 * A formatted number that eases to its new value instead of snapping. Only the
 * digits move; a change of sign, unit or wording, or reduced motion, snaps.
 */
export function Ticker({ value }: { value: string }) {
  const [shown, setShown] = useState(value);
  const displayed = useRef(value);

  useEffect(() => {
    const from = split(displayed.current);
    const to = split(value);
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!from || !to || from.head !== to.head || from.tail !== to.tail || still || from.value === to.value) {
      displayed.current = value;
      setShown(value);
      return;
    }
    const format = (n: number) =>
      to.head +
      n.toLocaleString("en-US", {
        minimumFractionDigits: to.decimals,
        maximumFractionDigits: to.decimals,
        useGrouping: to.grouped,
      }) +
      to.tail;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION_MS);
      const eased = 1 - (1 - t) ** 3;
      displayed.current = t < 1 ? format(from.value + (to.value - from.value) * eased) : value;
      setShown(displayed.current);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{shown}</>;
}
