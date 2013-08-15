const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Gdk = imports.gi.Gdk;
const GLib = imports.gi.GLib;
const Lang = imports.lang;
const GObject = imports.gi.GObject;
const NMC = imports.gi.NMClient;
const NetworkManager = imports.gi.NetworkManager;
const Extension = imports.misc.extensionUtils.getCurrentExtension();


let schemaDir = Extension.dir.get_child('schemas').get_path();
let schemaSource = Gio.SettingsSchemaSource.new_from_directory(schemaDir,
							  Gio.SettingsSchemaSource.get_default(),
							  false);
let schema = schemaSource.lookup('org.gnome.shell.extensions.netspeed', false);
let Schema = new Gio.Settings({ settings_schema: schema });


function init() {
}

const App = new Lang.Class({
  Name: 'NetSpeed.App',

  _get_dev_combo: function(){
    let listStore = new Gtk.ListStore();
    listStore.set_column_types ([GObject.TYPE_STRING, GObject.TYPE_STRING]);

    let iter = listStore.append();
    listStore.set (iter, [0], ["ALL"]);
    listStore.set (iter, [1], ["gtk-network"]);

    let nmc = NMC.Client.new();
    this._devices = nmc.get_devices() || [ ];

    for each (dev in this._devices) {
      let iconname;
			switch (dev.device_type) {
				case NetworkManager.DeviceType.ETHERNET:
					iconname = "network-wired-symbolic";
					break;
				case NetworkManager.DeviceType.WIFI:
					iconname = "network-wireless-signal-excellent-symbolic";
					break;
				case NetworkManager.DeviceType.BT:
					iconname = "bluetooth-active-symbolic";
					break;
				case NetworkManager.DeviceType.OLPC_MESH:
					iconname = "network-wired-symbolic";
					break;
				case NetworkManager.DeviceType.WIMAX:
					iconname = "network-wirelss-signal-excellent-symbolic"; // Same for wifi
					break;
				case NetworkManager.DeviceType.MODEM:
					iconname = "gnome-transmit-symbolic"; 
					break;
				default:
					iconname = "network-transmit-receive-symbolic";
			}
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
  },

  _put_dev: function() {
		let active = this.dev.get_active();
		if (active == -1)
			return;
		this._setting = 1;
		if (active == 0)
			Schema.set_string ('device', "");
		else
			Schema.set_string ('device', this._devices[active - 1].interface);
		this._setting = 0;
	},

  _pick_dev: function() {
	  if (this._setting == 1)
			return;
		let activeDev = Schema.get_string('device');
		let active = 0;
		for (let i = 0; i < this._devices.length; ++i)
			if (this._devices[i].interface == activeDev)
				active = i + 1;
		 this.dev.set_active (active);
  },

  _init: function() {
	 this.main = new Gtk.Grid({row_spacing: 10, column_spacing: 20, column_homogeneous: false, row_homogeneous: true});
	 this.main.attach (new Gtk.Label({label: 'Device to monitor'}), 1, 1, 1, 1);	
	 this.main.attach (new Gtk.Label({label: 'Timer (milisec)'}), 1, 4, 1, 1);
	 this.main.attach (new Gtk.Label({label: 'Digits'}), 1, 5, 1, 1);	
	 this.main.attach (new Gtk.Label({label: 'Label Size'}), 1, 6, 1, 1);	
	 this.main.attach (new Gtk.Label({label: 'Menu Label Size'}), 1, 7, 1, 1);

	 //	this.dev = new Gtk.Entry();
	 this.dev = this._get_dev_combo();
	 this.sum = new Gtk.CheckButton({label: 'Show sum(UP+Down)'});
	 this.icon = new Gtk.CheckButton({label: 'Show the Icon'});
	 this.timer = new Gtk.SpinButton.new_with_range(100, 10000, 100);
	 this.digits = new Gtk.SpinButton.new_with_range(3, 10, 1);
	 this.label_size = Gtk.SpinButton.new_with_range(1, 100, 1);
	 this.menu_label_size = Gtk.SpinButton.new_with_range(1, 100, 1);

	 this.main.attach(this.dev, 2, 1, 1, 1);
	 this.main.attach(this.sum, 1, 2, 2, 1);
	 this.main.attach(this.icon, 1, 3, 2, 1);
	 this.main.attach(this.timer, 2, 4, 1, 1);
	 this.main.attach(this.digits, 2, 5, 1, 1);
	 this.main.attach(this.label_size, 2, 6, 1, 1);
	 this.main.attach(this.menu_label_size, 2, 7, 1, 1);

	 Schema.bind('show-sum', this.sum, 'active', Gio.SettingsBindFlags.DEFAULT);
	 Schema.bind('icon-display', this.icon, 'active', Gio.SettingsBindFlags.DEFAULT);
	 Schema.bind('timer', this.timer, 'value', Gio.SettingsBindFlags.DEFAULT);
	 Schema.bind('digits', this.digits, 'value', Gio.SettingsBindFlags.DEFAULT);
	 Schema.bind('label-size', this.label_size, 'value', Gio.SettingsBindFlags.DEFAULT);
	 Schema.bind('menu-label-size', this.menu_label_size, 'value', Gio.SettingsBindFlags.DEFAULT);

	this._setting = 0;

	//Schema.bind('device', this.dev, 'active_id', Gio.SettingsBindFlags.DEFAULT);
	this._pick_dev();

	this.dev.connect('changed', Lang.bind(this, this._put_dev));

	Schema.connect('changed::device', Lang.bind(this, this._pick_dev));

		/*

    // COLOR
    let item = new Gtk.CheckButton({label: _('Use custom color')})
    this.vbox3.add(item)
    Schema.bind('custom-color', item, 'active', Gio.SettingsBindFlags.DEFAULT);		

    let label = new Gtk.Label({label: "Color: "});
    let color = new Gtk.ColorButton();
    let _actor = new Gtk.HBox();
    _actor.add(label);
    _actor.add(color);

    let _color = getColorByHexadecimal(Schema.get_string('color'));
    color.set_color(_color);

    this.vbox3.add(_actor);
    color.connect('color-set', function(color){
    Schema.set_string('color', getHexadecimalByColor(color.get_color()));
    });

*/
	this.main.show_all();
	}
});

function buildPrefsWidget(){
    let widget = new App();
    return widget.main;
};

//vim : ts=2 sw=2
