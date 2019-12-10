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

  actions?: Array<Action>;
}
