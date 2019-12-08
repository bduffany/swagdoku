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

export function setEquals<T>(as: Set<T>, bs: Set<T>) {
  if (as.size !== bs.size) {
    return false;
  }
  for (var a of as) {
    if (!bs.has(a)) {
      return false;
    }
  }
  return true;
}

export function pairEquals<T, U>(a: [T, U], b: [T, U]) {
  return a[0] === b[0] && a[1] === b[1];
}

export function* allPairs<T>(array: Array<T>): Iterable<[T, T]> {
  for (const i of range(array.length)) {
    for (const j of range(i + 1, array.length)) {
      yield [array[i], array[j]];
    }
  }
}
