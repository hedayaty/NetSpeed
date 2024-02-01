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


const NetSpeedMessage = GObject.registerClass(
  class NetSpeedMessage extends GObject.Object {
    constructor(props = {}) {
      super();
      this.set(props);
    }
  });

/*
 * {NetSpeedGlobalStatsMessage} object has the properties:
 *   {object} sum
 *   {object} up
 *   {object} down
 * 
 *  Each property has the properties:
 *   {string} text
 *   {string} unit 
 */
export const NetSpeedGlobalStatsMessage = GObject.registerClass(
  class NetSpeedGlobalStatsMessage extends NetSpeedMessage { }
);

/*
 * {NetSpeedSpeedsMessage} object has the properties:
 *   {array} speeds: an array of object with properies:
 *     {string} up
 *     {string} down
 */
export const NetSpeedSpeedsMessage = GObject.registerClass(
  class NetSpeedSpeedsMessage extends NetSpeedMessage { }
);

/*
 * {NetSpeedIPsMessage} object has the properties:
 *   {array} ips: an array of {string}s
 */
export const NetSpeedIPsMessage = GObject.registerClass(
  class NetSpeedIPsMessage extends NetSpeedMessage { }
);

/*
 * {NetSpeedMenuMessage} object has the properties:
 *   {array} devices_text: an array of {string}s
 *   {array} types: an array of {string}s
 */
export const NetSpeedMenuMessage = GObject.registerClass(
  class NetSpeedMenuMessage extends NetSpeedMessage { }
);