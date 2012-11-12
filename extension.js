 /*
  * Copyright 2011-2012 Amir Hedayaty < hedayaty AT gmail DOT com >
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


let netSpeed;

function LayoutMenuItem() {
    this._init.apply(this, arguments);
}

LayoutMenuItem.prototype = {
    __proto__: PopupMenu.PopupBaseMenuItem.prototype,

    _init: function(device, icon) {
        PopupMenu.PopupBaseMenuItem.prototype._init.call(this);
        this.device = device;
				this._icon = icon;
				this._device_title = new St.Label ({ text: device , style_class : "ns-menuitem"});
      	this._down_label = new St.Label ({ text: "", style_class : "ns-menuitem"});
				this._up_label = new St.Label ({text: "", style_class: "ns-menuitem"});
				if (this._icon != null )
					this.addActor(this._icon);
				else
					this.addActor (new St.Label ());
        this.addActor(this._device_title);
        this.addActor(this._down_label);
				this.addActor(this._up_label);
				this.update_ui();
				//this.connect ("activate", Lang.bind (this, this.selected));

		//		this._device_title.connect ("clicked", Lang.bind (this, this.selected));
	//			this._down_label.connect ("clicked", Lang.bind (this, this.selected));
			//	this._up_label.connect ("clicked", Lang.bind (this, this.selected));
		//		this._icon.connect ("clicked", Lang.bind (this, this.selected));
    },

		update_ui: function() {
				this._down_label.set_width (netSpeed.menulabelsize);
				this._up_label.set_width (NetSpeed.menulabelsize);
		},
/*
		selected: function()
		{
			this.emit ("selected");
		},
*/
		update: function(up, down) {
			this._down_label.set_text(down);
			this._up_label.set_text(up);		
		},

};

function NetSpeedStatusIcon()
{
	this._init.apply (this, arguments);
}

