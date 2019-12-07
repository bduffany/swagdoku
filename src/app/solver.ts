import { Action, ActionType } from "./action";
import { INDICES, DIGITS } from "./constants";
import { range, relativeRange, simpleEnumValues } from "./utils";
import { BoardState } from "./state";

export enum StrategyId {
  FILL_NUMBERS,
  NAKED_SINGLE,
  HIDDEN_SINGLE,
  LOCKED_CANDIDATE
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

interface StrategyIndex {
  [key: number]: Strategy;
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
  }

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
