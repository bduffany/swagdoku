import { Action, ActionType, Highlight } from "./action";
import { INDICES, DIGITS } from "./constants";
import {
  range,
  relativeRange,
  simpleEnumValues,
  allPairs,
  pairEquals,
  allCombinationsOfSize,
  flatten,
  intersectionOf
} from "./utils";
import { BoardState, Board, PencilMarks, BoardCoordinates } from "./state";

export enum StrategyId {
  FILL_NUMBERS,
  NAKED_SINGLE,
  HIDDEN_SINGLE,
  LOCKED_CANDIDATE,
  NAKED_PAIR,
  NAKED_TRIPLE,
  NAKED_QUADRUPLE,
  // HIDDEN_PAIR,
  X_WING
}

class CoordinateSet {
  private hashes: Set<number>;

  constructor(coords: Iterable<BoardCoordinates>, { hashes = undefined } = {}) {
    if (hashes) {
      this.hashes = hashes;
    } else {
      this.hashes = new Set([...coords].map(hashCoords));
    }
  }

  static intersectAll(coordLists: Iterable<CoordinateSet>): CoordinateSet {
    const [first, ...rest] = coordLists;
    if (first === undefined) {
      return new CoordinateSet([]);
    }
    let acc = first;
    for (const value of rest) {
      acc = acc.intersectionWith(value);
    }
    return acc;
  }

  intersectionWith(other: CoordinateSet) {
    return new CoordinateSet(undefined, {
      hashes: intersectionOf(this.hashes, other.hashes)
    });
  }

  toArray(): BoardCoordinates[] {
    return [...this.hashes].map(unhashCoords);
  }
}

type Strategy = (state: BoardState) => Action | undefined;

function getBoxRowBoxCol(row: number, col: number): BoardCoordinates {
  return [Math.floor(row / 3), Math.floor(col / 3)];
}

export function getRowColsOfContainingBox(
  row: number,
  col: number
): Iterable<BoardCoordinates> {
  const [boxRow, boxCol] = getBoxRowBoxCol(row, col);
  return boxRowColumns(boxRow, boxCol);
}

function getBoxByRowCol<T>(
  row: number,
  col: number,
  array: Array<Array<T>>
): Array<T> {
  const [boxRow, boxCol] = getBoxRowBoxCol(row, col);
  return getBox(boxRow, boxCol, array);
}

function getBox<T>(
  boxRow: number,
  boxCol: number,
  array: Array<Array<T>>
): Array<T> {
  const box = [];
  for (let ii = 0; ii < 3; ii++) {
    for (let jj = 0; jj < 3; jj++) {
      box.push(array[boxRow * 3 + ii][boxCol * 3 + jj]);
    }
  }
  return box;
}

function* boxRowColumns(
  boxRow: number,
  boxCol: number
): Iterable<BoardCoordinates> {
  for (const row of relativeRange(boxRow * 3, 3)) {
    for (const col of relativeRange(boxCol * 3, 3)) {
      yield [row, col];
    }
  }
}

function getRow<T>(row: number, array: Array<Array<T>>): Array<T> {
  return array[row];
}

function getCol<T>(col: number, array: Array<Array<T>>): Array<T> {
  const values = [];
  for (const row of INDICES) {
    values.push(array[row][col]);
  }
  return values;
}

function transpose<T>(array: Array<Array<T>>): Array<Array<T>> {
  return [...range(array.length)].map(col => getCol(col, array));
}

function transposeCoords([row, col]: BoardCoordinates): BoardCoordinates {
  return [col, row];
}

/**
 * Given an action that only works in a single axis (either rows or cols but not
 * both), returns a new action that works on both rows and cols.
 * @param action
 */
function transposeAction(action: Action | undefined): Action {
  if (action === undefined) return action;
  if (action.actions !== undefined) {
    return {
      ...action,
      highlights: transposeHighlights(action.highlights),
      actions: action.actions.map(transposeAction)
    };
  }
  return {
    ...action,
    row: action.col,
    col: action.row,
    highlights: transposeHighlights(action.highlights)
  };
}

