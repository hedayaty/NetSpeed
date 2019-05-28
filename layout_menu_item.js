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

const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;

/**
 * Class: LayoutMenuItem
 */
const LayoutMenuItem = class LayoutMenuItem extends PopupMenu.PopupBaseMenuItem
{
    /**
     * LayoutMenuItem: _init
     * Constructor
     */
    constructor(device, icon, menu_label_size)
    {
        super();
        this.device = device;
        this._icon = icon;
        this._device_title = new St.Label(
            { text: device
            , style_class : "ns-menuitem"
            }
        );
        this._down_label = new St.Label({ text: "", style_class : "ns-menuitem"});
        this._up_label = new St.Label({text: "", style_class: "ns-menuitem"});
        if (this._icon != null) {
           this.actor.add(this._icon);
        } else {
           this.actor.add(new St.Label());
        }
        this.actor.add(this._device_title);
        this.actor.add(this._down_label);
        this.actor.add(this._up_label);
        this.update_ui(menu_label_size);
    }

    /**
     * LayoutMenuItem: update_ui
     * update settings
     */
    update_ui(menu_label_size)
    {
        this._down_label.set_width(menu_label_size);
        this._up_label.set_width(menu_label_size);
        this._device_title.set_width(menu_label_size);
    }

    /**
     * LayoutMenuItem: update_speeds
     * update speeds
     */
    update_speeds(speed)
    {
        this._down_label.set_text(speed.down);
        this._up_label.set_text(speed.up);
    }
};
