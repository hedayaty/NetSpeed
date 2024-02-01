/*
 * Copyright 2011-2019 Amir Hedayaty < hedayaty AT gmail DOT com >
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

import GObject from 'gi://GObject';
import St from 'gi://St';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

/**
 * Class: NetSpeedLayoutMenuItem
 */
export const NetSpeedLayoutMenuItem = GObject.registerClass(
  class NetSpeedLayoutMenuItem extends PopupMenu.PopupBaseMenuItem {
    /**
     * NetSpeedLayoutMenuItem: ctor
     */
    constructor(device, icon, menu_label_size) {
      super();
      this.device = device;
      this._icon = icon;
      this._device_title = new St.Label(
        {
          text: device,
          style_class: "ns-menuitem"
        }
      );
      this._device_title.get_clutter_text().set_line_wrap(true);

      this._down_label = new St.Label({ text: "", style_class: "ns-menuitem" });
      this._up_label = new St.Label({ text: "", style_class: "ns-menuitem" });
      this._ips_label = new St.Label({ text: "", style_class: "ns-menuitem" });

      if (this._icon !== null) {
        this.add(this._icon);
      } else {
        this.add(new St.Label());
      }
      this.add(this._device_title);
      this.add(this._down_label);
      this.add(this._up_label);
      this.add(this._ips_label);
      this.update_ui(menu_label_size);
      this.show_ip(false);

      //log(`${getMethods(this)}`);
    }

    /**
     * NetSpeedLayoutMenuItem: update_ui
     * update settings
     */
    update_ui(menu_label_size) {
      this._down_label.set_width(menu_label_size);
      this._up_label.set_width(menu_label_size);
      this._device_title.set_width(menu_label_size);
      this._ips_label.set_width(menu_label_size);
    }

    /**
     * NetSpeedLayoutMenuItem: update_speeds
     * update speeds
     */
    update_speeds(speed) {
      this._down_label.set_text(speed.down);
      this._up_label.set_text(speed.up);
    }

    /**
     * NetSpeedLayoutMenuItem: show_ip
     * @param {boolean} value
     */
    show_ip(value) {
      if (value) {
        this._ips_label.show();
      }
      else {
        this._ips_label.hide();
      }
    }

    /**
     * NetSpeedLayoutMenuItem: update_ips
     * update ips
     * @param {string[]} ips: IPs addresses array
     */
    update_ips(ips) {
      this._ips_label.set_text(ips.join("\n"));
    }

  });