function transposeHighlights(
  highlights: Highlight[] | undefined
): Highlight[] | undefined {
  if (!highlights) return undefined;
  return highlights.map(highlight => {
    return {
      ...highlight,
      coordinates: transposeCoords(highlight.coordinates)
    };
  });
}

function eliminate(digit: number, candidates: Array<number>): Array<number> {
  return candidates.filter(candidate => candidate !== digit);
}

function eliminateAllOf(
  digits: Set<number>,
  candidates: Array<number>
): Array<number> {
  return candidates.filter(candidate => !digits.has(candidate));
}

function* rowIndicesExcludingBox(boxRow: number) {
  for (const i of INDICES) {
    if (Math.floor(i / 3) === boxRow) continue;
    yield i;
  }
}

function colIndicesExcludingBox(boxCol: number) {
  // Same implementation.
  return rowIndicesExcludingBox(boxCol);
}

export function hashCoords([row, col]: BoardCoordinates): number {
  return row * 10 + col;
}

function unhashCoords(hash: number): BoardCoordinates {
  return [Math.floor(hash / 10), hash % 10];
}

export function getPeers([row, col]: BoardCoordinates): CoordinateSet {
  return new CoordinateSet(
    [
      // Box coords
      ...getRowColsOfContainingBox(row, col),
      // Row coords
      ...INDICES.map(i => [i, col] as BoardCoordinates),
      // Col coords
      ...INDICES.map(i => [row, i] as BoardCoordinates)
    ].filter(([peerRow, peerCol]) => !(peerRow === row && peerCol === col))
  );
}

function* enumerateAllHouseCoordLists(): Iterable<Array<[number, number]>> {
  // Rows
  yield* INDICES.map(row => INDICES.map(col => [row, col]));
  // Columns
  yield* INDICES.map(col => INDICES.map(row => [row, col]));
  // Boxes
  for (const boxRow of range(3)) {
    for (const boxCol of range(3)) {
      yield [...boxRowColumns(boxRow, boxCol)];
    }
  }
}

const ALL_HOUSES_COORDINATES: Array<Array<[number, number]>> = [
  ...enumerateAllHouseCoordLists()
];

function nakedSubset(size: number): Strategy {
  return (state: BoardState): Action | undefined =>
    tryFindAndEliminateCoverSetOfSize(size, state.marks);
}

/**
 * @returns a pair of (numbers in the cover set, coordinates of the set)
 */
function tryFindAndEliminateCoverSetOfSize(
  size: number,
  marks: PencilMarks
): Action | undefined {
  for (const houseCoords of ALL_HOUSES_COORDINATES) {
    const coverSet = findCoverSetInHouse(size, houseCoords, marks);
    if (coverSet === undefined) {
      continue;
    }
    const [values, coordList] = coverSet;

    const peersToEliminate = getPeersOfAllOf(coordList)
      .toArray()
      .filter(([row, col]) => containsAnyOf(values, marks[row][col]));

    if (peersToEliminate.length) {
      return {
        type: ActionType.ACTION_GROUP,
        actions: peersToEliminate.map(([row, col]) => {
          return {
            type: ActionType.SET_PENCIL_MARKS,
            row,
            col,
            value: eliminateAllOf(values, marks[row][col])
          };
        })
      };
    }
  }
  return undefined;
}

function containsAnyOf(values: Iterable<number>, candidates: Array<number>) {
  return [...values].some(value => candidates.includes(value));
}

