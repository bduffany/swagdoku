export function* range(
  lowerOrUpper: number = 0,
  upper: number | undefined = undefined
): Iterable<number> {
  let lower: number;
  if (upper === undefined) {
    upper = lowerOrUpper;
    lower = 0;
  } else {
    lower = lowerOrUpper;
  }
  for (let i = lower; i < upper; i++) {
    yield i;
  }
}

export function relativeRange(lower: number, offset: number) {
  return range(lower, lower + offset);
}

export function simpleEnumValues(enumClass) {
  return range(Object.keys(enumClass).length);
}

export function delay(timeMs: number): Promise<void> {
  return new Promise(accept => setTimeout(accept, timeMs));
}
