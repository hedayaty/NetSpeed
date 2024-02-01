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
import GLib from 'gi://GLib';
import NM from 'gi://NM';

import { gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';

import { Logger } from './lib.js';
import * as Messages from './messages.js';

/**
 * Class NetSpeed
 */
export const NetSpeed = GObject.registerClass({
    Signals: {
        'reloaded': {},
        'global-stats-changed': {
            param_types: [
                Messages.NetSpeedGlobalStatsMessage.$gtype,
            ],
        },
        'speeds-changed': {
            param_types: [
                Messages.NetSpeedSpeedsMessage.$gtype,
            ],
        },
        'ips-changed': {
            param_types: [
                Messages.NetSpeedIPsMessage.$gtype,
            ],
        },
        'menu-changed': {
            param_types: [
                Messages.NetSpeedMenuMessage.$gtype,
            ],
        }
    },
}, class NetSpeed extends GObject.Object {
    /**
     * NetSpeed: _init
     * Constructor
     */

    constructor(extension) {
        super();
        this._settings = extension.getSettings();

        this._last_up = 0; // size of upload in previous snapshot
        this._last_down = 0; // size of download in previous snapshot
        this._last_time = 0; // time of the latest snapshot
        this._device_state_changed = true; // flag to trigger menu refreshing

        this._values = [];
        this._devices = [];
        this._nm_client = NM.Client.new(null);
        this._nm_signals = [];
        this._nm_signals.push(this._nm_client.connect('any-device-added', this._nm_device_changed.bind(this)));
        this._nm_signals.push(this._nm_client.connect('any-device-removed', this._nm_device_changed.bind(this)));
        this._nm_signals.push(this._nm_client.connect('connection-added', this._nm_connection_changed.bind(this)));
        this._nm_signals.push(this._nm_client.connect('connection-removed', this._nm_connection_changed.bind(this)));
        this._nm_signals.push(this._nm_client.connect('active-connection-added', this._nm_connection_changed.bind(this)));
        this._nm_signals.push(this._nm_client.connect('active-connection-removed', this._nm_connection_changed.bind(this)));

        // store NM Device 'state-changed' signal bindings to disconnect on disable
        this._nm_devices_signals_map = new Map();


        this._saving = 0;
        this.show_ips = this._settings.get_boolean('show-ips');

        this._load();

        this._updateDefaultGw();
    }


    /**
     * NetSpeed: _is_up2date
     */
    _is_up2date() {
        if (this._devices.length !== this._olddevices.length) {
            return 0;
        }
        for (let i = 0; i < this._devices.length; ++i) {
            if (this._devices[i] !== this._olddevices[i])
                return 0;
        }
        return 1;
    }

    /**
     * NetSpeed: get_device_type
     */
    get_device_type(device) {
        let devices = this._nm_client.get_devices() || [];

        for (let dev of devices) {
            if (dev.interface === device) {
                switch (dev.device_type) {
                    case NM.DeviceType.ETHERNET:
                        return "ethernet";
                    case NM.DeviceType.WIFI:
                        return "wifi";
                    case NM.DeviceType.BT:
                        return "bt";
                    case NM.DeviceType.OLPC_MESH:
                        return "olpcmesh";
                    case NM.DeviceType.WIMAX:
                        return "wimax";
                    case NM.DeviceType.MODEM:
                        return "modem";
                    default:
                        return "none";
                }
            }
        }

        return "none";
    }

    /**
     * NetSpeed: _speed_to_string
     */
    _speed_to_string(amount) {
        let m_digits = this.digits;
        let divider, byte_speed_map, bit_speed_map;
        if (this.bin_prefixes) {
            divider = 1024; // 1MiB = 1024kiB
            byte_speed_map = [_("B/s"), _("kiB/s"), _("MiB/s"), _("GiB/s")];
            bit_speed_map = [_("b/s"), _("kib/s"), _("Mib/s"), _("Gib/s")];
        } else {
            divider = 1000; // 1MB = 1000kB
            byte_speed_map = [_("B/s"), _("kB/s"), _("MB/s"), _("GB/s")];
            bit_speed_map = [_("b/s"), _("kb/s"), _("Mb/s"), _("Gb/s")];
        }
        if (amount === 0)
            return { text: "0", unit: _(this.use_bytes ? "B/s" : "b/s") };
        if (m_digits < 3)
            m_digits = 3;
        amount *= 1000 * (this.use_bytes ? 1 : 8);
        let unit = 0;
        while (amount >= divider && unit < 3) { // 1M=1024K, 1MB/s=1000MB/s
            amount /= divider;
            ++unit;
        }

        if (amount >= 100)
            m_digits -= 2;
        else if (amount >= 10)
            m_digits -= 1;

        return {
            text: amount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: m_digits - 1 }),
            unit: (this.use_bytes ? byte_speed_map : bit_speed_map)[unit]
        };
    }

    /**
     * NetSpeed: _emit_stats
     */
    _sendStats(sum, up, down) {
        this.emit(
            'global-stats-changed',
            new Messages.NetSpeedGlobalStatsMessage(
                {
                    sum: sum, up: up, down: down
                })
        );
    }

    /**
     * NetSpeed: _update_speeds
     */
    _sendSpeeds() {
        this.emit(
            'speeds-changed',
            new Messages.NetSpeedSpeedsMessage({ speeds: this._speeds })
        );
    }

    /**
     * NetSpeed: _update_ips
     */
    _sendIps() {
        this.emit(
            'ips-changed',
            new Messages.NetSpeedIPsMessage({ ips: this._ips })
        );
    }

    /**
     * NetSpeed: _create_menu
     */
    _create_menu() {
        let types = [];
        let devices_text = [];
        for (let dev of this._devices) {
            types.push(this.get_device_type(dev));
            let wifi_ssid = this._retrieve_wifi_ssid(dev);
            //Logger.info(`wifi_ssid is '${wifi_ssid}' for dev '${dev}'`);
            if (wifi_ssid !== null) {
                devices_text.push(dev + `\n${wifi_ssid}`);
                continue;
            }
            devices_text.push(dev);
        }

        this.emit(
            'menu-changed',
            new Messages.NetSpeedMenuMessage(
                {
                    devices_text: devices_text,
                    types: types,
                })
        );
    }

    /**
     * NetSpeed: _updateDefaultGw
     */
    _updateDefaultGw() {
        let flines = GLib.file_get_contents('/proc/net/route'); // Read the file
        let nlines = new TextDecoder().decode(flines[1]).split("\n"); // Break to lines
        for (let nline of nlines) { //first 2 lines are for header
            let line = nline.replace(/^ */g, "");
            let params = line.split("\t");
            if (params.length !== 11) // ignore empty lines
                continue;
            // So store up/down values
            if (params[1] === "00000000") {
                this._defaultGw = params[0];
            }
        }
    }

    /**
     * NetSpeed: _update
     */
    _update() {
        this._updateDefaultGw();
        let flines = GLib.file_get_contents('/proc/net/dev'); // Read the file
        let nlines = new TextDecoder().decode(flines[1]).split("\n"); // Break to lines

        let up = 0; // set initial
        let down = 0;
        this._oldvalues = this._values;
        this._values = [];
        this._speeds = [];
        this._ips = [];
        this._olddevices = this._devices;
        this._devices = [];

        let time = GLib.get_monotonic_time() / 1000; // current time 1000 is not the net_speed.timer!
        let delta = time - this._last_time; // Here the difference is evaluated
        this._last_time = time;

        // parse the file
        for (let i = 2; i < nlines.length - 1; ++i) { //first 2 lines are for header
            let line = nlines[i].replace(/ +/g, " ").replace(/^ */g, "");
            let params = line.split(" ");
            if (params[0].replace(":", "") === "lo") // ignore local device
                continue;
            // So store up/down values
            this._values.push([parseInt(params[9]), parseInt(params[1])]);
            this._devices.push(params[0].replace(":", ""));
        }

        //Logger.debug("Devices: " + this._devices);

        let total = 0;
        let total_speed = null;
        let up_speed = null;
        let down_speed = null;

        if (this._is_up2date() === 1 && !this._device_state_changed) {
            for (let i = 0; i < this._values.length; ++i) {
                let _up = this._values[i][0] - this._oldvalues[i][0];
                let _down = this._values[i][1] - this._oldvalues[i][1];

                // Avoid negetive speed in case of device going down, when device goes down,
                if (_up < 0)
                    _up = 0;
                if (_down < 0)
                    _down = 0;

                let _up_speed = this._speed_to_string(_up / delta);
                let _down_speed = this._speed_to_string(_down / delta);
                this._speeds.push({
                    up: _up_speed.text + " " + _up_speed.unit,
                    down: _down_speed.text + " " + _down_speed.unit
                });

                total += _down + _up;
                up += _up;
                down += _down;
                if (this.getDevice() === this._devices[i]) {
                    total_speed = this._speed_to_string((_up + _down) / delta);
                    up_speed = this._speed_to_string(_up / delta);
                    down_speed = this._speed_to_string(_down / delta);
                }
            }
            if (total_speed === null) {
                total_speed = this._speed_to_string(total / delta);
                up_speed = this._speed_to_string(up / delta);
                down_speed = this._speed_to_string(down / delta);
            }

            this._sendStats(total_speed, up_speed, down_speed);
            this._sendSpeeds();
        } else {
            this._create_menu();
        }

        if (this._device_state_changed && this.show_ips) {
            this._retrieve_ips();
            this._sendIps();
            Logger.debug("Retrieved ips");
        }

        // reset state
        this._device_state_changed = false;

        // keep alive timer
        return true;
    }

    /**
     * NetSpeed: _load
     */
    _load() {
        if (this._saving === 1) {
            return;
        }
        this.digits = this._settings.get_int('digits');
        this._device = this._settings.get_string('device');
        this.timer = this._settings.get_int('timer');
        this.use_bytes = this._settings.get_boolean('use-bytes');
        this.bin_prefixes = this._settings.get_boolean('bin-prefixes');

        let show_ips = this._settings.get_boolean('show-ips');
        if (show_ips !== this.show_ips && show_ips) {
            // trigger ip reload
            this._trigger_ips_reload();
        }
        this.show_ips = show_ips;
    }

    /**
     * NetSpeed: save
     */
    save() {
        this._saving = 1; // Disable Load
        //this._settings.set_boolean('show-sum', this.showsum);
        //this._settings.set_string('device', this._device);
        this._settings.set_boolean('show-ips', this.show_ips);
        this._saving = 0; // Enable Load
    }

    /**
     * NetSpeed: _reload
     */
    _reload() {
        if (this._settings !== null) {
            let m_timer = this._settings.get_int('timer');
            if (m_timer !== this.timer) {
                GLib.source_remove(this._timerid);
                this._timerid = GLib.timeout_add(m_timer, this._update.bind(this));
                // this.timer will be updated within this._load, so no need to update it here
            }
            this._load();
            //this._status_icon.updateui();
            this.emit('reloaded');
        }
    }

    /**
   * NetSpeed: start
   */
    start() {
        this._changed = this._settings.connect('changed', this._reload.bind(this));
        this._timerid = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.timer, this._update.bind(this));
    }

    /**
     * NetSpeed: stop
     */
    stop() {
        if (this._timerid && this._timerid !== 0) {
            GLib.source_remove(this._timerid);
            this._timerid = 0;
        }
        this._devices = null;
        this._values = null;
        this._olddevices = null;
        this._oldvalues = null;
        this._settings = null;

        this._nm_signals.forEach(sig_id => {
            this._nm_client.disconnect(sig_id);
        });

        this._disconnect_all_nm_device_state_changed();
        this._nm_client = null;
        //this._status_icon.destroy();
        //this._status_icon = null;
    }

    getDevice() {
        if (this._device === "defaultGW") {
            return this._defaultGw;
        } else {
            return this._device;
        }
    }

    /*
    setDevice(device) {
      this._device = device;
    }
    */

    /**
     * NetSpeed: _nm_device_changed
     */
    _nm_device_changed(_client, _device) {
        this._trigger_ips_reload();
    }

    /**
     * NetSpeed: _nm_connection_changed
     */
    _nm_connection_changed(_client, _connection) {
        this._trigger_ips_reload();
    }

    /**
     * NetSpeed: _trigger_ips_reload
     */
    _trigger_ips_reload() {
        this._device_state_changed = true;
    }

    /**
     * NetSpeed: _retrieve_ips
     * get ips v4
     */
    _retrieve_ips() {
        // remove previous connects
        this._disconnect_all_nm_device_state_changed();

        for (let dev of this._devices) {
            let nm_dev = this._nm_client.get_device_by_iface(dev);
            let addresses = this._getAddresses(nm_dev, GLib.SYSDEF_AF_INET);
            this._ips.push(addresses);
            this._connect_nm_device_state_changed(nm_dev);
        }
    }

    /**
     * NetSpeed: _retrieve_wifi_ssid
     * Retrieve access point name (SSID) for wifi device interface
     */
    _retrieve_wifi_ssid(iface) {
        let nm_dev = this._nm_client.get_device_by_iface(iface);
        if (nm_dev.get_device_type() === NM.DeviceType.WIFI) {
            let active_ap = nm_dev.get_active_access_point();
            if (active_ap !== null) {
                return new TextDecoder().decode(active_ap.get_ssid().toArray(), 'UTF-8');
            }
        }
        return null;
    }

    /**
     * NetSpeed: _connect_nm_device_state_changed
     * @param {NM.Device} nm_device: NM Device instance
     */
    _connect_nm_device_state_changed(nm_device) {
        if (!this._nm_devices_signals_map.has(nm_device.get_iface())) {
            let signal_id = nm_device.connect('state-changed', this._nm_device_state_changed.bind(this));
            this._nm_devices_signals_map.set(nm_device.get_iface(), [nm_device, signal_id]);
        }
    }

    /**
     * NetSpeed: _disconnect_nm_device_state_changed
     * Use GObject.signal_handler_disconnect to avoid override of disconnect
     * due ot introspection on NM.Device .
     */
    _disconnect_all_nm_device_state_changed() {
        for (let [nm_device, signal_id] of this._nm_devices_signals_map.values()) {
            GObject.signal_handler_disconnect(nm_device, signal_id);
        }
        this._nm_devices_signals_map.clear();
    }

    /**
     * NetSpeed: _nm_device_state_changed
     * Handler for NM.Device 'state-changed' signal
     * See https://developer.gnome.org/NetworkManager/stable/nm-dbus-types.html#NMDeviceState for states
     * See https://developer.gnome.org/NetworkManager/stable/nm-dbus-types.html#NMDeviceStateReason for reasons
     */
    _nm_device_state_changed(_nm_device, _old_state, _new_state, _reason) {
        //Logger.info(`${nm_device.get_iface()} move from ${old_state} to ${new_state}: reason ${reason}`);
        this._trigger_ips_reload();
    }

    /**
     * NetSpeed: _getAddresses
     * function from https://gitlab.freedesktop.org/NetworkManager/NetworkManager/-/blob/master/examples/js/get_ips.js#L16
     * @param {NM.Device}: NetWorkManager Device
     * @param {Glib.SYSDEF_AF_INET}: family - Glib.SYSDEF_AF_INET or Glib.SYSDEF_AF_INET6
     * @returns {string[]}: Array of 'address/prefix' string
     */
    _getAddresses(nm_device, family) {
        let ip_cfg;
        if (family === GLib.SYSDEF_AF_INET)
            ip_cfg = nm_device.get_ip4_config();
        else
            ip_cfg = nm_device.get_ip6_config();

        if (ip_cfg === null) {
            //Logger.info(`No config for device '${nm_device.get_iface()}'`);
            return [];
        }

        let nm_addresses = ip_cfg.get_addresses();
        if (nm_addresses.length === 0) {
            //Logger.info(`No IP addresses for device '${nm_device.get_iface()}'`);
            return [];
        }

        let addresses = [];
        for (let nm_address of nm_addresses) {
            let addr = nm_address.get_address();
            let prefix = nm_address.get_prefix();
            addresses.push(addr + "/" + prefix);
        }

        return addresses;
    }

});