function findCoverSetInHouse(
  size: number,
  houseCoords: Array<[number, number]>,
  marks: PencilMarks
): [Set<number>, Array<BoardCoordinates>] | undefined {
  // Cells with at least 0 and at most $size candidates.
  const prunedCoords: Array<BoardCoordinates> = [];
  for (const [row, col] of houseCoords) {
    if (marks[row][col].length > 0 && marks[row][col].length <= size) {
      prunedCoords.push([row, col]);
    }
  }
  // Now try to find a combination of $size cells comprising
  // at most $size unique candidates.
  for (const combination of allCombinationsOfSize(size, prunedCoords)) {
    // TODO: update TS dep to flat() support & remove cast
    const coverSet = new Set(
      flatten(combination.map(([row, col]) => marks[row][col]))
    );
    if (coverSet.size === size) {
      return [coverSet, combination];
    }
  }
}

export function getPeersOfAllOf(
  coordinates: Iterable<BoardCoordinates>
): CoordinateSet {
  return CoordinateSet.intersectAll([...coordinates].map(getPeers));
}

function indicesMatching<T>(
  predicate: (value: T) => boolean,
  array: Array<T>
): Array<number> {
  return [...range(array.length)].filter(key => predicate(array[key]));
}

function indicesContainingCandidate(
  candidate: number,
  array: Array<Array<number>>
): Array<number> {
  return INDICES.filter(i => array[i].includes(candidate));
}

interface StrategyIndex {
  [key: number]: Strategy;
}

function transposableStrategy(strategy: Strategy): Strategy {
  return ({ board, marks }: BoardState) => {
    const action = strategy({ board, marks });
    if (action !== undefined) return action;
    const transposedAction = strategy({
      board: transpose(board),
      marks: transpose(marks)
    });
    return transposeAction(transposedAction);
  };
}

