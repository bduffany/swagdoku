import { Action, ActionType } from "./action";
import { INDICES, DIGITS } from "./constants";
import {
  range,
  relativeRange,
  simpleEnumValues,
  allPairs,
  pairEquals
} from "./utils";
import { BoardState } from "./state";

export enum StrategyId {
  FILL_NUMBERS,
  NAKED_SINGLE,
  HIDDEN_SINGLE,
  // NAKED_PAIR,
  // NAKED_TRIPLE,
  LOCKED_CANDIDATE,
  X_WING
}

type Strategy = (state: BoardState) => Action | undefined;

function getBoxByRowCol<T>(
  i: number,
  j: number,
  array: Array<Array<T>>
): Array<T> {
  const boxRow = Math.floor(i / 3);
  const boxCol = Math.floor(j / 3);
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
): Iterable<Array<number>> {
  for (const row of relativeRange(boxRow * 3, 3)) {
    for (const col of relativeRange(boxCol * 3, 3)) {
      yield [row, col];
    }
  }
}

function getRow<T>(i: number, array: Array<Array<T>>): Array<T> {
  return array[i];
}

function getCol<T>(j: number, array: Array<Array<T>>): Array<T> {
  const col = [];
  for (const row of INDICES) {
    col.push(array[row][j]);
  }
  return col;
}

function transpose<T>(array: Array<Array<T>>): Array<Array<T>> {
  return [...range(array.length)].map(i => getCol(i, array));
}

function transposeAction<T>(action: Action | undefined) {
  if (action === undefined) return action;
  if (action.actions !== undefined) {
    return { ...action, actions: action.actions.map(transposeAction) };
  }
  return { ...action, row: action.col, col: action.row };
}

function eliminate(digit: number, candidates: Array<number>): Array<number> {
  return candidates.filter(candidate => candidate !== digit);
}

function* rowIndicesExcludingBox(boxRow: number) {
  for (const i of INDICES) {
    if (Math.floor(i / 3) === boxRow) {
      continue;
    }
    yield i;
  }
}

function colIndicesExcludingBox(boxCol: number) {
  // Same implementation.
  return rowIndicesExcludingBox(boxCol);
}

function indicesMatching<T>(
  predicate: (T) => boolean,
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
    for (const col of INDICES) {
      for (const digit of DIGITS) {
        const column = getCol(col, marks);
        const pencilMarkCount = column.filter(marks => marks.includes(digit))
          .length;
        if (pencilMarkCount === 1) {
          const [row] = INDICES.filter(i => column[i].includes(digit));
          return {
            type: ActionType.SET_VALUE,
            row,
            col,
            value: digit
          };
        }
      }
    }
  },
  [StrategyId.LOCKED_CANDIDATE]: ({
    board,
    marks
  }: BoardState): Action | undefined => {
    for (const boxRow of range(3)) {
      for (const boxCol of range(3)) {
        const boxValues = getBox(boxRow, boxCol, board);
        for (const digit of DIGITS) {
          if (boxValues.includes(digit)) continue;

          // Check if digit is locked to a single row or col.
          const candidateMarkRows = new Set<number>();
          const candidateMarkCols = new Set<number>();

          for (const [row, col] of boxRowColumns(boxRow, boxCol)) {
            if (marks[row][col].includes(digit)) {
              candidateMarkRows.add(row);
              candidateMarkCols.add(col);
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
          } else if (candidateMarkCols.size === 1) {
            const [col] = candidateMarkRows;
            for (const row of rowIndicesExcludingBox(boxRow)) {
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
        }
      }
    }
    return undefined;
  },
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
        return nextAction;
      }
    }
    return undefined;
  }
}
