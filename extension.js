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

/*
 * Constants
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

/**
 * Class: LayoutMenuItem
 */
const LayoutMenuItem = new Lang.Class({
		Name: 'LayoutMenuItem',
		Extends: PopupMenu.PopupBaseMenuItem,

		/**
		 * LayoutMenuItem: _init
		 * Constructor
		 */
		_init: function(device, icon, menu_label_size) {
			this.parent();
			this.device = device;
			this._icon = icon;
			this._device_title = new St.Label({ text: device , style_class : "ns-menuitem"});
			this._down_label = new St.Label({ text: "", style_class : "ns-menuitem"});
			this._up_label = new St.Label({text: "", style_class: "ns-menuitem"});
			if (this._icon != null )
				this.actor.add(this._icon);
			else
				this.actor.add(new St.Label());
			this.actor.add(this._device_title);
			this.actor.add(this._down_label);
			this.actor.add(this._up_label);
			this.update_ui(menu_label_size);
		},

		/**
		 * LayoutMenuItem: update_ui
		 * update settings
		 */
		update_ui: function(menu_label_size) {
			this._down_label.set_width(menu_label_size);
			this._up_label.set_width(menu_label_size);
			this._device_title.set_width(menu_label_size);
		},

		/**
		 * LayoutMenuItem: update_speeds
		 * update speeds
		 */
		update_speeds: function(up, down) {
			this._down_label.set_text(down);
			this._up_label.set_text(up);
		},
});

/**
 * Class NetSpeedStatusIcon
 * status icon, texts for speeds, the drodown menu
 */
