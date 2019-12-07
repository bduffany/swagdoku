export function* range(
  lowerOrUpper: number = 0,
  upper: number | undefined = undefined
) {
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

export function simpleEnumValues(enumClass) {
  return range(Object.keys(enumClass).length);
}
