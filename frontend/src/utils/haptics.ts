/**
 * Optional haptic feedback utility using browser Vibration API.
 * Respects user preferences and device capabilities.
 */
export const triggerHaptic = (pattern: number | number[] = 15) => {
  try {
    const isEnabled = localStorage.getItem('smart_sched_haptics') !== 'false';
    if (isEnabled && typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Graceful fallback on unsupported platforms
  }
};