const NetSpeedStatusIcon = new Lang.Class({
		Name: 'NetSpeedStatusIcon',
		Extends: PanelMenu.Button,

		/**
		 * NetSpeedStatusIcon: _init
		 * Constructor
		 */
		_init: function(net_speed) {
			this._net_speed = net_speed;
			this.parent(0.0);
			this._box = new St.BoxLayout();
			this._icon_box = new St.BoxLayout();
			this._icon = this._get_icon(this._net_speed.get_device_type(this._net_speed.device));
			this._upicon = this._get_icon("up");
			this._downicon = this._get_icon("down");
			this._sum = new St.Label({ text: "---", style_class: 'ns-label'});
			this._sumunit = new St.Label({ text: "", style_class: 'ns-unit-label'});
			this._up = new St.Label({ text: "---", style_class: 'ns-label'});
			this._upunit = new St.Label({ text: "", style_class: 'ns-unit-label'});
			this._down = new St.Label({ text: "---", style_class: 'ns-label'});
			this._downunit = new St.Label({ text: "", style_class: 'ns-unit-label'});

			this._box.add_actor(this._sum);
			this._box.add_actor(this._sumunit);

			this._box.add_actor(this._down);
			this._box.add_actor(this._downunit);
			this._box.add_actor(this._downicon);

			this._box.add_actor(this._up);
			this._box.add_actor(this._upunit);
			this._box.add_actor(this._upicon);
			this._box.add_actor(this._icon_box);
			this._icon_box.add_actor(this._icon);
			this.actor.add_actor(this._box);
			this.actor.connect('button-release-event', Lang.bind(this, this._toggle_showsum));

			// Add pref luncher
			this._pref = new St.Button({ child: this._get_icon("pref")});
			this._pref.connect("clicked", function() {
				let app_sys = Shell.AppSystem.get_default();
				let prefs = app_sys.lookup_app('gnome-shell-extension-prefs.desktop');
				if (prefs.get_state() == prefs.SHELL_APP_STATE_RUNNING)
					prefs.activate();
				else
					prefs.get_app_info().launch_uris(['extension:///' + Extension.metadata.uuid], null);
			});

			this._menu_title = new LayoutMenuItem(_("Device"), this._pref, this._net_speed.menu_label_size);
			this._menu_title.connect("activate", Lang.bind(this, this._change_device, ""));
			this._menu_title.update_speeds(_("Up"), _("Down"));
			this.menu.addMenuItem(this._menu_title);
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this._layouts = new Array();
			this.updateui();
	},

	/**
	 * NetSpeedStatusIcon :_change_device
	 * TODO: this seems public so remove _
	 */
	_change_device : function(param1, param2, device)	{
		this._net_speed.device = device;
		this.updateui();
		this._net_speed.save();
	},

	/**
	 * NetSpeedStatusIcon: _toggle_showsum
	 */
	_toggle_showsum : function(actor, event) {
		let button = event.get_button();
		if (button == 2) // middle
		{
			this._net_speed.showsum = ! this._net_speed.showsum;
			this.updateui();
			this._net_speed.save();
		}
	},


	/**
	 * NetSpeedStatusIcon: updateui
	 * update ui according to settings
	 */
	updateui : function() {
		// Set the size of labels
		this._sum.set_width(this._net_speed.label_size);
		this._up.set_width(this._net_speed.label_size);
		this._down.set_width(this._net_speed.label_size);

		// Show up + down or sum
		if (this._net_speed.showsum == false) {
			this._sum.hide();
			this._sumunit.hide();
			this._upicon.show();
			this._up.show();
			this._upunit.show();
			this._downicon.show();
			this._down.show();
			this._downunit.show();
		} else {
			this._sum.show();
			this._sumunit.show();
			this._upicon.hide();
			this._up.hide();
			this._upunit.hide();
			this._downicon.hide();
			this._down.hide();
			this._downunit.hide();
		}

		// Change the type of Icon
		this._icon.destroy();
		this._icon = this._get_icon(this._net_speed.get_device_type(this._net_speed.device));
		this._icon_box.add_actor(this._icon);
		// Show icon or not
		if (this._net_speed.use_icon)
			this._icon.show();
		else
			this._icon.hide();
		// Update Menu sizes
		for (let i = 0; i < this._layouts.length; ++i) {
			this._layouts[i].update_ui(this._net_speed.menu_label_size);
		}
	},

	/**
	 * NetSpeedStatusIcon: _get_icon
	 * Utility function to create icon from name
	 */
	_get_icon: function(name, size) {
		if (arguments.length == 1)
			size = 16;
		let iconname = "";
		switch(name) {
		case "none":
			iconname = "network-transmit-receive-symbolic";
			break;
		case "ethernet":
			iconname = "network-wired-symbolic";
			break;
		case "wifi":
			iconname = "network-wireless-signal-excellent-symbolic";
			break;
		case "bt" :
			iconname = "bluetooth-active-symbolic";
			break;
		case "olpcmesh" :
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
	 		iconname = "network-transmit-receive";
		}

		return new St.Icon({
			icon_name: iconname,
			icon_size: size,
		});
	},

	/**
	 * NetSpeedStatusIcon: set_labels
	 */
	set_labels: function(sum, up, down)
	{
		this._sum.set_text(sum[0]);
		this._sumunit.set_text(sum[1]);

		this._up.set_text(up[0]);
		this._upunit.set_text(up[1]);

		this._down.set_text(down[0]);
		this._downunit.set_text(down[1]);
	},

	/**
	 * NetSpeedStatusIcon: create_menu
	 */
	create_menu: function(devices, types) {
		this._layouts = new Array();
		for (let i = 0; i < devices.length; ++i) {
			let icon = this._get_icon(types[i]);
			let layout = new LayoutMenuItem(devices[i], icon, this._net_speed.menu_label_size);
			layout.connect("activate", Lang.bind(this, this._change_device, devices[i]));
			this._layouts.push(layout);
			this.menu.addMenuItem(layout);
		}
	},

	/**
	 * NetSpeedStatusIcon: update_speeds
	 */
	update_speeds : function(speeds) {
		for (let i = 0; i < speeds.length; ++i) {
			this._layouts[i].update_speeds(speeds[i][0], speeds[i][1]);
		}
	},

});


/**
 * Class NetSpeed
 * The extension
 */
