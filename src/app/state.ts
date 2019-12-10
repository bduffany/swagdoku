export type Board = Array<Array<number>>;
export type PencilMarks = Array<Array<Array<number>>>;

export interface BoardState {
  board: Array<Array<number>>;
  marks: Array<Array<Array<number>>>;
}
