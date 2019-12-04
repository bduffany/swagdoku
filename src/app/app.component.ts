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

enum SettingId {
  AUTO_FILL_PENCIL_MARKS,
  AUTO_APPLY_MASTERED_TECHNIQUES,
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
        id: 'full-house',
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
  private board: Array<Array<number>>;
  private settingsGroups: Array<SettingsGroup>;

  constructor() {
    this.board = board;
    this.settingsGroups = settingsGroups;
  }

  handleKeyDown(e: KeyboardEvent) {
    const input = e.target as HTMLInputElement;
    const key = e.which;
    console.log(`Keydown: ${key}`);

    if (key === 8 // backspace
        || key === 46 // delete
        ) {
      input.value = '';
    }
  }

  handleKeyPress(e: KeyboardEvent) {
    e.preventDefault();
    const input = e.target as HTMLInputElement;
    const key = e.which;
    console.log(`Keypress: ${key}`);

    if (key === 32) { // space
      input.value = '';
      return;
    }
    const number = key - 48; // 0
    if (number >= 1 && number <= 9) {
      input.value = String(number);
    }
  }
}
