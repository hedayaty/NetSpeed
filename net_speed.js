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
const Lib = Extension.imports.lib;
const Gettext = imports.gettext;
const Gio = imports.gi.Gio;
const GObject = imports.gi.GObject;
const ByteArray = imports.byteArray;

const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;
const Panel = imports.ui.main.panel;

const NetworkManager = imports.gi.NM;

const _ = Gettext.domain('netspeed').gettext;
const NetSpeedStatusIcon = Extension.imports.net_speed_status_icon;

const Logger = Lib.getLogger();

/**
 * Class NetSpeed
 * The extension
 */
var NetSpeed = class NetSpeed {
  /**
   * NetSpeed: _init
   * Constructor
   */
  constructor() {
    let localeDir = Extension.dir.get_child('locale');
    if (localeDir.query_exists(null)) {
      Gettext.bindtextdomain('netspeed', localeDir.get_path());
    }
  }

  /**
   * NetSpeed: _is_up2date
   */
  _is_up2date() {
    if (this._devices.length != this._olddevices.length) {
      return 0;
    }
    for (let i = 0; i < this._devices.length; ++i) {
      if (this._devices[i] != this._olddevices[i])
        return 0;
    }
    return 1;
  }

  /**
   * NetSpeed: get_device_type
   */
  get_device_type(device) {
    let devices = this._client.get_devices() || [];

    for (let dev of devices) {
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
    if (amount == 0)
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
   * NetSpeed: _set_labels
   */
  _set_labels(sum, up, down) {
    this._status_icon.set_labels(sum, up, down);
  }

  /**
   * NetSpeed: _update_speeds
   */
  _update_speeds() {
    this._status_icon.update_speeds(this._speeds);

    // fix #131 by forcing a delayed redraw
    GLib.timeout_add(GLib.PRIORITY_DEFAULT, 1, () => {
      this._status_icon.queue_redraw();
      return GLib.SOURCE_REMOVE;
    });
  }

  /**
   * NetSpeed: _update_ips
   */
  _update_ips() {
    this._status_icon.update_ips(this._ips);
  }

  /**
   * NetSpeed: _create_menu
   */
  _create_menu() {
    let types = new Array();
    let devices_text = new Array();
    for (let dev of this._devices) {
      types.push(this.get_device_type(dev));
      let wifi_ssid = this._retrieve_wifi_ssid(dev);
      //Logger.info(`wifi_ssid is '${wifi_ssid}' for dev '${dev}'`);
      if (wifi_ssid != null) {
        devices_text.push(dev + `\n${wifi_ssid}`)
        continue;
      }
      devices_text.push(dev);
    }
    this._status_icon.create_menu(devices_text, types);
  }

  /**
   * NetSpeed: _updateDefaultGw
   */
  _updateDefaultGw() {
    let flines = GLib.file_get_contents('/proc/net/route'); // Read the file
    let nlines = ByteArray.toString(flines[1]).split("\n"); // Break to lines
    for (let nline of nlines) { //first 2 lines are for header
      let line = nline.replace(/^ */g, "");
      let params = line.split("\t");
      if (params.length != 11) // ignore empty lines
        continue;
      // So store up/down values
      if (params[1] == "00000000") {
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
    let nlines = ByteArray.toString(flines[1]).split("\n"); // Break to lines

    let up = 0; // set initial
    let down = 0;
    this._oldvalues = this._values;
    this._values = new Array();
    this._speeds = new Array();
    this._ips = new Array();
    this._olddevices = this._devices;
    this._devices = new Array();

    let time = GLib.get_monotonic_time() / 1000; // current time 1000 is not the net_speed.timer!
    let delta = time - this._last_time; // Here the difference is evaluated
    this._last_time = time;

    // parse the file
    for (let i = 2; i < nlines.length - 1; ++i) { //first 2 lines are for header
      let line = nlines[i].replace(/ +/g, " ").replace(/^ */g, "");
      let params = line.split(" ");
      if (params[0].replace(":", "") == "lo") // ignore local device
        continue;
      // So store up/down values
      this._values.push([parseInt(params[9]), parseInt(params[1])]);
      this._devices.push(params[0].replace(":", ""));
    }

    //log("[netspeed] Devices: " + this._devices);

    var total = 0;
    var total_speed = null;
    var up_speed = null;
    var down_speed = null;

    if (this._is_up2date() == 1 && !this._device_state_changed) {
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
        if (this.getDevice() == this._devices[i]) {
          total_speed = this._speed_to_string((_up + _down) / delta);
          up_speed = this._speed_to_string(_up / delta);
          down_speed = this._speed_to_string(_down / delta);
        }
      }
      if (total_speed == null) {
        total_speed = this._speed_to_string(total / delta);
        up_speed = this._speed_to_string(up / delta);
        down_speed = this._speed_to_string(down / delta);
      }

      this._set_labels(total_speed, up_speed, down_speed);
      this._update_speeds();
    } else {
      this._create_menu();
    }

    if (this._device_state_changed && this.show_ips) {
      this._retrieve_ips();
      this._update_ips();
      Logger.debug("Retrieved ips");
    }

    // reset state
    this._device_state_changed = false;

    return true;
  }

  /**
   * NetSpeed: _load
   */
  _load() {
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
    this.use_bytes = this._setting.get_boolean('use-bytes');
    this.bin_prefixes = this._setting.get_boolean('bin-prefixes');
    this.show_ips = this._setting.get_boolean('show-ips');
    this.vert_align = this._setting.get_boolean('vert-align');
  }

  /**
   * NetSpeed: save
   */
  save() {
    this._saving = 1; // Disable Load
    this._setting.set_boolean('show-sum', this.showsum);
    this._setting.set_string('device', this._device);
    this._setting.set_boolean('show-ips', this.show_ips);
    this._saving = 0; // Enable Load
  }

  /**
   * NetSpeed: _reload
   */
  _reload() {
    if (this._setting !== null) {
      let m_timer = this._setting.get_int('timer');
      if (m_timer !== this.timer) {
        Mainloop.source_remove(this._timerid);
        this._timerid = Mainloop.timeout_add(m_timer, this._update.bind(this));
        // this.timer will be updated within this._load, so no need to update it here
      }
      this._load();
      this._status_icon.updateui();
    }
  }

  /**
   * NetSpeed: enable
   * exported to enable the extension
   */
  enable() {
    this._last_up = 0; // size of upload in previous snapshot
    this._last_down = 0; // size of download in previous snapshot
    this._last_time = 0; // time of the latest snapshot
    this._device_state_changed = true; // flag to trigger menu refreshing

    this._values = new Array();
    this._devices = new Array();
    this._client = NetworkManager.Client.new(null);
    this._nm_signals = new Array();
    this._nm_signals.push(this._client.connect('any-device-added', this._nm_device_changed.bind(this)));
    this._nm_signals.push(this._client.connect('any-device-removed', this._nm_device_changed.bind(this)));
    this._nm_signals.push(this._client.connect('connection-added', this._nm_connection_changed.bind(this)));
    this._nm_signals.push(this._client.connect('connection-removed', this._nm_connection_changed.bind(this)));
    this._nm_signals.push(this._client.connect('active-connection-added', this._nm_connection_changed.bind(this)));
    this._nm_signals.push(this._client.connect('active-connection-removed', this._nm_connection_changed.bind(this)));

    // store NM Device 'state-changed' signal bindings to disconnect on disable
    this._nm_devices_signals_map = new Map();

    let schemaDir = Extension.dir.get_child('schemas');
    let schemaSource = schemaDir.query_exists(null) ?
      Gio.SettingsSchemaSource.new_from_directory(schemaDir.get_path(), Gio.SettingsSchemaSource.get_default(), false) :
      Gio.SettingsSchemaSource.get_default();
    let schema = schemaSource.lookup('org.gnome.shell.extensions.netspeed', false);
    this._setting = new Gio.Settings({ settings_schema: schema });
    this._saving = 0;
    this._load();

    this._updateDefaultGw();

    this._changed = this._setting.connect('changed', this._reload.bind(this));
    this._timerid = Mainloop.timeout_add(this.timer, this._update.bind(this));
    this._status_icon = new NetSpeedStatusIcon.NetSpeedStatusIcon(this);
    let placement = this._setting.get_string('placement');
    Panel.addToStatusArea('netspeed', this._status_icon, 0, placement);


  }

  /**
   * NetSpeed: disable
   * exported to disable the extension
   */
  disable() {
    if (this._timerid != 0) {
      Mainloop.source_remove(this._timerid);
      this._timerid = 0;
    }
    this._devices = null;
    this._values = null;
    this._olddevices = null;
    this._oldvalues = null;
    this._setting = null;

    this._nm_signals.forEach(sig_id => {
      this._client.disconnect(sig_id);
    });

    this._disconnect_all_nm_device_state_changed();
    this._client = null;
    this._status_icon.destroy();
    this._status_icon = null;
  }

  getDevice() {
    if (this._device == "defaultGW") {
      return this._defaultGw;
    } else {
      return this._device;
    }
  }

  setDevice(device) {
    this._device = device;
  }

  /**
   * NetSpeed: _nm_device_changed
   */
  _nm_device_changed(client, device) {
    this._trigger_ips_reload();
  }

  /**
   * NetSpeed: _nm_connection_changed
   */
  _nm_connection_changed(client, connection) {
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
      let nm_dev = this._client.get_device_by_iface(dev);
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
    let nm_dev = this._client.get_device_by_iface(iface);
    if (nm_dev.get_device_type() == NetworkManager.DeviceType.WIFI) {
      let active_ap = nm_dev.get_active_access_point();
      if (active_ap != null) {
        return ByteArray.toString(ByteArray.fromGBytes(active_ap.get_ssid()), 'UTF-8');
      }
    }
    return null;
  }

  /**
   * NetSpeed: _connect_nm_device_state_changed
   * @param {NM.Device} nm_device: NetworkManager Device instance
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
  _nm_device_state_changed(nm_device, old_state, new_state, reason) {
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
    if (family == GLib.SYSDEF_AF_INET)
      ip_cfg = nm_device.get_ip4_config();
    else
      ip_cfg = nm_device.get_ip6_config();

    if (ip_cfg == null) {
      //Logger.info(`No config for device '${nm_device.get_iface()}'`);
      return new Array();
    }

    let nm_addresses = ip_cfg.get_addresses();
    if (nm_addresses.length == 0) {
      //Logger.info(`No IP addresses for device '${nm_device.get_iface()}'`);
      return new Array();
    }

    let addresses = new Array();
    for (let nm_address of nm_addresses) {
      let addr = nm_address.get_address();
      let prefix = nm_address.get_prefix();
      addresses.push(addr + "/" + prefix);
    }

    return addresses;
  }

};
