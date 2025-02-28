/**
*  @license
* Copyright 2021, JsData. All rights reserved.
*
* This source code is licensed under the MIT license found in the
* LICENSE file in the root directory of this source tree.

* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
* ==========================================================================
*/
import Series from "./series";

const MONTH_NAME = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_NAME = ["Sun", "Mon", "Tue", "Wed", "Thur", "Fri", "Sat"];

/**
 * Format and handle all datetime operations on Series or Array of date strings
 * @param data Series or Array of date strings
 */
export default class TimeSeries {

  constructor(data) {
    if (data instanceof Series) {
      this.$dateObjectArray = this.processData(data.values);
    } else {
      this.$dateObjectArray = this.processData(data);
    }
  }

  /**
     * Processed the data values into internal structure for easy access
     * @param dateArray An array of date strings
    */
  processData(dateArray) {
    const values = dateArray.map((dateString) => new Date(`${dateString}`));
    return values;
  }

  /**
     *  Returns the month, in local time.
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-01",
     * "2019-03-01",
     * "2019-04-01",
     * ]
     * const df = new Dataframe(data)
     * const dfNew = df.dt.month()
     * console.log(dfNew.values)
     * // [1, 2, 3, 4]
     * ```
    */
  month() {
    const newValues = this.$dateObjectArray.map((date) => date.getMonth());
    return new Series(newValues);
  }

  /**
     * Returns the day of the week, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-01",
     * "2019-03-01",
     * "2019-04-01",
     * ]
     * const df = new Dataframe(data)
     * const dayOfWeek = df.dt.day()
     * console.log(day.values)
     * ```
    */
  day() {
    const newValues = this.$dateObjectArray.map((date) => date.getDay());
    return new Series(newValues);
  }

  /**
     * Returns the year, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-01",
     * "2021-03-01",
     * "2020-04-01",
     * ]
     * const df = new Dataframe(data)
     * const year = df.dt.year()
     * console.log(year.values)
     * // [2019, 2019, 2021, 2020]
     * ```
    */
  year() {
    const newValues = this.$dateObjectArray.map((date) => date.getFullYear());
    return new Series(newValues);
  }

  /**
     *  Returns the name of the month, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-01",
     * "2021-03-01",
     * "2020-04-01",
     * ]
     * const df = new Dataframe(data)
     * const monthName = df.dt.monthName().values
     * console.log(monthName)
     * // ["January", "February", "March", "April"]
     * ```
    */
  month_name() {
    const newValues = this.$dateObjectArray.map((date) => MONTH_NAME[date.getMonth()]);
    return new Series(newValues);
  }

  /**
     * Returns the name of the day, of the week, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-01",
     * "2021-03-01",
     * "2020-04-01",
     * ]
     * const df = new Dataframe(data)
     * const dayOfWeekName = df.dt.dayOfWeekName().values
     * console.log(dayOfWeekName)
     * ```
    */
  weekdays() {
    const newValues = this.$dateObjectArray.map((date) => WEEK_NAME[date.getDay()]);
    return new Series(newValues);
  }

  /**
     * Returns the day of the month, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-05",
     * "2021-03-02",
     * "2020-04-01",
     * ]
     * const df = new Dataframe(data)
     * const dayOfMonth = df.dt.dayOfMonth().values
     * console.log(dayOfMonth)
     * // [1, 5, 2, 1]
     * ```
    */
  monthday() {
    const newValues = this.$dateObjectArray.map((date) => date.getDate());
    return new Series(newValues);
  }

  /**
     * Returns the hour of the day, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-05",
     * "2021-03-02",
     * "2020-04-01",
     * ]
     * const df = new Dataframe(data)
     * const hour = df.dt.hour().values
     * console.log(hour)
     * // [0, 0, 0, 0]
     * ```
    */
  hours() {
    const newValues = this.$dateObjectArray.map((date) => date.getHours());
    return new Series(newValues);
  }

  /**
     * Returns the second of the day, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-05",
     * "2021-03-02",
     * "2020-04-01",
     * ]
     * const df = new Dataframe(data)
     * const second = df.dt.second().values
     * console.log(second)
     * ```
    */
  seconds() {
    const newValues = this.$dateObjectArray.map((date) => date.getSeconds());
    return new Series(newValues);
  }

  /**
     * Returns the minute of the day, in local time
     * @example
     * ```
     * import { Dataframe } from "danfojs-node"
     * const data = [
     * "2019-01-01",
     * "2019-02-05",
     * "2021-03-02",
     * "2020-04-01",
     * ]
     * const df = new Dataframe(data)
     * const minute = df.dt.minute().values
     * console.log(minute)
     * ```
    */
  minutes() {
    const newValues = this.$dateObjectArray.map((date) => date.getMinutes());
    return new Series(newValues);
  }

}

export const toDateTime = (data) => {
  return new TimeSeries(data);
};