const STRATEGY_IMPLS: StrategyIndex = {
  [StrategyId.FILL_NUMBERS]: ({
    board,
    marks
  }: BoardState): Action | undefined => {
    const actions = [];
    for (const i of INDICES) {
      for (const j of INDICES) {
        // If digit already present, don't fill.
        if (board[i][j]) continue;
        // Fill marks for cell (i, j)
        const marks = [];
        for (const candidate of DIGITS) {
          const houses = [
            getRow(i, board),
            getCol(j, board),
            getBoxByRowCol(i, j, board)
          ];
          if (!houses.some(house => house.includes(candidate))) {
            marks.push(candidate);
          }
        }
        actions.push({
          type: ActionType.SET_PENCIL_MARKS,
          row: i,
          col: j,
          value: marks
        });
      }
    }
    return { type: ActionType.ACTION_GROUP, actions };
  },
  [StrategyId.NAKED_SINGLE]: ({
    board,
    marks
  }: BoardState): Action | undefined => {
    for (const row of INDICES) {
      for (const col of INDICES) {
        if (marks[row][col].length === 1) {
          const [mark] = marks[row][col];
          return { type: ActionType.SET_VALUE, row, col, value: mark };
        }
      }
    }
  },
  [StrategyId.HIDDEN_SINGLE]: ({
    board,
    marks
  }: BoardState): Action | undefined => {
    for (const boxRow of range(3)) {
      for (const boxCol of range(3)) {
        for (const digit of DIGITS) {
          const pencilMarkCount = getBox(boxRow, boxCol, marks).filter(marks =>
            marks.includes(digit)
          ).length;
          if (pencilMarkCount === 1) {
            for (const [row, col] of boxRowColumns(boxRow, boxCol)) {
              if (marks[row][col].includes(digit)) {
                return {
                  type: ActionType.SET_VALUE,
                  row,
                  col,
                  value: digit
                };
              }
            }
          }
        }
      }
    }

    const rowStrategy: Strategy = ({ board, marks }) => {
      for (const row of INDICES) {
        for (const digit of DIGITS) {
          const pencilMarkCount = marks[row].filter(marks =>
            marks.includes(digit)
          ).length;
          if (pencilMarkCount === 1) {
            const [col] = INDICES.filter(i => marks[row][i].includes(digit));
            return {
              type: ActionType.SET_VALUE,
              row,
              col,
              value: digit
            };
          }
        }
      }
    };

    return transposableStrategy(rowStrategy)({ board, marks });
  },
  [StrategyId.LOCKED_CANDIDATE]: transposableStrategy(
    ({ board, marks }: BoardState): Action | undefined => {
      for (const boxRow of range(3)) {
        for (const boxCol of range(3)) {
          const boxValues = getBox(boxRow, boxCol, board);
          for (const digit of DIGITS) {
            if (boxValues.includes(digit)) continue;

            // Check if digit is locked to a single row.
            const candidateMarkRows = new Set<number>();

            for (const [row, col] of boxRowColumns(boxRow, boxCol)) {
              if (marks[row][col].includes(digit)) {
                candidateMarkRows.add(row);
              }
            }
            const eliminations = [];
            if (candidateMarkRows.size === 1) {
              const [row] = candidateMarkRows;
              for (const col of colIndicesExcludingBox(boxCol)) {
                const marksToEliminateFrom = marks[row][col];
                if (marksToEliminateFrom.includes(digit)) {
                  eliminations.push({
                    type: ActionType.SET_PENCIL_MARKS,
                    value: eliminate(digit, marksToEliminateFrom),
                    row,
                    col
                  });
                }
              }
            }
            if (eliminations.length) {
              return {
                type: ActionType.ACTION_GROUP,
                actions: eliminations
              };
            }
          }
        }
      }
      return undefined;
    }
  ),
  [StrategyId.NAKED_PAIR]: nakedSubset(2),
  [StrategyId.NAKED_TRIPLE]: nakedSubset(3),
  [StrategyId.NAKED_QUADRUPLE]: nakedSubset(4),
  [StrategyId.X_WING]: transposableStrategy(({ board, marks }: BoardState):
    | Action
    | undefined => {
    for (const digit of DIGITS) {
      const candidateRowsAndColPairs: Array<[number, [number, number]]> = [];
      for (const row of INDICES) {
        if (board[row].includes(digit)) continue;
        const cols = indicesContainingCandidate(digit, marks[row]);
        if (cols.length === 2) {
          candidateRowsAndColPairs.push([row, cols as [number, number]]);
        }
      }
      for (const [[row1, colPair1], [row2, colPair2]] of allPairs(
        candidateRowsAndColPairs
      )) {
        if (!pairEquals(colPair1, colPair2)) continue;
        // Found potential X-Wing. See if anything is eliminated.
        const rowColsToEliminate: Array<[number, number]> = [];
        for (const col of colPair1) {
          const column = getCol(col, marks);
          const rowsToEliminate = indicesContainingCandidate(
            digit,
            column
          ).filter(row => ![row1, row2].includes(row));
          if (rowsToEliminate.length > 0) {
            rowsToEliminate
              .map(row => [row, col] as [number, number])
              .forEach(rowCol => rowColsToEliminate.push(rowCol));
          }
        }
        if (rowColsToEliminate.length > 0) {
          return {
            type: ActionType.ACTION_GROUP,
            actions: rowColsToEliminate.map(([row, col]) => {
              return {
                type: ActionType.SET_PENCIL_MARKS,
                row,
                col,
                value: eliminate(digit, marks[row][col])
              };
            })
          };
        }
      }
    }
  })

  /* TEMPLATE:
  [StrategyId.FOO]: ({
    board,
    marks
  }: BoardState): Action | undefined => {},
  */
};

export class Solver {
  private haveNumbersBeenFilled: boolean = false;

  getNextAction(state: BoardState): Action | undefined {
    for (const strategyId of simpleEnumValues(StrategyId)) {
      if (
        strategyId === StrategyId.FILL_NUMBERS &&
        this.haveNumbersBeenFilled
      ) {
        continue;
      }
      const strategy = STRATEGY_IMPLS[strategyId];
      const nextAction = strategy(state);
      if (strategyId === StrategyId.FILL_NUMBERS) {
        this.haveNumbersBeenFilled = true;
      }
      if (nextAction !== undefined) {
        nextAction.strategyName = StrategyId[strategyId];
        return nextAction;
      }
    }
    return undefined;
  }
}
