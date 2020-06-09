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
const Config = imports.misc.config;

// Schema name
var SCHEMA = "org.gnome.shell.extensions.netspeed";

// Debug Mode Settings
var DEBUG = false;

// Logging
const LOG_DOMAIN = SCHEMA;
const LOG_PREFIX = `[${LOG_DOMAIN}]`;

// Log all messages when connected to the journal
if (GLib.log_writer_is_journald(2) && DEBUG) {
    GLib.setenv('G_MESSAGES_DEBUG', LOG_DOMAIN, false);
} else {
    // FIXME: manage already existing env var
    GLib.unsetenv('G_MESSAGES_DEBUG');
}

/**
 * A Logger class inspired to GJS doc/Logging.md
 *
 */
var _loggerClass = class _Logger {

    constructor(module) {
    }

    _getMessage(event, file, func, line) {
        let timestamp = new Date(new Date().getTime()).toISOString();
        let message = `${event}`;
        message = `[${Extension.uuid}:${file}:${func}:${line}] -> ${event}`;
        return message;
    }

    _makeLogFunction(level) {
        return message => {
            let stack = (new Error()).stack;
            let caller = stack.split('\n')[2];

            // caller example: message@/home/guser/.local/share/gnome-shell/extensions/netspeed@hedayaty.gmail.com/lib.js:75:9
            // Extension.path: /home/guser/.local/share/gnome-shell/extensions/netspeed@hedayaty.gmail.com
            caller = caller.replace(Extension.path + "/", "");

            let [code, line, _] = caller.split(':');
            let [func, file] = code.split(/\W*@/);
            let msg = this._getMessage(message, file, func, line);
            GLib.log_structured(LOG_DOMAIN, level, {
                'MESSAGE': msg,
                //'SYSLOG_IDENTIFIER': LOG_DOMAIN,
                'CODE_FILE': file,
                'CODE_FUNC': func,
                'CODE_LINE': line
            });
        };
    }

    debug(event) {
        this._makeLogFunction(GLib.LogLevelFlags.LEVEL_DEBUG)(event);
    }

    log(event) {
        this._makeLogFunction(GLib.LogLevelFlags.LEVEL_MESSAGE)(event);
    }

    message(event) {
        this._makeLogFunction(GLib.LogLevelFlags.LEVEL_MESSAGE)(event);
    }

    info(event) {
        this._makeLogFunction(GLib.LogLevelFlags.LEVEL_INFO)(event);
    }

    warning(event) {
        this._makeLogFunction(GLib.LogLevelFlags.LEVEL_WARNING)(event);
    }

    /*
    error(event) {
        // result in a core dump
        this._makeLogFunction(GLib.LogLevelFlags.LEVEL_ERROR)(event);
    }
    */

    critical(event) {
        this._makeLogFunction(GLib.LogLevelFlags.LEVEL_CRITICAL)(event);
    }
}


/**
 * getLogger:
 * @returns {_Logger} a new Logger instance if not exists
 */
let _loggerInstance;
function getLogger() {
    if (!_loggerInstance) {
        _loggerInstance = new _loggerClass();
    }
    return _loggerInstance;
}


/**
 * splitVersion:
 * @param {string} version - the version we have in semantic versioning format
 * @returns {int[2]} - an array of int for <major> and <minor> for @version
 *
 * @version must be in the format <major>.<minor>.<micro>.<pre-tag>
 * <micro> and <pre-tag> are always ignored
 */

function splitVersion(version) {
    let currentArray = version.split('.');
    let major = parseInt(currentArray[0]);
    let minor = parseInt(currentArray[1]);
    return [major, minor];
}


/**
 * canShowIPs:
 * @returns {boolean} - true if panel can show IPs, false otherwise
 *
 * Gjs 1.56 (not sure) - 1.57 (Gnome 3.28 - 3.32) have a bug on Marshalling of GPtrArray,
 * so NetworkManager js binding crash on returning ip_config.
 * https://gitlab.gnome.org/GNOME/gjs/issues/9
 */

function canShowIPs() {

    let version_array = splitVersion(Config.PACKAGE_VERSION);

    if (version_array[0] == 3 && (version_array[1] < 28 || version_array[1] >= 34)) {
        getLogger().debug(`Show IP can be enabled. Gjs version: '${Config.PACKAGE_VERSION}'`);
        return true;
    }
    getLogger().warning(`Show IP cannot be enabled. Gjs version: '${Config.PACKAGE_VERSION}'`);
    return false;
}