NetSpeedStatusIcon.prototype = {
    __proto__: PanelMenu.Button.prototype,

		_init: function () {			
	    PanelMenu.Button.prototype._init.call(this, 0.0);
			this._box = new St.BoxLayout();
			this._icon_box = new St.BoxLayout();
			this._icon = this._get_icon (netSpeed.get_device_type(netSpeed.device));
			this._upicon = this._get_icon ("up");
			this._downicon = this._get_icon ("down");
			this._sum = new St.Label({ text: "---", style_class: 'ns-label'});
			this._sumunit = new St.Label({ text: "", style_class: 'ns-unit-label'});
			this._up = new St.Label({ text: "---", style_class: 'ns-label'});
			this._upunit = new St.Label({ text: "", style_class: 'ns-unit-label'});
			this._down = new St.Label({ text: "---", style_class: 'ns-label'});
			this._downunit = new St.Label({ text: "", style_class: 'ns-unit-label'});

			this._box.add_actor (this._sum);
			this._box.add_actor (this._sumunit);

			this._box.add_actor (this._down);
			this._box.add_actor (this._downunit);
			this._box.add_actor (this._downicon);

			this._box.add_actor (this._up);
			this._box.add_actor (this._upunit);
			this._box.add_actor (this._upicon);
			this._box.add_actor (this._icon_box);
			this._icon_box.add_actor (this._icon);
			this.actor.add_actor (this._box);
			this.actor.connect ('button-release-event', Lang.bind(this, this._toggle_showsum));

			// Add pref luncher
			this._pref = new St.Button ({ child: this._get_icon("pref")});
			this._pref.connect ("clicked", function() {
        let _appSys = Shell.AppSystem.get_default();
        let _gsmPrefs = _appSys.lookup_app('gnome-shell-extension-prefs.desktop');
				if (_gsmPrefs.get_state() == _gsmPrefs.SHELL_APP_STATE_RUNNING){
					_gsmPrefs.activate();
				} else {
					_gsmPrefs.launch(global.display.get_current_time_roundtrip(),	[Extension.metadata.uuid], -1, null);
				}
			});

			this._menu_title = new LayoutMenuItem("Device", this._pref);
			this._menu_title.connect ("activate", Lang.bind(this, this._change_device, ""));
			this._menu_title.update ("Up", "Down");
			this.menu.addMenuItem (this._menu_title);
			this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
			this._layouts = new Array();
			this.updateui();
	},

	/************************* Change Device ************************************/
	_change_device : function (param1, param2, device)
	{
		netSpeed.device = device;
		this.updateui();
		netSpeed.save();
	},	

	/************************* Toggle showsum ************************************/
	_toggle_showsum : function (actor, event) {
		let button = event.get_button();
		if (button == 2) // middle
		{
			netSpeed.showsum = ! netSpeed.showsum;
			this.updateui ();
			netSpeed.save();
		}
	},


	/************************ Tune the visiblity *********************************/
	updateui : function () {
		// Set the size of labels
		this._sum.set_width (netSpeed.labelsize);
		this._up.set_width (netSpeed.labelsize);
		this._down.set_width (netSpeed.labelsize); 

		// Show up + down or sum
		if (netSpeed.showsum == false) {
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
		this._icon = this._get_icon (netSpeed.get_device_type(netSpeed.device));
		this._icon_box.add_actor(this._icon);
		// Show icon or not
		if (netSpeed.use_icon) {
			this._icon.show();
		} else {
			this._icon.hide();
		}
		
		// Update Menu sizes
		for (let i = 0; i < this._layouts.length; ++i) {
			this._layouts[i].update_ui ();
		}
	},

	/*********************** Get device icon by type ******************************/
	_get_icon: function (devicetype, size) {
		if (arguments.length == 1)
			size = 16;
		let iconname = "network-transmit-receive";
		if (devicetype == "none")
	//		iconname = "network-offline";
			iconname = "network-transmit-receive-symbolic";
		else if (devicetype == "ethernet")
			iconname = "network-wired-symbolic";
		else if (devicetype == "wifi")
			iconname = "network-wireless-signal-excellent-symbolic";
		else if (devicetype == "bt" )
			iconname = "bluetooth-active-symbolic";
		else if (devicetype == "olpcmesh" )
			iconname = "network-wired-symbolic";
		else if (devicetype == "wimax")
			iconname = "network-wirelss-signal-excellent-symbolic"; // Same for wifi
		else if (devicetype == "modem")
			iconname = "gnome-modem"; // Hope works!
		else if (devicetype == "up")
			iconname = "go-up-symbolic";
		else if (devicetype == "down")
			iconname = "go-down-symbolic";
		else if (devicetype == "pref")
			iconname = "emblem-system-symbolic";
			
   return new St.Icon(
				{ icon_name: iconname,
					icon_size: size,
				});

	},
	
	/****************** Set the Label ****************************************/
	set_labels: function (sum, up, down) 
	{
		this._sum.set_text(sum[0]);
		this._sumunit.set_text(sum[1]);

		this._up.set_text (up[0]);
		this._upunit.set_text (up[1]);

		this._down.set_text (down[0]);
		this._downunit.set_text (down[1]);
	},

	/**************** Destroy each element in array ***************************/
	_destroy_array: function (array) {
		for (let i = 0; i < array.length; ++i)
			array[i].destroy();
	},


	/************************* create the menu  ******************************************/
	create_menu: function (devices, types) {
		this._destroy_array (this._layouts);
		this._layouts = new Array();
		for (let i = 0; i < devices.length; ++i)	
		{	
			let icon = this._get_icon (types[i]);
			let layout = new LayoutMenuItem(devices[i], icon);
			layout.connect ("activate", Lang.bind(this, this._change_device, devices[i]));
			this._layouts.push (layout);
			this.menu.addMenuItem (layout);
		}
	},

	/********************************** update each devices speed *************************************/
	update_speeds : function (speeds) {
		for (let i = 0; i < speeds.length; ++i) {
			this._layouts[i].update (speeds[i][0], speeds[i][1]);
		}
	}, 

};

function NetSpeed()
{
	this._init.apply (this, arguments);
}

NetSpeed.prototype = {

	/********************* check if there was a change in devices ******************/
	_check_devices: function() {
		if (this._devices.length != this._olddevices.length)
			return 0;
		for (let i = 0; i < this._devices.length; ++i)
			if (this._devices[i] != this._olddevices[i])
				return 0;
		return 1;
	},

	_dump_array: function (array) {
		 global.log (JSON.stringify (array));
	},

	/********** get device type maybe from netwrok-manager **************************/
	get_device_type: function (device) {
		let devices =	this._client.get_devices() || [ ];

		for each (let dev in devices) 
			if (dev.interface == device) 
				switch (dev.device_type)
				{
					case NetworkManager.DeviceType.ETHERNET:
						return  "ethernet";
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

		return "none";
	},
	
	/************************* speed to user-friendly string ***************************************/
	_speed_to_string: function (amount, digits)	{
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
		let  speed_map = ["B/s", "KB/s", "MB/s", "GB/s"];
		return [amount.toFixed (digits - 1), speed_map[unit]];
	},


	/*********************************** Update the Label  **************************************************/
	_set_labels: function(sum, up, down) {
		this._status_icon.set_labels (sum, up, down);
	},

	/*********************************** Ask to update the speeds for each device *****************************************/
	_update_speeds: function(){
		this._status_icon.update_speeds (this._speeds);
	},

	/************************************ Ask to create menu for each device ***********************************/
	_create_menu: function(){
		let types = new Array();
		for (let i = 0; i < this._devices.length; ++i)
			types.push(this.get_device_type (this._devices[i]));
		this._status_icon.create_menu (this._devices, types);
	},


	/******************************** Update invoked by timer ******************************/
	_update : function ()
	{
		let flines = GLib.file_get_contents('/proc/net/dev');  // Read the file
		let nlines = ("" + flines[1]).split("\n"); // Break to lines

		let up=0; // set initial
		let down=0;
		this._oldvalues = this._values;
		this._values = new Array();
		this._speeds = new Array();
		this._olddevices = this._devices;
		this._devices = new Array();
	
		let time = GLib.get_monotonic_time() / 1000; // current time 1000 is not the netSpeed.timer!
		let delta = time - this._last_time; // Here the difference is evaluated
		this._last_time = time;

		// parse the file
		for(let i = 2; i < nlines.length - 1 ; ++i) { //first 2 lines are for header	
			let line =  nlines[i].replace(/ +/g, " ").replace(/^ */g, "");
			let params = line.split (" ");
			if (params[0].replace(":","") == "lo") // ignore local device
				continue;
			//this._dump_array (params);
			// So store up/down values
			this._values.push ([parseInt(params[9]), parseInt(params[1])]);
			this._devices.push (params[0].replace(":",""));
		}

		var total = 0;
		var up = 0;
		var down = 0;
		let total_speed = []; 
		let up_speed = [];
		let down_speed = [];
		if (this._check_devices () == 1) 	{
			for (let i = 0; i < this._values.length; ++i) {
				let _up = this._values[i][0] - this._oldvalues[i][0];
				let _down = this._values[i][1] - this._oldvalues[i][1];

				// Avoid negetive speed in case of device going down, when device goes down,
				if (_up < 0 )_up = 0;
				if (_down < 0) _down = 0;
				this._speeds.push([
					this._speed_to_string(_up / delta, this.digits).join(""), //  Upload
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
			
			this._set_labels (total_speed, up_speed, down_speed);
			this._update_speeds ();
		}
		else
		{
			this._create_menu();
		}
		return true;
	},

	/************************************* Constructor *************************************************/
	_init : function () {
			this._client = NMC.Client.new();
	},
	
	_load: function() {
		if (this._saving == 1) {
			return;
		}			
		this.showsum = this._setting.get_boolean('show-sum');
		this.use_icon = this._setting.get_boolean('icon-display');
		this.digits = this._setting.get_int('digits');
		this.device = this._setting.get_string('device');
		this.timer = this._setting.get_int('timer');
		this.labelsize = this._setting.get_int('label-size');
		this.menulabelsize = this._setting.get_int('menu-label-size');
  },

	save: function() {
		this._saving = 1; //  Disable Load
    this._setting.set_boolean('show-sum', this.showsum);
    this._setting.set_string('device', this.device);
		/* No point in saving if you can not ever modify them
    this._setting.set_boolean('icon-display', this.use_icon);
    this._setting.set_int('digits', this.digits);
    this._setting.set_int('timer', this.timer);
    this._setting.set_int('label-size', this.labelsize);
    this._setting.set_int('menu-label-size', this.menulabelsize);
    */
		this._saving = 0; // Enable Load
  },

	_reload: function() {
		this._load();
		this._status_icon.updateui();
	},

	
	enable: function() {
		this._last_up = 0; // size of upload in previous snapshot
		this._last_down = 0; // size of download in previous snapshot
		this._last_time = 0; // time of the latest snapshot

		this._values = new Array();
		this._devices = new Array();

    let schemaDir = Extension.dir.get_child('schemas').get_path();
    let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir,
								  Gio.SettingsSchemaSource.get_default(),
								  false);
    let schema = schemaSource.lookup('org.gnome.shell.extensions.netspeed', false);
    this._setting = new Gio.Settings({ settings_schema: schema });
		this._saving = 0;
		this._load();


		this._status_icon = new NetSpeedStatusIcon ();
  	this._changed = this._setting.connect('changed', Lang.bind(this, this._reload));
		Panel.addToStatusArea('netspeed', this._status_icon, 0);
		//Panel.__netspeed = this;
		this._timerid = Mainloop.timeout_add(this.timer, Lang.bind(this, this._update));
	},

	disable: function () {
		// if (this._changed)
		// {
		//   this._settings.disconnect (this._changed);
		//   this._changed = 0;
		// }
		// this._settings = null;
		this._status_icon.destroy();
		//Main.panel.statusArea['netspeed'].destroy();
		if (this._timerid != 0)
		{
			Mainloop.source_remove(this._timerid);
			this._timerid = 0;
		}
		this._setting.run_dispose();
	},
}


/********************* Extension Creator ********************/
function init() {
	netSpeed = new NetSpeed;
	return netSpeed;
}


// vim: ts=2 sw=2
