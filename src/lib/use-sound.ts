"use client";

import { useCallback, useRef } from "react";

const cache = new Map<string, HTMLAudioElement>();

function getAudio(src: string): HTMLAudioElement {
  let audio = cache.get(src);
  if (!audio) {
    audio = new Audio(src);
    audio.preload = "auto";
    cache.set(src, audio);
  }
  return audio;
}

export function useSound(src: string, volume = 0.5) {
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const play = useCallback(() => {
    if (typeof window === "undefined") return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (prefersReduced) return;

    try {
      const audio = getAudio(src);
      audio.volume = volumeRef.current;
      audio.currentTime = 0;
      audio.play().catch(() => {});
    } catch {
      // Audio playback can fail silently in many contexts
    }
  }, [src]);

  return play;
}
