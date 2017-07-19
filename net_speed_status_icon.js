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

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Gettext = imports.gettext;
const Lang = imports.lang;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const Shell = imports.gi.Shell;
const St = imports.gi.St;

const _ = Gettext.gettext;
const LayoutMenuItem = Extension.imports.layout_menu_item;

/**
 * Class NetSpeedStatusIcon
 * status icon, texts for speeds, the drodown menu
 */
const NetSpeedStatusIcon = new Lang.Class(
{
    Name: 'NetSpeedStatusIcon',
    Extends: PanelMenu.Button,

    /**
     * NetSpeedStatusIcon: _init
     * Constructor
     */
    _init: function(net_speed)
    {
        this._net_speed = net_speed;
        this.parent(0.0);
        this._box = new St.BoxLayout();
        this._icon_box = new St.BoxLayout();
        this._icon = this._get_icon(this._net_speed.get_device_type(this._net_speed.getDevice()));

        //compact view
        this._speedicons = new St.Label({text: "⬆\n⬇", style_class: "ns-icons-label-compact"});
        this._speed = new St.Label({text: "---", style_class: "ns-label-compact"});
        this._speedunit = new St.Label({text: "", style_class: "ns-unit-label-compact"});
        this._box.add_actor(this._speedicons);
        this._box.add_actor(this._speed);
        this._box.add_actor(this._speedunit);

        //default view
        this._upicon = this._get_icon("up");
        this._downicon = this._get_icon("down");
        this._up = new St.Label({text: "---", style_class: 'ns-label'});
        this._upunit = new St.Label({text: "", style_class: 'ns-unit-label'});
        this._down = new St.Label({text: "---", style_class: 'ns-label'});
        this._downunit = new St.Label({text: "", style_class: 'ns-unit-label'});

        this._box.add_actor(this._down);
        this._box.add_actor(this._downunit);
        this._box.add_actor(this._downicon);

        this._box.add_actor(this._up);
        this._box.add_actor(this._upunit);
        this._box.add_actor(this._upicon);

        //sum view
        this._sum = new St.Label({text: "---", style_class: 'ns-label-sum'});
        this._sumunit = new St.Label({text: "", style_class: 'ns-unit-label-sum'});

        this._box.add_actor(this._sum);
        this._box.add_actor(this._sumunit);
        this._box.add_actor(this._icon_box);
        this._icon_box.add_actor(this._icon);
        this.actor.add_actor(this._box);
        this.actor.connect('button-release-event', Lang.bind(this, this._toggle_showsum));

        // Add pref luncher
        this._pref = new St.Button({ child: this._get_icon("pref")});
        this._pref.connect("clicked", function()
            {
                let app_sys = Shell.AppSystem.get_default();
                let prefs = app_sys.lookup_app('gnome-shell-extension-prefs.desktop');
                if (prefs.get_state() == prefs.SHELL_APP_STATE_RUNNING)
                    prefs.activate();
                else
                    prefs.get_app_info().launch_uris(['extension:///' + Extension.metadata.uuid], null);
            }
        );

        this._menu_title = new LayoutMenuItem.LayoutMenuItem(_("Device"), this._pref, this._net_speed.menu_label_size);
        this._menu_title.connect("activate", Lang.bind(this, this._change_device, ""));
        this._menu_title.update_speeds({ up: _("Up"), down: _("Down")});
        this.menu.addMenuItem(this._menu_title);
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        this._layouts = new Array();
        this.updateui();
    },

    /**
     * NetSpeedStatusIcon :_change_device
     */
     _change_device : function(param1, param2, device)
    {
        this._net_speed.setDevice(device);
        this.updateui();
        this._net_speed.save();
    },

    /**
     * NetSpeedStatusIcon: _toggle_showsum
     */
    _toggle_showsum : function(actor, event)
    {
        let button = event.get_button();
        if (button == 2) { // middle
            this._net_speed.showsum = ! this._net_speed.showsum;
            this.updateui();
            this._net_speed.save();
        }
    },


    /**
     * NetSpeedStatusIcon: updateui
     * update ui according to settings
     */
    updateui : function()
    {
        // Set the size of labels
        this._sum.set_width(this._net_speed.label_size);
        this._sumunit.set_width(this._net_speed.unit_label_size);

        this._speed.set_width(this._net_speed.label_size);
        this._speedunit.set_width(this._net_speed.label_size);

        this._up.set_width(this._net_speed.label_size);
        this._upunit.set_width(this._net_speed.unit_label_size);
        this._down.set_width(this._net_speed.label_size);
        this._downunit.set_width(this._net_speed.unit_label_size);

        // Show up + down or sum
        if (this._net_speed.showsum == false) {
            this._sum.hide();
            this._sumunit.hide();

            if (this._net_speed.compact_view) {
                this._speedicons.show();
                this._speed.show();
                this._speedunit.show();

                this._upicon.hide();
                this._up.hide();
                this._upunit.hide();
                this._downicon.hide();
                this._down.hide();
                this._downunit.hide();
            } else {
                this._speedicons.hide();
                this._speed.hide();
                this._speedunit.hide();

                this._upicon.show();
                this._up.show();
                this._upunit.show();
                this._downicon.show();
                this._down.show();
                this._downunit.show();
            }
        } else {
            this._sum.show();
            this._sumunit.show();

            this._speedicons.hide();
            this._speed.hide();
            this._speedunit.hide();

            this._upicon.hide();
            this._up.hide();
            this._upunit.hide();
            this._downicon.hide();
            this._down.hide();
            this._downunit.hide();
        }

        // Change the type of Icon
        this._icon.destroy();
        device = this._net_speed.getDevice();
	    log("Device -> " + device);
        this._icon = this._get_icon(this._net_speed.get_device_type(device));
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
    _get_icon: function(name, size)
    {
        if (arguments.length == 1)
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
        this._sum.set_text(sum.text);
        this._sumunit.set_text(sum.unit);

        this._up.set_text(up.text);
        this._upunit.set_text(up.unit);

        this._down.set_text(down.text);
        this._downunit.set_text(down.unit);

        this._speed.set_text(up.text + '\n' + down.text);
        this._speedunit.set_text(up.unit + '\n' + down.unit);
    },

    /**
     * NetSpeedStatusIcon: create_menu
     */
    create_menu: function(devices, types)
    {
        for (let i = 0; i < this._layouts.length; ++i)
            this._layouts[i].destroy();
        this._layouts = new Array();
        for (let i = 0; i < devices.length; ++i) {
            let icon = this._get_icon(types[i]);
            let layout = new LayoutMenuItem.LayoutMenuItem(devices[i], icon, this._net_speed.menu_label_size);
            layout.connect("activate", Lang.bind(this, this._change_device, devices[i]));
            this._layouts.push(layout);
            this.menu.addMenuItem(layout);
        }
    },

    /**
     * NetSpeedStatusIcon: update_speeds
     */
    update_speeds : function(speeds)
    {
        for (let i = 0; i < speeds.length; ++i) {
            this._layouts[i].update_speeds(speeds[i]);
        }
    },

});
