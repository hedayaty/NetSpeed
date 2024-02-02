/*
 * Copyright 2011-2013 Amir Hedayaty < hedayaty AT gmail DOT com >
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import NetSpeedStatusIcon from './net_speed_status_icon.js';
import { Logger } from './lib.js';
import { NetSpeed } from './net_speed.js';




export default class extends Extension {

  enable() {
    Logger.init(this);

    this._netSpeed = new NetSpeed(this);
    this._netSpeedMenu = new NetSpeedStatusIcon(this, this._netSpeed);

    Main.panel.addToStatusArea('netSpeed', this._netSpeedMenu);
    // reposition in panel trick
    this._netSpeedMenu._positionInPanelChanged();

    this._netSpeed.start();
  }

  disable() {
    this._netSpeed?.stop();
    this._netSpeedMenu?.destroy();
    this._netSpeed = null;
    this._netSpeedMenu = null;
  }
}

// vim: ts=2 sw=2