const NetSpeed = new Lang.Class({
	Name: 'NetSpeed',

	/**
	 * NetSpeed: _init
	 * Constructor
	 */
	_init : function() {
    let localeDir = Extension.dir.get_child('locale');
    if (localeDir.query_exists(null))
      Gettext.bindtextdomain('netspeed', localeDir.get_path());
	},

	/**
	 * NetSpeed: _check_devices
	 */
	_check_devices: function() {
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
	get_device_type: function(device) {
		let devices =	this._client.get_devices() || [ ];

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
	_speed_to_string: function(amount, digits) {
		if (amount == 0)
			return ["0", "B/s"];
		if (digits < 3)
			digits = 3;
		amount *= 1000;
		let unit = 0;
		while (amount >= 1000)// 1M=1024K, 1MB/s=1000MB/s
		{
			amount /= 1000;
			++unit;
		}

		if (amount >= 100)
			digits -= 2;
		else if (amount >= 10)
			digits -= 1;
		let speed_map = [_("B/s"), _("KB/s"), _("MB/s"), _("GB/s")];
		return [amount.toFixed(digits - 1), speed_map[unit]];
	},


	/**
	 * NetSpeed: _set_labels
	 */
	_set_labels: function(sum, up, down) {
		this._status_icon.set_labels(sum, up, down);
	},

	/**
	 * NetSpeed: _update_speeds
	 */
	_update_speeds: function() {
		this._status_icon.update_speeds(this._speeds);
	},

	/**
	 * NetSpeed: _create_menu
	 */
	_create_menu: function() {
		let types = new Array();
		for (let i = 0; i < this._devices.length; ++i)
			types.push(this.get_device_type(this._devices[i]));
		this._status_icon.create_menu(this._devices, types);
	},

	/**
	 * NetSpeed: _update
	 */
	_update : function() {
		let flines = GLib.file_get_contents('/proc/net/dev'); // Read the file
		let nlines = ("" + flines[1]).split("\n"); // Break to lines

		let up=0; // set initial
		let down=0;
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
		var up = 0;
		var down = 0;
		let total_speed = [];
		let up_speed = [];
		let down_speed = [];
		if (this._check_devices() == 1)	{
			for (let i = 0; i < this._values.length; ++i) {
				let _up = this._values[i][0] - this._oldvalues[i][0];
				let _down = this._values[i][1] - this._oldvalues[i][1];

				// Avoid negetive speed in case of device going down, when device goes down,
				if (_up < 0 )_up = 0;
				if (_down < 0) _down = 0;
				this._speeds.push([
					this._speed_to_string(_up / delta, this.digits).join(""), // Upload
					this._speed_to_string(_down / delta, this.digits).join("") // Download
				]);
				total += _down + _up;
				up += _up;
				down += _down;
				if (this.device == this._devices[i]) {
					total_speed = this._speed_to_string((_up + _down) / delta, this.digits);
					up_speed = this._speed_to_string(_up / delta, this.digits);
					down_speed = this._speed_to_string(_down / delta, this.digits);
				}
			}
			if (total_speed.length == 0) {
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
	_load: function() {
		if (this._saving == 1) {
			return;
		}
		this.showsum = this._setting.get_boolean('show-sum');
		this.use_icon = this._setting.get_boolean('icon-display');
		this.digits = this._setting.get_int('digits');
		this.device = this._setting.get_string('device');
		this.timer = this._setting.get_int('timer');
		this.label_size = this._setting.get_int('label-size');
		this.menu_label_size = this._setting.get_int('menu-label-size');
	},

	/**
	 * NetSpeed: save
	 */
	save: function() {
		this._saving = 1; // Disable Load
		this._setting.set_boolean('show-sum', this.showsum);
		this._setting.set_string('device', this.device);
		this._saving = 0; // Enable Load
	},

	/**
	 * NetSpeed: _reload
	 */
	_reload: function() {
		this._load();
		this._status_icon.updateui();
	},


	/**
	 * NetSpeed: enable
	 * exported to enable the extension
	 */
	enable: function() {
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
				false);
		let schema = schemaSource.lookup('org.gnome.shell.extensions.netspeed', false);
		this._setting = new Gio.Settings({ settings_schema: schema });
		this._saving = 0;
		this._load();

		this._status_icon = new NetSpeedStatusIcon(this);
		this._changed = this._setting.connect('changed', Lang.bind(this, this._reload));
		this._timerid = Mainloop.timeout_add(this.timer, Lang.bind(this, this._update));
		Panel.addToStatusArea('netspeed', this._status_icon, 0);
	},

	/**
	 * NetSpeed: disable
	 * exported to disable the extension
	 */
	disable: function() {
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
});


/**
 * init
 * run when gnome-shell loads
 */
function init() {
	return new NetSpeed();
}


// vim: ts=2 sw=2
