import { Action, ActionType } from "./action";
import { INDICES, DIGITS } from "./constants";
import { range, simpleEnumValues } from "./utils";
import { BoardState } from "./state";

export enum StrategyId {
  FILL_NUMBERS
}

type Strategy = (state: BoardState) => Action | undefined;

function getBox(i: number, j: number, array: Array<Array<any>>) {
  const boxRow = Math.floor(i / 3);
  const boxCol = Math.floor(j / 3);
  const box = [];
  for (let ii = 0; ii < 3; ii++) {
    for (let jj = 0; jj < 3; jj++) {
      box.push(array[boxRow * 3 + ii][boxCol * 3 + jj]);
    }
  }
  return box;
}

function getRow(i: number, array: Array<Array<any>>) {
  return array[i];
}

function getCol(j: number, array: Array<Array<any>>) {
  const col = [];
  for (const row of INDICES) {
    col.push(array[row][j]);
  }
  return col;
}

function includesDigit(digit: number) {
  return array => array.includes(digit);
}

interface StrategyIndex {
  [key: number]: Strategy;
}

const STRATEGY_IMPLS: StrategyIndex = {
  [StrategyId.FILL_NUMBERS]: ({ board, marks }: BoardState): Action => {
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
            getBox(i, j, board)
          ];
          if (!houses.some(includesDigit(candidate))) {
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
  }
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
