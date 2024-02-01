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

import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';

import { NetSpeedLayoutMenuItem } from './net_speed_layout_menu_item.js';
import { Logger } from './lib.js';

/**
 * Class NetSpeedStatusIcon
 * status icon, texts for speeds, the drop-down menu
 */
export default GObject.registerClass(class NetSpeedStatusIcon extends PanelMenu.Button {
  /**
   * NetSpeedStatusIcon: _init
   * Constructor
   */
  constructor(extension, net_speed) {
    super(0.0);
    this._extension = extension;
    this._settings = extension.getSettings()
    this._net_speed = net_speed;

    // extension button
    this._box = new St.BoxLayout();
    this.add_actor(this._box);
    this.connect('button-release-event', this._toggle_showsum.bind(this));

    // download
    this._download_box = new St.BoxLayout();
    this._down = new St.Label({ text: "---", style_class: 'ns-horizontal-label', y_align: Clutter.ActorAlign.CENTER });
    this._downunit = new St.Label({ text: "", style_class: 'ns-horizontal-unit-label', y_align: Clutter.ActorAlign.CENTER });
    this._downicon = new St.Label({ text: "⬇", style_class: 'ns-horizontal-icon', y_align: Clutter.ActorAlign.CENTER });
    this._download_box.add_actor(this._down);
    this._download_box.add_actor(this._downunit);
    this._download_box.add_actor(this._downicon);

    // upload
    this._upload_box = new St.BoxLayout();
    this._up = new St.Label({ text: "---", style_class: 'ns-horizontal-label', y_align: Clutter.ActorAlign.CENTER });
    this._upunit = new St.Label({ text: "", style_class: 'ns-horizontal-unit-label', y_align: Clutter.ActorAlign.CENTER });
    this._upicon = new St.Label({ text: "⬆", style_class: 'ns-horizontal-icon', y_align: Clutter.ActorAlign.CENTER });
    this._upload_box.add_actor(this._up);
    this._upload_box.add_actor(this._upunit);
    this._upload_box.add_actor(this._upicon);

    // sum
    this._sum_box = new St.BoxLayout();
    this._sum = new St.Label({ text: "---", style_class: 'ns-horizontal-label', y_align: Clutter.ActorAlign.CENTER });
    this._sumunit = new St.Label({ text: "", style_class: 'ns-horizontal-unit-label', y_align: Clutter.ActorAlign.CENTER });
    this._sum_box.add_actor(this._sum);
    this._sum_box.add_actor(this._sumunit);

    // metrics box
    this._metrics_box = new St.BoxLayout({ y_align: Clutter.ActorAlign.CENTER });
    this._metrics_box.add_actor(this._download_box);
    this._metrics_box.add_actor(this._upload_box);
    this._metrics_box.add_actor(this._sum_box);
    this._box.add_actor(this._metrics_box);

    // interface icon
    this._icon_box = new St.BoxLayout();
    this._icon = this._getIcon(this._net_speed.get_device_type(this._net_speed.getDevice()));
    this._icon_box.add_actor(this._icon);
    this._box.add_actor(this._icon_box);

    // Add pref luncher
    this._pref = new St.Button({ child: this._getIcon("pref") });
    this._pref.connect("clicked", () => {
      Util.spawn(["gnome-extensions", "prefs", this._extension.metadata.uuid]);
    });

    this._menu_title = new NetSpeedLayoutMenuItem(_("Device"), this._pref, this._settings.get_int('menu-label-size'));
    this._menu_title.connect("activate", this._change_device.bind(this, ""));
    this._menu_title.update_speeds({ up: _("Up"), down: _("Down") });
    this._menu_title.update_ips([_("IP")]);
    this._menu_title.show_ip(this._settings.get_boolean('show-ips'));
    this.menu.addMenuItem(this._menu_title);
    this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
    this._layouts = [];
    this.updateui();

    this._connectSignals();


    // connect settings for position in panel
    this._placement_changed_id = this._settings.connect('changed::placement', this._positionInPanelChanged.bind(this));
    this._placement_index_changed_id = this._settings.connect('changed::placement-index', this._positionInPanelChanged.bind(this));
  }

  /**
   * NetSpeedStatusIcon :_change_device
   */
  _change_device(param1, param2, device) {
    this._settings.set_string('device', device);
    //this._net_speed.setDevice(device);
    this.updateui();
    //this._net_speed.save();
  }

  /**
   * NetSpeedStatusIcon: _toggle_showsum
   */
  _toggle_showsum(actor, event) {
    let button = event.get_button();
    if (button === 2) { // middle
      this._settings.set_boolean('show-sum', !this._settings.get_boolean('show-sum'));
      this.updateui();
    }
  }

  /**
   * NetSpeedStatusIcon: updateui
   * update ui according to settings
   */
  updateui() {
    // Set the size of labels
    this._sum.set_width(this._settings.get_int('label-size'));
    this._sumunit.set_width(this._settings.get_int('unit-label-size'));
    this._up.set_width(this._settings.get_int('label-size'));
    this._upunit.set_width(this._settings.get_int('unit-label-size'));
    this._down.set_width(this._settings.get_int('label-size'));
    this._downunit.set_width(this._settings.get_int('unit-label-size'));

    // Show up + down or sum
    if (this._settings.get_boolean('show-sum') === false) {
      this._sum.hide();
      this._sumunit.hide();
      this._upicon.show();
      this._up.show();
      this._upunit.show();
      this._downicon.show();
      this._down.show();
      this._downunit.show();
      this.set_vertical_alignment(this._settings.get_boolean('vert-align'));
    } else {
      this._sum.show();
      this._sumunit.show();
      this._upicon.hide();
      this._up.hide();
      this._upunit.hide();
      this._downicon.hide();
      this._down.hide();
      this._downunit.hide();
      // ignore vertical alignment with sum
      this.set_vertical_alignment(false);
    }

    // Change the type of Icon
    this._icon.destroy();
    const device = this._net_speed.getDevice();

    Logger.debug("Device -> " + device);

    this._icon = this._getIcon(this._net_speed.get_device_type(device));
    this._icon_box.add_actor(this._icon);
    // Show icon or not
    if (this._settings.get_boolean('icon-display'))
      this._icon.show();
    else
      this._icon.hide();
    // Update Menu sizes
    this._menu_title.update_ui(this._settings.get_int('menu-label-size'));

    const show_ips = this._settings.get_boolean('show-ips');
    this._menu_title.show_ip(show_ips);
    for (let layout of this._layouts) {
      layout.update_ui(this._settings.get_int('menu-label-size'));
      layout.show_ip(show_ips);
    }
  }

  _connectSignals() {
    this._net_speed.connect('reloaded', () => this.updateui());
    this._net_speed.connect('global-stats-changed', this._onGlobalStatsChanged.bind(this));
    this._net_speed.connect('speeds-changed', this._onSpeedsChanged.bind(this));
    this._net_speed.connect('ips-changed', this._onIPsChanged.bind(this));
    this._net_speed.connect('menu-changed', this._onCreateMenu.bind(this));
  }

  /**
   * NetSpeedStatusIcon: _getIcon
   * Utility function to create icon from name
   */
  _getIcon(name, size) {
    if (arguments.length === 1)
      size = 16;
    let iconname = "";
    switch (name) {
      case "none":
        iconname = "network-transmit-receive-symbolic";
        break;
      case "ethernet":
        iconname = "network-wired-symbolic";
        break;
      case "wifi":
        iconname = "network-wireless-signal-excellent-symbolic";
        break;
      case "bt":
        iconname = "bluetooth-active-symbolic";
        break;
      case "olpcmesh":
        iconname = "network-wired-symbolic";
        break;
      case "wimax":
        iconname = "network-wirelss-signal-excellent-symbolic"; // Same for wifi
        break;
      case "modem":
        iconname = "gnome-modem"; // Hope works!
        break;
      case "up":
        iconname = "go-up-symbolic";
        break;
      case "down":
        iconname = "go-down-symbolic";
        break;
      case "pref":
        iconname = "emblem-system-symbolic";
        break;
      default:
        iconname = "network-transmit-receive-symbolic";
    }

    return new St.Icon({
      icon_name: iconname,
      icon_size: size,
    });
  }

  /**
   * NetSpeedStatusIcon: _onGlobalStatsChanged(<sender>,NetSpeedGlobalStats)
   * @param {*} sender 
   * @param {Messages.NetSpeedGlobalStatsMessage} stats 
   */
  _onGlobalStatsChanged(sender, stats) {
    this._sum.set_text(stats.sum.text);
    this._sumunit.set_text(stats.sum.unit);

    this._up.set_text(stats.up.text);
    this._upunit.set_text(stats.up.unit);

    this._down.set_text(stats.down.text);
    this._downunit.set_text(stats.down.unit);
  }

  /**
   * NetSpeedStatusIcon: create_menu
   * @param {*} sender 
   * @param {Messages.NetSpeedMenuMessage} menu
   */
  _onCreateMenu(sender, menu) {
    for (let layout of this._layouts) {
      layout.destroy();
    }
    this._layouts = [];
    for (let i = 0; i < menu.devices_text.length; ++i) {
      let icon = this._getIcon(menu.types[i]);
      let layout = new NetSpeedLayoutMenuItem(menu.devices_text[i], icon, this._settings.get_int('menu-label-size'));
      layout.show_ip(this._settings.get_boolean('show-ips'));
      layout.connect("activate", this._change_device.bind(this, menu.devices_text[i]));
      this._layouts.push(layout);
      this.menu.addMenuItem(layout);
    }
  }

  /**
   * NetSpeedStatusIcon: _onSpeedsChanged
   * 
   * @param {*} sender 
   * @param {Messages.NetSpeedSpeedsMessage} speeds 
   */
  _onSpeedsChanged(sender, speeds) {
    for (let i = 0; i < speeds.speeds.length; ++i) {
      this._layouts[i].update_speeds(speeds.speeds[i]);
    }

    // fix #131 by forcing a delayed redraw
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => {
      this.queue_redraw();
      return GLib.SOURCE_REMOVE;
    });
  }

  /**
   * NetSpeedStatusIcon: set_vertical_alignment
   */
  set_vertical_alignment(tof) {
    this._metrics_box.set_vertical(tof);
    let align = tof ? 'vertical' : 'horizontal';
    this._down.set_style_class_name('ns-' + align + '-label');
    this._downunit.set_style_class_name('ns-' + align + '-unit-label');
    this._downicon.set_style_class_name('ns-' + align + '-icon');
    this._up.set_style_class_name('ns-' + align + '-label');
    this._upunit.set_style_class_name('ns-' + align + '-unit-label');
    this._upicon.set_style_class_name('ns-' + align + '-icon');
  }

  /**
   * NetSpeedStatusIcon: _onIPsChanged
   * @param {*} sender 
   * @param {Messages.NetSpeedIPsMessage} ips 
   */
  _onIPsChanged(sender, ips) {
    for (let i = 0; i < ips.ips.length; ++i) {
      this._layouts[i].update_ips(ips.ips[i]);
    }
  }

  _positionInPanelChanged() {
    this.container.get_parent().remove_actor(this.container);

    // small HACK with private boxes :)
    let boxes = {
      left: Main.panel._leftBox,
      center: Main.panel._centerBox,
      right: Main.panel._rightBox
    };

    let p = this._settings.get_string('placement');
    let i = this._settings.get_int('placement-index');

    Logger.debug(`_positionInPanelChanged: ${p} at index ${i}`);

    boxes[p].insert_child_at_index(this.container, i);
  }

});
