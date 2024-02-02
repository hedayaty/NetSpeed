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
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import NM from 'gi://NM';

import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import { Logger } from './lib.js';

const NetSpeedPreferences = new GObject.registerClass(class NetSpeedPreferences extends Gtk.Grid {
    _get_dev_combo() {
        let listStore = new Gtk.ListStore();
        listStore.set_column_types([GObject.TYPE_STRING, GObject.TYPE_STRING]);

        let all = listStore.append();
        listStore.set(all, [0], [_("ALL")]);
        listStore.set(all, [1], ["network-workgroup-symbolic"]);

        let defaultGw = listStore.append();
        listStore.set(defaultGw, [0], [_("Default Gateway")]);
        listStore.set(defaultGw, [1], ["network-workgroup-symbolic"]);

        let nmc = NM.Client.new(null);
        let devices = nmc.get_devices() || [];
        this._devices = [];

        for (let dev of devices) {
            let iconname;
            switch (dev.device_type) {
                case NM.DeviceType.ETHERNET:
                    iconname = "network-wired-symbolic";
                    break;
                case NM.DeviceType.WIFI:
                    iconname = "network-wireless-signal-excellent-symbolic";
                    break;
                case NM.DeviceType.BT:
                    iconname = "bluetooth-active-symbolic";
                    break;
                case NM.DeviceType.OLPC_MESH:
                    iconname = "network-wired-symbolic";
                    break;
                case NM.DeviceType.WIMAX:
                    iconname = "network-wirelss-signal-excellent-symbolic"; // Same for wifi
                    break;
                case NM.DeviceType.MODEM:
                    iconname = "network-transmit-receive-symbolic";
                    break;
                default:
                    continue;
            }
            this._devices.push(dev.interface);
            let iter = listStore.append();
            listStore.set(iter, [0], [dev.interface]);
            listStore.set(iter, [1], [iconname]);
        }

        let combo = new Gtk.ComboBox({ model: listStore });
        let rendererPixbuf = new Gtk.CellRendererPixbuf();
        let rendererText = new Gtk.CellRendererText();

        // Pack the renderers into the combobox in the order we want to see
        combo.pack_start(rendererPixbuf, false);
        combo.pack_start(rendererText, false);

        // Set the renderers to use the information from our listStore
        combo.add_attribute(rendererText, "text", 0);
        combo.add_attribute(rendererPixbuf, "icon_name", 1);
        return combo;
    }

    _pick_changement() {
        let active = -1;
        switch (this._settings.get_string('placement')) {
            case 'right':
                active = 0;
                break;
            case 'center':
                active = 1;
                break;
            case 'left':
                active = 2;
                break;
        }
        this.placement.set_active(active);
    }

    _change_placement() {
        let active = this.placement.get_active();
        Logger.debug("_change_placement: active=" + active);

        if (active === -1) {
            return;
        }
        switch (active) {
            case 0:
                this._settings.set_string('placement', 'right');
                Logger.debug("placement <- right");
                break;
            case 1:
                this._settings.set_string('placement', 'center');
                Logger.debug("placement <- center");
                break;
            case 2:
                this._settings.set_string('placement', 'left');
                Logger.debug("placement <- left");
                break;
        }
    }

    _dpi_changed() {
        let factor = this._settings.get_int('hi-dpi-factor');
        if (factor !== this._factor) {
            this._change_factor();
        }
    }

    _put_dev() {
        let active = this.dev.get_active();
        if (active === -1) {
            return;
        }
        switch (active) {
            case 0:
                this._settings.set_string('device', "all");
                break;
            case 1:
                this._settings.set_string('device', "defaultGW");
                break;
            default:
                this._settings.set_string('device', this._devices[active - 2]);
        }

        Logger.debug("device <- " + this._settings.get_string('device'));
    }

    _pick_dev() {
        let activeDev = this._settings.get_string('device');
        this._device = activeDev;
        let active = 0;
        if (activeDev === "all") {
            active = 0;
        } else if (activeDev === "defaultGW") {
            active = 1;
        } else {
            for (let i = 0; i < this._devices.length; ++i) {
                if (this._devices[i] === activeDev) {
                    active = i + 2;
                }
            }
        }
        this.dev.set_active(active);
    }

    _change_factor() {
        let old_factor = this._factor;
        let factor = this._settings.get_int('hi-dpi-factor');
        this._factor = factor;

        this._label_adjustment.upper = 100 * factor;
        this._label_adjustment.step_increment = factor;
        this._settings.set_int('label-size', this._settings.get_int('label-size') * factor / old_factor);

        this._unit_label_adjustment.upper = 100 * factor;
        this._unit_label_adjustment.step_increment = factor;
        this._settings.set_int('unit-label-size', this._settings.get_int('unit-label-size') * factor / old_factor);

        this._menu_label_adjustment.upper = 100 * factor;
        this._menu_label_adjustment.step_increment = factor;
        this._settings.set_int('menu-label-size', this._settings.get_int('menu-label-size') * factor / old_factor);
    }

    constructor(extension) {
        super({ row_spacing: 10, column_spacing: 20, column_homogeneous: false, row_homogeneous: true });

        this._settings = extension.getSettings();

        this._factor = this._settings.get_int('hi-dpi-factor');

        // Header: device selection
        this.attach(new Gtk.Label({ label: _("Device to monitor") }), 2, 1, 1, 1);
        this.dev = this._get_dev_combo();
        this.attach(this.dev, 3, 1, 1, 1);

        // Separator
        let separator = new Gtk.Separator({ orientation: Gtk.Orientation.HORIZONTAL, valign: Gtk.Align.CENTER });
        separator.set_vexpand(false);
        this.attach(separator, 1, 2, 4, 1);

        // Title
        this.attach(new Gtk.Label({ label: `<b>${_("Settings")}</b>`, use_markup: true }), 2, 3, 2, 1);

        // Display options

        this.attach(new Gtk.Label({ label: _("Timer (milliseconds)") }), 1, 4, 1, 1);
        this.timer = Gtk.SpinButton.new_with_range(100, 10000, 100);
        this.attach(this.timer, 2, 4, 1, 1);

        this.attach(new Gtk.Label({ label: _("Digits") }), 1, 5, 1, 1);
        this.digits = Gtk.SpinButton.new_with_range(3, 10, 1);
        this.attach(this.digits, 2, 5, 1, 1);

        this.attach(new Gtk.Label({ label: _("Label Size") }), 1, 6, 1, 1);
        this.label_size = Gtk.SpinButton.new_with_range(1, 100 * this._factor, this._factor);
        this.attach(this.label_size, 2, 6, 1, 1);

        this.attach(new Gtk.Label({ label: _("Unit Label Size") }), 1, 7, 1, 1);
        this.unit_label_size = Gtk.SpinButton.new_with_range(1, 100 * this._factor, this._factor);
        this.attach(this.unit_label_size, 2, 7, 1, 1);

        this.attach(new Gtk.Label({ label: _("Menu Label Size") }), 1, 8, 1, 1);
        this.menu_label_size = Gtk.SpinButton.new_with_range(1, 100 * this._factor, this._factor);
        this.attach(this.menu_label_size, 2, 8, 1, 1);

        this.attach(new Gtk.Label({ label: _("HiDPI factor") }), 1, 9, 1, 1);
        this.hi_dpi_factor = Gtk.SpinButton.new_with_range(1, 100, 1);
        this.attach(this.hi_dpi_factor, 2, 9, 1, 1);

        this.attach(new Gtk.Label({ label: _("Placement") }), 1, 10, 1, 1);
        this.placement = new Gtk.ComboBoxText();
        this.placement.append_text(_("Right"));
        this.placement.append_text(_("Center"));
        this.placement.append_text(_("Left"));
        this.placement.set_active(0);
        this.attach(this.placement, 2, 10, 1, 1);

        this.attach(new Gtk.Label({ label: _("Placement Index") }), 1, 11, 1, 1);
        this.placement_index = Gtk.SpinButton.new_with_range(-1, 20, 1);
        this.attach(this.placement_index, 2, 11, 1, 1);


        // Extension Settings

        this.attach(new Gtk.Label({ label: _("Show sum(UP+Down)") }), 3, 4, 1, 1);
        this.sum = new Gtk.Switch({ halign: Gtk.Align.START, valign: Gtk.Align.CENTER });
        this.attach(this.sum, 4, 4, 1, 1);

        this.attach(new Gtk.Label({ label: _("Show the Icon") }), 3, 5, 1, 1);
        this.icon = new Gtk.Switch({ halign: Gtk.Align.START, valign: Gtk.Align.CENTER });
        this.attach(this.icon, 4, 5, 1, 1);

        this.attach(new Gtk.Label({ label: _("Use multiples of byte") }), 3, 6, 1, 1);
        this.use_bytes = new Gtk.Switch({ halign: Gtk.Align.START, valign: Gtk.Align.CENTER });
        this.attach(this.use_bytes, 4, 6, 1, 1);

        this.attach(new Gtk.Label({ label: _("Use binary prefixes") }), 3, 7, 1, 1);
        this.bin_prefixes = new Gtk.Switch({ halign: Gtk.Align.START, valign: Gtk.Align.CENTER });
        this.attach(this.bin_prefixes, 4, 7, 1, 1);

        this.attach(new Gtk.Label({ label: _("Align vertically") }), 3, 8, 1, 1);
        this.vert_align = new Gtk.Switch({ halign: Gtk.Align.START, valign: Gtk.Align.CENTER });
        this.attach(this.vert_align, 4, 8, 1, 1);

        this.show_ip = new Gtk.Switch({ halign: Gtk.Align.START, valign: Gtk.Align.CENTER });
        this.attach(new Gtk.Label({ label: _("Show IPs") }), 3, 9, 1, 1);
        this.attach(this.show_ip, 4, 9, 1, 1);
        this.show_ip.show();


        // Initialize values
        this._pick_dev();
        this.dev.connect('changed', this._put_dev.bind(this));

        this._settings.bind('show-sum', this.sum, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('icon-display', this.icon, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('timer', this.timer, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('digits', this.digits, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('label-size', this.label_size, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('unit-label-size', this.unit_label_size, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('menu-label-size', this.menu_label_size, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('use-bytes', this.use_bytes, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('bin-prefixes', this.bin_prefixes, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('vert-align', this.vert_align, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('hi-dpi-factor', this.hi_dpi_factor, 'value', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind('show-ips', this.show_ip, 'active', Gio.SettingsBindFlags.DEFAULT);
        this._settings.bind_writable('show-ips', this.show_ip, 'visible', false);

        this._settings.connect('changed', this._dpi_changed.bind(this));
        this._dpi_changed();

        this._pick_changement();
        this.placement.connect('changed', this._change_placement.bind(this));

        this._settings.bind('placement-index', this.placement_index, 'value', Gio.SettingsBindFlags.DEFAULT);

    }
});


export default class extends ExtensionPreferences {
    getPreferencesWidget() {
        return new NetSpeedPreferences(this);
    }
}
