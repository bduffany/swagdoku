import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ChangeDetectorRef,
  AfterViewInit
} from "@angular/core";

import { Action, ActionType, Highlight, updateState } from "./action";
import { DIGITS, INDICES } from "./constants";
import { Solver, getPeers } from "./solver";
import { delay, range, relativeRange, filterOut } from "./utils";
import { BoardState, BoardCoordinates } from "./state";

// TODO: load from API?
// Hard puzzle from websudoku.com
// const board = [
//   [1, 0, 0, 4, 2, 0, 0, 0, 9],
//   [0, 6, 0, 0, 0, 3, 0, 5, 0],
//   [0, 0, 3, 0, 0, 0, 0, 0, 0],

//   [0, 0, 6, 7, 8, 0, 0, 0, 0],
//   [7, 0, 8, 0, 5, 0, 1, 0, 4],
//   [0, 0, 0, 0, 3, 1, 6, 0, 0],

//   [0, 0, 0, 0, 0, 0, 3, 0, 0],
//   [0, 8, 0, 2, 0, 0, 0, 4, 0],
//   [6, 0, 0, 0, 7, 8, 0, 0, 2]
// ];

const evil1 =
  "040000068065003100000100000000050706003908200507060000000009000004800620280000090";

// const evil2 =
//  "540300000000080107000026005035000004020000070800000260300840000204070000000002089";

function parseBoard(serializedBoard: string): Array<Array<number>> {
  const board = [...range(9)].map(_ => [...range(9)]);
  for (const row of INDICES) {
    for (const col of INDICES) {
      board[row][col] = Number(serializedBoard[row * 9 + col]);
    }
  }
  return board;
}

const board = parseBoard(evil1);

enum SettingId {
  AUTO_FILL_PENCIL_MARKS,
  AUTO_APPLY_MASTERED_TECHNIQUES,

  MASTERED_FULL_HOUSE
}

function filledArray(value: any = 0, length = 9) {
  return Array(length).fill(value, 0, length);
}

const settingsGroups: Array<SettingsGroup> = [
  {
    name: "Basic",
    settings: [
      {
        id: SettingId.AUTO_FILL_PENCIL_MARKS,
        label: "Auto fill pencil marks at start of game",
        isEnabled: true
      },
      {
        id: SettingId.AUTO_APPLY_MASTERED_TECHNIQUES,
        label: "Auto apply mastered techniques",
        isEnabled: true
      }
    ]
  },
  {
    name: "Mastered techniques (easy)",
    settings: [
      {
        id: SettingId.MASTERED_FULL_HOUSE,
        label: "Full house",
        isEnabled: true
      }
    ]
  }
];

interface Setting {
  id: SettingId;
  label: string;
  isEnabled: boolean;
}

interface SettingsGroup {
  name: string;
  settings: Array<Setting>;
}

