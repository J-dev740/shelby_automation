import { useEffect, useRef, useCallback } from 'react';

/**
 * AudioAlert — A headless component that plays a professional notification chime
 * when a new order INSERT is detected. 
 * 
 * Browser autoplay policy: Sound will only play after the user has interacted
 * with the page at least once (click, tap, keypress).
 */

interface AudioAlertProps {
  /** Number of new orders currently in the queue */
  newOrderCount: number;
}

// A short, pleasant notification tone generated as a Web Audio oscillator
function playNotificationChime() {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    
    const playTone = (frequency: number, startTime: number, duration: number, volume: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(frequency, startTime);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(volume, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
      
      osc.start(startTime);
      osc.stop(startTime + duration);
    };

    const now = ctx.currentTime;
    // A pleasant two-tone chime (C5 → E5)
    playTone(523.25, now, 0.15, 0.3);        // C5
    playTone(659.25, now + 0.15, 0.25, 0.25); // E5

    // Close context after sounds complete
    setTimeout(() => ctx.close(), 600);
  } catch {
    // Silently fail — autoplay policy or unsupported browser
    console.warn('AudioAlert: Unable to play notification chime.');
  }
}

export function AudioAlert({ newOrderCount }: AudioAlertProps) {
  const prevCountRef = useRef(newOrderCount);
  const hasInteractedRef = useRef(false);

  // Track user interaction to satisfy autoplay policy
  const handleInteraction = useCallback(() => {
    hasInteractedRef.current = true;
  }, []);

  useEffect(() => {
    document.addEventListener('click', handleInteraction, { once: true });
    document.addEventListener('keydown', handleInteraction, { once: true });
    return () => {
      document.removeEventListener('click', handleInteraction);
      document.removeEventListener('keydown', handleInteraction);
    };
  }, [handleInteraction]);

  // Play chime when newOrderCount increases
  useEffect(() => {
    if (newOrderCount > prevCountRef.current && hasInteractedRef.current) {
      playNotificationChime();
    }
    prevCountRef.current = newOrderCount;
  }, [newOrderCount]);

  return null; // headless component
}
