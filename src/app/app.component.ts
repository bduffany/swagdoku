import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  ChangeDetectorRef
} from "@angular/core";

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

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

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

enum ActionType {
  ACTION_GROUP,
  CLEAR_VALUE,
  SET_VALUE,
  SET_PENCIL_MARKS
}

interface Action {
  type: ActionType;

  row: number;
  col: number;
  cell: Element;

  value?: number | Array<number>;

  actions?: Array<Action>;
}

@Component({
  selector: "app",
  templateUrl: "./app.component.html",
  styleUrls: ["./app.component.css"],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent {
  private root: Element;
  private board: Array<Array<number>> = board;
  private pencilMarks: Array<Array<Array<number>>>;
  private settingsGroups: Array<SettingsGroup> = settingsGroups;
  private digits: Array<number> = DIGITS;
  private actions: Array<Action> = [];
  private poppedActions: Array<Action> = [];

  constructor() {
    this.pencilMarks = filledArray().map(_ => filledArray().map(_ => []));
    this.root = document.querySelector("app");
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

  doAction(action: Action) {
    const { cell, row, col } = action;
    switch (action.type) {
      case ActionType.SET_VALUE:
      case ActionType.CLEAR_VALUE:
        const value = (action.value as number) || 0;
        this.board[row][col] = value;
        this.pencilMarks[row][col] = [];
        this.renderValue(cell, value);
        break;
      case ActionType.SET_PENCIL_MARKS:
        const marks = (action.value as Array<number>).sort();
        this.board[row][col] = 0;
        this.pencilMarks[row][col] = marks;
        this.renderPencilMarks(cell, marks);
        break;
    }
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
