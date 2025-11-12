// Utility math for the picker wheel
// Returns target absolute angle delta to add from current angle to land with idx at 12 o'clock
export function indexToTargetAngle(idx: number, n: number, turns = 6, jitterDeg = 0): number {
  if (n <= 0) return 0;
  const slice = 360 / n;
  const center = idx * slice + slice / 2;
  // align center to 12 o'clock (0deg at top), add full turns, add jitter
  return 360 * turns + (360 - center) + jitterDeg;
}

// Returns random integer in [0, available-1]
export function pickRandomIndex(available: number): number {
  if (available <= 0) return 0;
  return Math.floor(Math.random() * available);
}


