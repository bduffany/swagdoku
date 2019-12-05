import { Component, ChangeDetectionStrategy } from '@angular/core';

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
  [6, 0, 0, 0, 7, 8, 0, 0, 2],
];

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

enum SettingId {
  AUTO_FILL_PENCIL_MARKS,
  AUTO_APPLY_MASTERED_TECHNIQUES,

  MASTERED_FULL_HOUSE,
}

function filledArray(value: any = 0, length = 9) {
  return Array(length).fill(value, 0, length);
}

const settingsGroups: Array<SettingsGroup> = [
  {
    name: 'Basic',
    settings: [
      {
        id: SettingId.AUTO_FILL_PENCIL_MARKS,
        label: 'Auto fill pencil marks at start of game',
        isEnabled: true,
      },
      {
        id: SettingId.AUTO_APPLY_MASTERED_TECHNIQUES,
        label: 'Auto apply mastered techniques',
        isEnabled: true,
      }
    ]
  },
  {
    name: 'Mastered techniques (easy)',
    settings: [
      {
        id: SettingId.MASTERED_FULL_HOUSE,
        label: 'Full house',
        isEnabled: true,
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
  selector: 'my-app',
  templateUrl: './app.component.html',
  styleUrls: [ './app.component.css' ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent  {
  private board: Array<Array<number>> = board;
  private pencilMarks: Array<Array<Array<number>>>;
  private settingsGroups: Array<SettingsGroup> = settingsGroups;
  private digits: Array<number> = DIGITS;

  constructor() {
    this.pencilMarks = filledArray()
        .map(_ => filledArray()
            .map(_ => filledArray(false)));
  }

  handleKeyDown(e: KeyboardEvent) {
    const cell = e.target as HTMLDivElement;
    const key = e.which;
    const shift = e.shiftKey;
    console.log(`Keydown: ${key}; shift=${shift}`);
    e.preventDefault();

    // TODO: commit to stack of actions (support UNDO / REDO)

    if (key === 8 // backspace
        || key === 46 // delete
        || key === 32 // space
        || key === 48 // 0
        ) {
      this.clearCell(cell);
      return;
    }
    const number = key - 48; // 0
    if (number < 1 || number > 9) {
      return;
    }

    if (shift) {
      this.togglePencilMark(cell, number);
    } else {
      this.setValue(cell, number);
    }
  }

  togglePencilMark(cell, number) {
    const value = cell.querySelector('.value');
    value.classList.add('hidden');
    const pencilMarks = cell.querySelector('.pencil-marks');
    pencilMarks.classList.remove('hidden');
    const pencilMark =
        pencilMarks.querySelector(`.pencil-mark-${number}`);
    toggleClass('hidden', pencilMark);
  }

  clearCell(cell) {
    const pencilMarks = cell.querySelectorAll('.pencil-mark');
    pencilMarks.forEach(hide);
    const value = cell.querySelector('.value');
    value.innerHTML = '';
  }

  setValue(cell: HTMLElement, number: number) {
    const pencilMarks = cell.querySelector('.pencil-marks');
    hide(pencilMarks);
    const value = cell.querySelector('.value');
    value.innerHTML = String(number);
  }
}

function toggleClass(className: string, element: HTMLElement) {
  if (element.classList.contains(className)) {
    element.classList.remove(className);
  } else {
    element.classList.add(className);
  }
}

function hide(element: Element) {
  element.classList.add('hidden');
}
