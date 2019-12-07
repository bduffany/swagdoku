import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ChangeDetectorRef,
  AfterViewInit
} from "@angular/core";

import { Action, ActionType } from "./action";
import { DIGITS, INDICES } from "./constants";
import { Solver } from "./solver";
import { delay, range, relativeRange } from "./utils";

// TODO: load from API?
const board = [
  [1, 0, 0, 4, 2, 0, 0, 0, 9],
  [0, 6, 0, 0, 0, 3, 0, 5, 0],
  [0, 0, 3, 0, 0, 0, 0, 0, 0],

  [0, 0, 6, 7, 8, 0, 0, 0, 0],
  [7, 0, 8, 0, 5, 0, 1, 0, 4],
  [0, 0, 0, 0, 3, 1, 6, 0, 0],

  [0, 0, 0, 0, 0, 0, 3, 0, 0],
  [0, 8, 0, 2, 0, 0, 0, 4, 0],
  [6, 0, 0, 0, 7, 8, 0, 0, 2]
];

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
    console.log(`Clicked ${digit}`);
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
          pencilMark.classList.add("highlighted");
        } else {
          pencilMark.classList.remove("highlighted");
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
      this.pushAction(action);
      await delay(500);
    }
  }

  disableChangeDetectionTrackBy(_, __) {
    return false;
  }

  pushAction(action: Action) {
    this.poppedActions = [];
    this.actions.push(action);

    if (action.type === ActionType.ACTION_GROUP) {
      for (const child of action.actions) {
        this.doAction(child);
      }
    } else {
      this.doAction(action);
    }
    this.setHighlightedDigit();
  }

  popAction() {
    const action = this.actions.pop();
    this.poppedActions.push(action);

    if (action.type === ActionType.ACTION_GROUP) {
      for (const child of action.actions) {
        this.undoAction(child);
      }
    } else {
      this.undoAction(action);
    }
  }

  getCell(row, col) {
    return this.root.querySelector(`.cell.row-${row}.col-${col}`);
  }

  doAction(action: Action) {
    const { row, col } = action;
    const cell = action.cell || this.getCell(row, col);
    switch (action.type) {
      case ActionType.SET_VALUE:
      case ActionType.CLEAR_VALUE:
        const value = (action.value as number) || 0;
        this.board[row][col] = value;
        this.pencilMarks[row][col] = [];
        this.renderValue(cell, value);
        if (value) {
          this.eliminatePencilMarks(row, col, value);
        }
        break;
      case ActionType.SET_PENCIL_MARKS:
        const marks = (action.value as Array<number>).sort();
        this.board[row][col] = 0;
        this.pencilMarks[row][col] = marks;
        this.renderPencilMarks(cell, marks);
        break;
    }
  }

  eliminatePencilMarks(row: number, col: number, digit: number) {
    const boxRow = Math.floor(row / 3);
    const boxCol = Math.floor(col / 3);
    for (const row of relativeRange(boxRow * 3, 3)) {
      for (const col of relativeRange(boxCol * 3, 3)) {
        this.eliminatePencilMark(row, col, digit);
      }
    }
    for (const row of INDICES) {
      this.eliminatePencilMark(row, col, digit);
    }
    for (const col of INDICES) {
      this.eliminatePencilMark(row, col, digit);
    }
  }

  eliminatePencilMark(row: number, col: number, digit: number) {
    const marks = this.pencilMarks[row][col];
    if (!marks.length || !marks.includes(digit)) return;
    this.pencilMarks[row][col] = marks.filter(value => value != digit);
    this.renderPencilMarks(this.getCell(row, col), this.pencilMarks[row][col]);
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
