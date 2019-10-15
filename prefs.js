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


const Extension = imports.misc.extensionUtils.getCurrentExtension();
const GLib = imports.gi.GLib;
const GObject = imports.gi.GObject;
const Gdk = imports.gi.Gdk;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;
const NM = imports.gi.NM;
const _ = Gettext.domain('netspeed').gettext;

let schemaDir = Extension.dir.get_child('schemas');
let schemaSource = schemaDir.query_exists(null)?
                    Gio.SettingsSchemaSource.new_from_directory(schemaDir.get_path(), Gio.SettingsSchemaSource.get_default(), false):
                    Gio.SettingsSchemaSource.get_default();
let schema = schemaSource.lookup('org.gnome.shell.extensions.netspeed', false);
let Schema = new Gio.Settings({ settings_schema: schema });


function init()
{
    let localeDir = Extension.dir.get_child('locale');
    if (localeDir.query_exists(null)) {
        Gettext.bindtextdomain('netspeed', localeDir.get_path());
	}
}

const App = class NetSpeed_App {
    _get_dev_combo() {
        let listStore = new Gtk.ListStore();
        listStore.set_column_types ([GObject.TYPE_STRING, GObject.TYPE_STRING]);

        let all = listStore.append();
        listStore.set (all, [0], [_("ALL")]);
        listStore.set (all, [1], ["gtk-network"]);

        let defaultGw = listStore.append();
        listStore.set (defaultGw, [0], [_("Default Gateway")]);
        listStore.set (defaultGw, [1], ["gtk-network"]);

        let nmc = NM.Client.new(null);
        let devices = nmc.get_devices() || [ ];
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
                    iconname = "gnome-transmit-symbolic";
                    break;
                default:
                    continue;
            }
            this._devices.push(dev.interface);
            let iter = listStore.append();
            listStore.set (iter, [0], [dev.interface]);
            listStore.set (iter, [1], [iconname]);
        }

        let combo = new Gtk.ComboBox({model: listStore});
        let rendererPixbuf = new Gtk.CellRendererPixbuf();
        let rendererText = new Gtk.CellRendererText();

        // Pack the renderers into the combobox in the order we want to see
        combo.pack_start (rendererPixbuf, false);
        combo.pack_start (rendererText, false);

        // Set the renderers to use the information from our listStore
        combo.add_attribute (rendererText, "text", 0);
        combo.add_attribute (rendererPixbuf, "icon_name", 1);
        return combo;
    }

    _put_dev() {
        let active = this.dev.get_active();
        if (active == -1)
            return;
        switch (active) {
        case 0:
            Schema.set_string ('device', "all");
            break;
        case 1:
            Schema.set_string ('device', "defaultGW");
            break;
        default:
            Schema.set_string ('device', this._devices[active - 2]);
        }
        log("device <- " + Schema.get_string('device'))
    }

    _changed() {
        let factor = Schema.get_int('hi-dpi-factor');
        if (factor != this._factor) {
            this._change_factor();
        }


    }

    _pick_dev() {
        let activeDev = Schema.get_string('device');
        this._device = activeDev;
        let active = 0;
        if (activeDev == "all") {
            active = 0;
        } else if (activeDev == "defaultGw") {
            active = 1;
        } else {
            for (let i = 0; i < this._devices.length; ++i) {
                if (this._devices[i] == activeDev) {
                    active = i + 2;
                }
            }
        }
        this.dev.set_active(active);
    }

    _change_factor() {
        let old_factor = this._factor;
        let factor = Schema.get_int('hi-dpi-factor');
        this._factor = factor;

        this._label_adjustment.upper = 100 * factor;
        this._label_adjustment.step_increment = factor;
        Schema.set_int('label-size', Schema.get_int('label-size') * factor / old_factor);

        this._unit_label_adjustment.upper = 100 * factor;
        this._unit_label_adjustment.step_increment = factor;
        Schema.set_int('unit-label-size', Schema.get_int('unit-label-size') * factor / old_factor);

        this._menu_label_adjustment.upper = 100 * factor;
        this._menu_label_adjustment.step_increment = factor;
        Schema.set_int('menu-label-size', Schema.get_int('menu-label-size') * factor / old_factor);
    }

    constructor()
    {
        this._factor = Schema.get_int('hi-dpi-factor');
        this.main = new Gtk.Grid({row_spacing: 10, column_spacing: 20, column_homogeneous: false, row_homogeneous: true});
        this.main.attach (new Gtk.Label({label: _("Device to monitor")}), 1, 1, 1, 1);
        this.main.attach (new Gtk.Label({label: _("Timer (milisec)")}), 1, 4, 1, 1);
        this.main.attach (new Gtk.Label({label: _("Digits")}), 1, 5, 1, 1);
        this.main.attach (new Gtk.Label({label: _("Label Size")}), 1, 6, 1, 1);
        this.main.attach (new Gtk.Label({label: _("Unit Label Size")}), 1, 7, 1, 1);
        this.main.attach (new Gtk.Label({label: _("Menu Label Size")}), 1, 8, 1, 1);
        this.main.attach (new Gtk.Label({label: _("HiDPI factor")}), 1, 11, 1, 1);

        //	this.dev = new Gtk.Entry();
        this.dev = this._get_dev_combo();
        this.sum = new Gtk.CheckButton({ label: _("Show sum(UP+Down)") });
        this.icon = new Gtk.CheckButton({ label: _("Show the Icon") });
        this.timer = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 100,
                upper: 10000,
                step_increment: 100
            })
        });
        this.digits = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 3,
                upper: 10,
                step_increment: 1
            })
        });

        this._label_adjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 100 * this._factor,
            step_increment: this._factor
        });
        this.label_size = new Gtk.SpinButton({
            adjustment: this._label_adjustment
        });

        this._unit_label_adjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 100 * this._factor,
            step_increment: this._factor
        });
        this.unit_label_size = new Gtk.SpinButton({
            adjustment: this._unit_label_adjustment
        });

        this._menu_label_adjustment = new Gtk.Adjustment({
            lower: 1,
            upper: 100 * this._factor,
            step_increment: this._factor
        });
        this.menu_label_size = new Gtk.SpinButton({
            adjustment: this._menu_label_adjustment
        });

        this.use_bytes = new Gtk.CheckButton({ label: _("Use multiples of byte") });
        this.bin_prefixes = new Gtk.CheckButton({ label: _("Use binary prefixes") });
        this.hi_dpi_factor = new Gtk.SpinButton({
            adjustment: new Gtk.Adjustment({
                lower: 1,
                upper: 100,
                step_increment: 1
            })
        });
        this.main.attach(this.dev, 2, 1, 1, 1);
        this.main.attach(this.sum, 1, 2, 2, 1);
        this.main.attach(this.icon, 1, 3, 2, 1);
        this.main.attach(this.timer, 2, 4, 1, 1);
        this.main.attach(this.digits, 2, 5, 1, 1);
        this.main.attach(this.label_size, 2, 6, 1, 1);
        this.main.attach(this.unit_label_size, 2, 7, 1, 1);
        this.main.attach(this.menu_label_size, 2, 8, 1, 1);
        this.main.attach(this.use_bytes, 1, 9, 1, 1);
        this.main.attach(this.bin_prefixes, 1, 10, 1, 1);
        this.main.attach(this.hi_dpi_factor, 2, 11, 2, 1);

        Schema.bind('show-sum', this.sum, 'active', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('icon-display', this.icon, 'active', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('timer', this.timer, 'value', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('digits', this.digits, 'value', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('label-size', this.label_size, 'value', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('unit-label-size', this.unit_label_size, 'value', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('menu-label-size', this.menu_label_size, 'value', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('use-bytes', this.use_bytes, 'active', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('bin-prefixes', this.bin_prefixes, 'active', Gio.SettingsBindFlags.DEFAULT);
        Schema.bind('hi-dpi-factor', this.hi_dpi_factor, 'value', Gio.SettingsBindFlags.DEFAULT);

        this._pick_dev();
        this._factor = Schema.get_int('hi-dpi-factor');

        this.dev.connect('changed', Lang.bind(this, this._put_dev));

        Schema.connect('changed', Lang.bind(this, this._changed));

        this.main.show_all();
    }
};

function buildPrefsWidget()
{
    let widget = new App();
    return widget.main;
};
