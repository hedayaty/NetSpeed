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

const St = imports.gi.St;
const Mainloop = imports.mainloop;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const Gio = imports.gi.Gio;
const Shell = imports.gi.Shell;
const Main = imports.ui.main;
const Panel = Main.panel
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const NMC = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Util = imports.misc.util;
const Gettext = imports.gettext;
const _ = Gettext.gettext;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const NetSpeed = Extension.imports.net_speed.NetSpeed;

/**
 * init
 * run when gnome-shell loads
 */
function init() {
    return new NetSpeed();
}


// vim: ts=2 sw=2