@Component({
  selector: "app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements AfterViewInit {
  private root: Element;
  private board: Array<Array<number>> = board;
  private solver: Solver = new Solver();
  private pencilMarks: Array<Array<Array<number>>>;
  private settingsGroups: Array<SettingsGroup> = settingsGroups;
  private digits: Array<number> = DIGITS;
  private actions: Array<Action> = [];
  private poppedActions: Array<Action> = [];
  private haveNumbersBeenFilled: boolean = false;

  constructor(private cd: ChangeDetectorRef) {
    this.pencilMarks = filledArray().map(_ => filledArray().map(_ => []));
    this.root = document.querySelector("app");
  }

  ngAfterViewInit() {
    this.cd.detach();

    this.solveFull();
  }

  clickDigitControl(event: MouseEvent) {
    const clickedDigitElement = event.target as Element;
    const digit = Number(clickedDigitElement.textContent);
    this.setHighlightedDigit(digit);
  }

  unclickDigitControl() {
    this.setHighlightedDigit(0);
  }

  setHighlightedDigit(value: number = undefined) {
    if (value === undefined) {
      const focusedControl = document.querySelector(".digit-control:focus");
      if (!focusedControl) {
        value = 0;
      } else {
        value = Number(focusedControl.textContent);
      }
    }
    for (const digit of DIGITS) {
      const pencilMarks = document.querySelectorAll(`.pencil-mark-${digit}`);
      for (const pencilMark of Array.from(pencilMarks)) {
        if (
          pencilMark.textContent === String(value) &&
          !pencilMark.classList.contains("hidden")
        ) {
          pencilMark.classList.add("highlight");
        } else {
          pencilMark.classList.remove("highlight");
        }
      }
      const cells = document.querySelectorAll(".cell");
      for (const cell of Array.from(cells)) {
        const valueElement = cell.querySelector(".value");
        if (valueElement.textContent.trim() === String(value)) {
          valueElement.classList.add("highlight");
        } else {
          valueElement.classList.remove("highlight");
        }
      }
    }
  }

  async solveFull() {
    while (true) {
      const action = this.solver.getNextAction({
        board: this.board,
        marks: this.pencilMarks
      });
      if (action === undefined) {
        return;
      }
      await this.pushAction(action);
    }
  }

  async pushAction(action: Action) {
    this.poppedActions = [];
    this.actions.push(action);

    let state: BoardState = naiveDeepCopy({
      board: this.board,
      marks: this.pencilMarks
    });
    updateState(action, state);
    if (action.strategyName) {
      await this.visualizeChanges(action, state);
    } else {
      this.clearHighlights();
    }
    this.board = state.board;
    this.pencilMarks = state.marks;

    this.renderState();
  }

  renderState() {
    for (const i of INDICES) {
      for (const j of INDICES) {
        const cell = this.getCell(i, j);
        if (this.board[i][j] || !this.pencilMarks[i][j]) {
          this.renderValue(cell, this.board[i][j]);
        } else {
          this.renderPencilMarks(cell, this.pencilMarks[i][j]);
        }
      }
    }
  }

  popAction() {}

  async visualizeChanges(action: Action, { board, marks }: BoardState) {
    const highlights: Highlight[] = [
      ...(action.highlights || []),
      ...(action.actions || []).flatMap(action => action.highlights || [])
    ];
    // Add implicit "eliminate" highlights
    for (const i of INDICES) {
      for (const j of INDICES) {
        for (const oldMark of this.pencilMarks[i][j]) {
          const removedMarks = [];
          if (!marks[i][j].includes(oldMark) && board[i][j] === 0) {
            removedMarks.push(oldMark);
          }
          if (removedMarks.length) {
            highlights.push({
              coordinates: [i, j],
              marks: removedMarks,
              type: "eliminate"
            });
          }
          if (board[i][j] > 0 && this.board[i][j] === 0) {
            highlights.push({
              coordinates: [i, j],
              marks: [board[i][j]],
              type: "clue"
            });
          }
        }
      }
    }
    this.clearHighlights();
    this.applyHighlights(highlights);
    await delay(100);
    this.clearHighlights();
  }

  applyHighlights(highlights: Highlight[]) {
    // TODO: highlight digits as well
    for (const highlight of highlights) {
      for (const mark of highlight.marks) {
        const [row, col] = highlight.coordinates;
        const markElement = this.root.querySelector(
          `.row-${row}.col-${col} .pencil-mark-${mark}`
        );
        if (!markElement.classList.contains("hidden")) {
          markElement.classList.add("highlight");
          markElement.classList.add(`highlight-${highlight.type || "clue"}`);
        }
      }
    }
  }

  clearHighlights() {
    const highlighted = this.root.querySelectorAll(".highlight");
    for (const element of Array.from(highlighted)) {
      const classes = [...element.classList];
      for (const clazz of classes.filter(clazz =>
        clazz.startsWith("highlight")
      )) {
        // Remove 'highlight'and 'highlight-*'classes
        element.classList.remove(clazz);
      }
    }
  }

  async commitChanges(state: BoardState) {}

  getCell(row: number, col: number): Element {
    return this.root.querySelector(`.cell.row-${row}.col-${col}`);
  }

  undoAction(action) {
    // TODO
  }

  handleKeyDown(e: KeyboardEvent) {
    const cell = e.target as HTMLDivElement;
    const key = e.which;
    const shift = e.shiftKey;
    console.log(`Keydown: ${key}; shift=${shift}`);
    e.preventDefault();

    const [row, col] = ["row", "col"].map(key => Number(cell.dataset[key]));

    if (
      key === 8 || // backspace
      key === 46 || // delete
      key === 32 || // space
      key === 48 // 0
    ) {
      this.pushAction({ type: ActionType.CLEAR_VALUE, cell, row, col });
      return;
    }
    const number = key - 48; // 0
    if (number < 1 || number > 9) {
      return;
    }

    if (shift) {
      let pencilMarks = [...this.pencilMarks[row][col]];
      if (pencilMarks.includes(number)) {
        pencilMarks = pencilMarks.filter(mark => mark !== number);
      } else {
        pencilMarks.push(number);
      }
      this.pushAction({
        type: ActionType.SET_PENCIL_MARKS,
        cell,
        row,
        col,
        value: pencilMarks
      });
    } else {
      this.pushAction({
        type: ActionType.SET_VALUE,
        cell,
        row,
        col,
        value: number
      });
    }
  }

  renderPencilMarks(cell: Element, marks: Array<number>) {
    hide(cell.querySelector(".value"));
    const pencilMarks = cell.querySelector(".pencil-marks");
    show(pencilMarks);
    for (const digit of DIGITS) {
      const pencilMark = pencilMarks.querySelector(`.pencil-mark-${digit}`);
      if (marks.includes(digit)) {
        show(pencilMark);
      } else {
        hide(pencilMark);
      }
    }
  }

  renderValue(cell: Element, number: number) {
    const pencilMarks = cell.querySelector(".pencil-marks");
    hide(pencilMarks);
    const value = cell.querySelector(".value");
    show(value);
    value.innerHTML = String(number || "&nbsp;");
  }
}

function hide(element: Element) {
  element.classList.add("hidden");
}

function show(element: Element) {
  element.classList.remove("hidden");
}

function naiveDeepCopy(object: any) {
  return JSON.parse(JSON.stringify(object));
}
