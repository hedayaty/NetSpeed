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

const Lang = imports.lang;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;

const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Panel = imports.ui.main.panel;

const NMC = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;

const _ = Gettext.gettext;
const NetSpeedStatusIcon = Extension.imports.net_speed_status_icon;
/**
 * Class NetSpeed
 * The extension
 */
const NetSpeed = new Lang.Class(
{
    Name: 'NetSpeed',

    /**
     * NetSpeed: _init
     * Constructor
     */
    _init : function()
    {
        let localeDir = Extension.dir.get_child('locale');
        if (localeDir.query_exists(null))
            Gettext.bindtextdomain('netspeed', localeDir.get_path());
        this._updateDefaultGw();
    },

    /**
     * NetSpeed: _check_devices
     */
    _check_devices: function()
    {
        if (this._devices.length != this._olddevices.length)
            return 0;
        for (let i = 0; i < this._devices.length; ++i)
            if (this._devices[i] != this._olddevices[i])
                return 0;
        return 1;
    },


    /**
     * NetSpeed: get_device_type
     */
    get_device_type: function(device)
    {
        let devices = this._client.get_devices() || [ ];

        for each (let dev in devices) {
            if (dev.interface == device) {
                switch (dev.device_type) {
                case NetworkManager.DeviceType.ETHERNET:
                    return "ethernet";
                case NetworkManager.DeviceType.WIFI:
                    return "wifi";
                case NetworkManager.DeviceType.BT:
                    return "bt";
                case NetworkManager.DeviceType.OLPC_MESH:
                    return "olpcmesh";
                case NetworkManager.DeviceType.WIMAX:
                    return "wimax";
                case NetworkManager.DeviceType.MODEM:
                    return "modem";
                default:
                    return "none";
                }
            }
        }

        return "none";
    },

    /**
     * NetSpeed: _speed_to_string
     */
    _speed_to_string: function(amount, digits)
    {
        if (amount == 0)
            return { text: "0", unit: _("B/s") };
        if (digits < 3)
            digits = 3;
        amount *= 1000;
        let unit = 0;
        while (amount >= 1000 && unit < 3) { // 1M=1024K, 1MB/s=1000MB/s
            amount /= 1000;
            ++unit;
        }

        if (amount >= 100)
            digits -= 2;
        else if (amount >= 10)
            digits -= 1;
        let speed_map = [_("B/s"), _("KB/s"), _("MB/s"), _("GB/s")];
        return {
            text: amount.toFixed(digits - 1),
            unit: speed_map[unit]
        };
    },


    /**
     * NetSpeed: _set_labels
     */
    _set_labels: function(sum, up, down)
    {
        this._status_icon.set_labels(sum, up, down);
    },

    /**
     * NetSpeed: _update_speeds
     */
    _update_speeds: function()
    {
        this._status_icon.update_speeds(this._speeds);
    },

    /**
     * NetSpeed: _create_menu
     */
    _create_menu: function()
    {
        let types = new Array();
        for (let i = 0; i < this._devices.length; ++i)
            types.push(this.get_device_type(this._devices[i]));
        this._status_icon.create_menu(this._devices, types);
    },

    /**
     * NetSpeed: _updateDefaultGw
     */
    _updateDefaultGw : function()
    {
        let flines = GLib.file_get_contents('/proc/net/route'); // Read the file
        let nlines = ("" + flines[1]).split("\n"); // Break to lines
        for(let i = 0; i < nlines.length - 1 ; ++i) { //first 2 lines are for header
            let line = nlines[i].replace(/^ */g, "");
            let params = line.split("\t");
            if (params.length != 11) // ignore empty lines
                continue;
            // So store up/down values
            if (params[1] == "00000000") {
                this._defaultGw = params[0];
            }
        }
    },

    /**
     * NetSpeed: _update
     */
    _update : function()
    {
        this._updateDefaultGw();
        let flines = GLib.file_get_contents('/proc/net/dev'); // Read the file
        let nlines = ("" + flines[1]).split("\n"); // Break to lines

        let up = 0; // set initial
        let down = 0;
        this._oldvalues = this._values;
        this._values = new Array();
        this._speeds = new Array();
        this._olddevices = this._devices;
        this._devices = new Array();

        let time = GLib.get_monotonic_time() / 1000; // current time 1000 is not the net_speed.timer!
        let delta = time - this._last_time; // Here the difference is evaluated
        this._last_time = time;

        // parse the file
        for(let i = 2; i < nlines.length - 1 ; ++i) { //first 2 lines are for header
            let line = nlines[i].replace(/ +/g, " ").replace(/^ */g, "");
            let params = line.split(" ");
            if (params[0].replace(":","") == "lo") // ignore local device
                continue;
            // So store up/down values
            this._values.push([parseInt(params[9]), parseInt(params[1])]);
            this._devices.push(params[0].replace(":",""));
        }

        var total = 0;
        var total_speed = null;
        var up_speed = null;
        var down_speed = null;
        if (this._check_devices() == 1)	{
            for (let i = 0; i < this._values.length; ++i) {
                let _up = this._values[i][0] - this._oldvalues[i][0];
                let _down = this._values[i][1] - this._oldvalues[i][1];

                // Avoid negetive speed in case of device going down, when device goes down,
                if (_up < 0 )
                    _up = 0;
                if (_down < 0)
                    _down = 0;

                let _up_speed = this._speed_to_string(_up / delta, this.digits);
                let _down_speed = this._speed_to_string(_down / delta, this.digits);
                this._speeds.push({
                    up: _up_speed.text + _up_speed.unit,
                    down: _down_speed.text + _down_speed.unit
                });

                total += _down + _up;
                up += _up;
                down += _down;
                if (this.getDevice() == this._devices[i]) {
                    total_speed = this._speed_to_string((_up + _down) / delta, this.digits);
                    up_speed = this._speed_to_string(_up / delta, this.digits);
                    down_speed = this._speed_to_string(_down / delta, this.digits);
                }
            }
            if (total_speed == null) {
                total_speed = this._speed_to_string(total / delta, this.digits);
                up_speed = this._speed_to_string(up / delta, this.digits);
                down_speed = this._speed_to_string(down / delta, this.digits);
            }

            this._set_labels(total_speed, up_speed, down_speed);
            this._update_speeds();
        } else
            this._create_menu();
        return true;
    },


    /**
     * NetSpeed: _load
     */
    _load: function()
    {
        if (this._saving == 1) {
            return;
        }
        this.showsum = this._setting.get_boolean('show-sum');
        this.use_icon = this._setting.get_boolean('icon-display');
        this.digits = this._setting.get_int('digits');
        this._device = this._setting.get_string('device');
        this.timer = this._setting.get_int('timer');
        this.label_size = this._setting.get_int('label-size');
        this.unit_label_size = this._setting.get_int('unit-label-size');
        this.menu_label_size = this._setting.get_int('menu-label-size');
    },

    /**
     * NetSpeed: save
     */
    save: function()
    {
        this._saving = 1; // Disable Load
        this._setting.set_boolean('show-sum', this.showsum);
        this._setting.set_string('device', this._device);
        this._saving = 0; // Enable Load
    },

    /**
     * NetSpeed: _reload
     */
    _reload: function()
    {
        this._load();
        this._status_icon.updateui();
    },


    /**
     * NetSpeed: enable
     * exported to enable the extension
     */
    enable: function()
    {
        this._last_up = 0; // size of upload in previous snapshot
        this._last_down = 0; // size of download in previous snapshot
        this._last_time = 0; // time of the latest snapshot

        this._values = new Array();
        this._devices = new Array();
        this._client = NMC.Client.new();

        let schemaDir = Extension.dir.get_child('schemas').get_path();
        let schemaSource = Gio.SettingsSchemaSource.new_from_directory(
            schemaDir,
            Gio.SettingsSchemaSource.get_default(),
            false
        );
        let schema = schemaSource.lookup('org.gnome.shell.extensions.netspeed', false);
        this._setting = new Gio.Settings({ settings_schema: schema });
        this._saving = 0;
        this._load();

        this._status_icon = new NetSpeedStatusIcon.NetSpeedStatusIcon(this);
        this._changed = this._setting.connect('changed', Lang.bind(this, this._reload));
        this._timerid = Mainloop.timeout_add(this.timer, Lang.bind(this, this._update));
        Panel.addToStatusArea('netspeed', this._status_icon, 0);
    },

    /**
     * NetSpeed: disable
     * exported to disable the extension
     */
    disable: function()
    {
        if (this._timerid != 0) {
            Mainloop.source_remove(this._timerid);
            this._timerid = 0;
        }
        this._devices = null;
        this._values = null;
        this._olddevices = null;
        this._oldvalues = null;
        this._setting = null;
        this._client = null;
        this._status_icon.destroy();
    },

    getDevice: function()
    {
        if (this._device == "defaultGW") {
            return this._defaultGw;
        } else {
            return this._device;
        }
    },

    setDevice: function(device)
    {
        this._device = device;
    }
});
