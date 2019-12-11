export function filterOut<T>(value: T, array: T[]): T[] {
  return array.filter(v => v !== value);
}

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
  return range(Object.keys(enumClass).length / 2);
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

export function intersectionOf<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out: T[] = [];
  for (const value of a) {
    if (b.has(value)) {
      out.push(value);
    }
  }
  return new Set(out);
}

export function pairEquals<T, U>(a: [T, U], b: [T, U]) {
  return a[0] === b[0] && a[1] === b[1];
}

export function* allPairs<T>(array: T[]): Iterable<[T, T]> {
  for (const i of range(array.length)) {
    for (const j of range(i + 1, array.length)) {
      yield [array[i], array[j]];
    }
  }
}

export function* allCombinationsOfSize<T>(
  size: number,
  array: T[]
): Iterable<T[]> {
  if (size === 0) {
    yield [];
    return;
  }
  for (let i = 0; i < array.length - size + 1; i++) {
    const rest = array.slice(i + 1);
    for (const combination of allCombinationsOfSize(size - 1, rest)) {
      yield [array[i], ...combination];
    }
  }
}

export function flatten<T>(array: Array<Array<T>>): T[] {
  const values: T[] = [];
  for (const subArray of array) {
    for (const value of subArray) {
      values.push(value);
    }
  }
  return values;
}
