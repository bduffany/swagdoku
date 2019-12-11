import { BoardState, BoardCoordinates } from "./state";
import { getPeers } from "./solver";
import { filterOut } from "./utils";

export interface Highlight {
  coordinates: BoardCoordinates;
  value?: number;
  marks?: number[];
  type?: string; // clue|eliminate
}

export enum ActionType {
  ACTION_GROUP,
  CLEAR_VALUE,
  SET_VALUE,
  SET_PENCIL_MARKS
}

export interface Action {
  type: ActionType;

  strategyName?: string;

  row?: number;
  col?: number;
  cell?: Element;

  value?: number | Array<number>;
  highlights?: Array<Highlight>;

  actions?: Array<Action>;
}

export function updateState(
  action: Action,
  { board, marks: pencilMarks }: BoardState
): BoardState {
  if (action.actions) {
    for (const child of action.actions) {
      updateState(child, { board, marks: pencilMarks });
    }
    return;
  }

  const { row, col } = action;
  switch (action.type) {
    case ActionType.SET_VALUE:
    case ActionType.CLEAR_VALUE:
      const value = (action.value as number) || 0;
      board[row][col] = value;
      pencilMarks[row][col] = [];
      // Automatically eliminate value from peers.
      if (value > 0) {
        for (const [peerRow, peerCol] of getPeers([row, col]).toArray()) {
          pencilMarks[peerRow][peerCol] = filterOut(
            value,
            pencilMarks[peerRow][peerCol]
          );
        }
      }
      break;
    case ActionType.SET_PENCIL_MARKS:
      const marks = (action.value as Array<number>).sort();
      board[row][col] = 0;
      pencilMarks[row][col] = marks;
      break;
  }
}
