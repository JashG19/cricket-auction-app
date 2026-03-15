import { useState, useCallback, useRef, useEffect } from "react";

const SOUNDS = {
  sold: "/sounds/sold.wav",
  unsold: "/sounds/unsold.wav",
  bid: "/sounds/bid.wav",
  complete: "/sounds/complete.wav",
};

export const useSound = () => {
  const [isMuted, setIsMuted] = useState(() => {
    return localStorage.getItem("auction_sound_muted") === "true";
  });

  const audioRefs = useRef({});

  // Pre-load audio elements
  useEffect(() => {
    Object.entries(SOUNDS).forEach(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audioRefs.current[key] = audio;
    });
  }, []);

  const play = useCallback(
    (soundName) => {
      if (isMuted) return;
      const audio = audioRefs.current[soundName];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          // Silently ignore autoplay restrictions
        });
      }
    },
    [isMuted],
  );

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      localStorage.setItem("auction_sound_muted", String(next));
      return next;
    });
  }, []);

  return { isMuted, toggleMute, play };
};
