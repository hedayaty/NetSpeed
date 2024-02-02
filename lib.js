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

// DEBUG const useful to debug on X11
const DEBUG = false;

/**
 * A Logger class with format
*/
export class Logger {

    static _formatMessage(message, file, func, line) {
        return `[${this.extension.metadata.uuid}:${file}:${func}:${line}] -> ${message}`;
    }

    static _makeMessage(message) {
        /* FIXME: rretrieve logging stack
        let stack = (new Error()).stack;
        let caller = stack.split('\n').pop();

        console.log(stack.split('\n'));

        // caller example: enable@file:///home/cosimo/.local/share/gnome-shell/extensions/netspeed@hedayaty.gmail.com/extension.js:35:24
        // or: resource:///org/gnome/Shell/
        const [func, caller] = caller.split(/@(.+)/);;
        const [code, line, _] = caller.split(':');
        */
        return Logger._formatMessage(message, "", "", "");
    }

    static init(extension) {
        if (Logger._domain)
            return;

        this.extension = extension;

        const { name: domain } = extension.metadata;
        Logger._domain = domain.replaceAll(' ', '-');
    }

    static debug(message) {
        Logger._logMessage(console.debug, message);
    }

    static info(message) {
        Logger._logMessage(console.info, message);
    }

    static warn(message) {
        Logger._logMessage(console.warn, message);
    }

    static error(message) {
        Logger._logMessage(console.critical, message);
    }

    static _logMessage(logFunc, message) {
        const msg = Logger._makeMessage(message);
        if (DEBUG) {
            console.log(msg);
            return;
        }

        logFunc(msg);
    }
}
