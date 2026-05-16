export function randomInt(min: number, max: number, step = 1): number {
  const range = Math.floor((max - min) / step);
  return min + Math.floor(Math.random() * (range + 1)) * step;
}

export function randomPrice(min: number, max: number): number {
  return randomInt(min, max, 1000);
}

export function randomDuration(min: number, max: number): number {
  return randomInt(min, max, 15);
}

export function chance(p: number): boolean {
  return Math.random() < p;
}
