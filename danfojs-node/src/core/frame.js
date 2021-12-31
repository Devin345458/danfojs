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

import { variance, std, median, mode, mean } from 'mathjs';
import { DATA_TYPES } from '../shared/defaults';
import { scalar, tensor2d, data as tfData } from '@tensorflow/tfjs-node';
import { _genericMathOp } from "./math.ops";
import ErrorThrower from "../shared/errors";
import { _iloc, _loc } from "./indexing";
import { utils } from "../shared/utils";
import NDframe from "./generic";
import { table } from "table";
import Series from './series';
import { GroupBy } from "./groupby";
import dummyEncode from "./get_dummies";


// const utils = new Utils();

/**
 * Two-dimensional ndarray with axis labels.
 * The object supports both integer- and label-based indexing and provides a host of methods for performing operations involving the index.
 * Operations between DataFrame (+, -, /, , *) align values based on their associated index values– they need not be the same length.
 * @param data 2D Array, JSON, Tensor, Block of data.
 * @param options.index Array of numeric or string names for subseting array. If not specified, indexes are auto generated.
 * @param options.columns Array of column names. If not specified, column names are auto generated.
 * @param options.dtypes Array of data types for each the column. If not specified, dtypes are/is inferred.
 * @param options.config General configuration object for extending or setting NDframe behavior.
 */
/* @ts-ignore */ //COMMENT OUT WHEN METHODS HAVE BEEN IMPLEMENTED
export default class DataFrame extends NDframe {
  constructor(data, options) {
    const { index, columns, dtypes, config } = { index: undefined, columns: undefined, dtypes: undefined, config: undefined, ...options };
    super({ data, index, columns, dtypes, config, isSeries: false });
    this.$setInternalColumnDataProperty();
  }

  /**
     * Maps all column names to their corresponding data, and return them objects.
     * This makes column subsetting works. E.g this can work ==> `df["col1"]`
     * @param column Optional, a single column name to map
     */
  $setInternalColumnDataProperty(column) {
    const self = this;
    if (column && typeof column === "string") {
      Object.defineProperty(self, column, {
        get() {
          return self.$getColumnData(column);
        },
        set(arr) {
          self.$setColumnData(column, arr);
        }
      });
    } else {
      const columns = this.columns;
      for (let i = 0; i < columns.length; i++) {
        const column = columns[i];
        Object.defineProperty(this, column, {
          get() {
            return self.$getColumnData(column);
          },
          set(arr) {
            self.$setColumnData(column, arr);
          }
        });
      }
    }

  }

  /**
     * Returns the column data from the DataFrame by column name.
     * @param column column name to get the column data
     * @param returnSeries Whether to return the data in series format or not. Defaults to true
     */
  $getColumnData(column, returnSeries = true) {
    const columnIndex = this.columns.indexOf(column);

    if (columnIndex == -1) {
      ErrorThrower.throwColumnNotFoundError(this);
    }

    const dtypes = [this.$dtypes[columnIndex]];
    const index = [...this.$index];
    const columns = [column];
    const config = { ...this.$config };

    if (this.$config.isLowMemoryMode) {
      const data = [];
      for (let i = 0; i < this.values.length; i++) {
        const row = this.values[i];
        data.push(row[columnIndex]);
      }
      if (returnSeries) {
        return new Series(data, {
          dtypes,
          index,
          columns,
          config
        });
      } else {
        return data;
      }

    } else {
      const data = this.$dataIncolumnFormat[columnIndex];
      if (returnSeries) {
        return new Series(data, {
          dtypes,
          index,
          columns,
          config
        });
      } else {
        return data;
      }
    }

  }


  /**
     * Updates the internal column data via column name.
     * @param column The name of the column to update.
     * @param arr The new column data
 */
  $setColumnData(column, arr) {

    const columnIndex = this.$columns.indexOf(column);

    if (columnIndex == -1) {
      throw new Error(`ParamError: column ${column} not found in ${this.$columns}. If you need to add a new column, use the df.addColumn method. `);
    }

    let colunmValuesToAdd;

    if (arr instanceof Series) {
      colunmValuesToAdd = arr.values;
    } else if (Array.isArray(arr)) {
      colunmValuesToAdd = arr;
    } else {
      throw new Error("ParamError: specified value not supported. It must either be an Array or a Series of the same length");
    }

    if (colunmValuesToAdd.length !== this.shape[0]) {
      ErrorThrower.throwColumnLengthError(this, colunmValuesToAdd.length);
    }

    if (this.$config.isLowMemoryMode) {
      //Update row ($data) array
      for (let i = 0; i < this.$data.length; i++) {
        (this.$data)[i][columnIndex] = colunmValuesToAdd[i];
      }
      //Update the dtypes
      this.$dtypes[columnIndex] = utils.inferDtype(colunmValuesToAdd)[0];
    } else {
      //Update row ($data) array
      for (let i = 0; i < this.values.length; i++) {
        (this.$data)[i][columnIndex] = colunmValuesToAdd[i];
      }
      //Update column ($dataIncolumnFormat) array since it's available in object
      (this.$dataIncolumnFormat)[columnIndex] = arr;

      //Update the dtypes
      this.$dtypes[columnIndex] = utils.inferDtype(colunmValuesToAdd)[0];
    }

  }

  /**
     * Return data with missing values removed from a specified axis
     * @param axis 0 or 1. If 0, column-wise, if 1, row-wise
    */
  $getDataByAxisWithMissingValuesRemoved(axis) {
    const oldValues = this.$getDataArraysByAxis(axis);
    const cleanValues = [];
    for (let i = 0; i < oldValues.length; i++) {
      const values = oldValues[i];
      cleanValues.push(utils.removeMissingValuesFromArray(values));
    }
    return cleanValues;
  }

  /**
     * Return data aligned to the specified axis. Transposes the array if needed.
     * @param axis 0 or 1. If 0, column-wise, if 1, row-wise
    */
  $getDataArraysByAxis(axis) {
    axis = axis === 0 ? 1 : 0;
    if (axis === 1) {
      return this.values;
    } else {
      let dfValues;
      if (this.config.isLowMemoryMode) {
        dfValues = utils.transposeArray(this.values);
      } else {
        dfValues = this.$dataIncolumnFormat;
      }
      return dfValues;
    }
  }

  /*
    * checks if DataFrame is compactible for arithmetic operation
    * compatible Dataframe must have only numerical dtypes
    **/
  $frameIsNotCompactibleForArithmeticOperation() {
    const dtypes = this.dtypes;
    const str = (element) => element == "string";
    return dtypes.some(str);
  }

  /**
     * Return Tensors in the right axis for math operations.
     * @param other DataFrame or Series or number or array
     * @param axis 0 or 1. If 0, column-wise, if 1, row-wise
     * */
  $getTensorsForArithmeticOperationByAxis(
    other,
    axis
  ) {
    axis = axis === 0 ? 1 : 0;
    if (typeof other === "number") {
      return [this.tensor, scalar(other)];
    } else if (other instanceof DataFrame) {
      return [this.tensor, other.tensor];
    } else if (other instanceof Series) {
      if (axis === 1) {
        return [this.tensor, tensor2d(other.values, [other.shape[0], 1])];
      } else {
        return [this.tensor, tensor2d(other.values, [other.shape[0], 1]).transpose()];
      }
    } else if (Array.isArray(other)) {
      if (axis === 1) {
        return [this.tensor, tensor2d(other, [other.length, 1])];
      } else {
        return [this.tensor, tensor2d(other, [other.length, 1]).transpose()];
      }
    } else {
      throw new Error("ParamError: Invalid type for other parameter. other must be one of Series, DataFrame or number.");
    }

  }

  /**
     * Returns the dtype for a given column name
     * @param column
     */
  $getColumnDtype(column) {
    const columnIndex = this.columns.indexOf(column);
    if (columnIndex === -1) {
      throw Error(`ColumnNameError: Column "${column}" does not exist`);
    }
    return this.dtypes[columnIndex];
  }

  $logicalOps(tensors, operation) {
    let newValues = [];

    switch (operation) {
      case 'gt':
        newValues = tensors[0].greater(tensors[1]).arraySync();
        break;
      case 'lt':
        newValues = tensors[0].less(tensors[1]).arraySync();
        break;
      case 'ge':
        newValues = tensors[0].greaterEqual(tensors[1]).arraySync();
        break;
      case 'le':
        newValues = tensors[0].lessEqual(tensors[1]).arraySync();
        break;
      case 'eq':
        newValues = tensors[0].equal(tensors[1]).arraySync();
        break;
      case 'ne':
        newValues = tensors[0].notEqual(tensors[1]).arraySync();
        break;

    }

    const newData = utils.mapIntegersToBooleans(newValues, 2);
    return new DataFrame(
      newData,
      {
        index: [...this.index],
        columns: [...this.columns],
        dtypes: [...this.dtypes],
        config: { ...this.config }
      });
  }

  $MathOps(tensors, operation, inplace) {
    let tensorResult;

    switch (operation) {
      case 'add':
        tensorResult = tensors[0].add(tensors[1]);
        break;
      case 'sub':
        tensorResult = tensors[0].sub(tensors[1]);
        break;
      case 'pow':
        tensorResult = tensors[0].pow(tensors[1]);
        break;
      case 'div':
        tensorResult = tensors[0].div(tensors[1]);
        break;
      case 'mul':
        tensorResult = tensors[0].mul(tensors[1]);
        break;
      case 'mod':
        tensorResult = tensors[0].mod(tensors[1]);
        break;
    }

    if (inplace) {
      const newData = tensorResult.arraySync();
      this.$setValues(newData);
    } else {
      return new DataFrame(
        tensorResult,
        {
          index: [...this.index],
          columns: [...this.columns],
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });

    }
  }

  /**
    * Purely integer-location based indexing for selection by position.
    * ``.iloc`` is primarily integer position based (from ``0`` to
    * ``length-1`` of the axis), but may also be used with a boolean array.
    *
    * @param rows Array of row indexes
    * @param columns Array of column indexes
    *
    * Allowed inputs are in rows and columns params are:
    *
    * - An array of single integer, e.g. ``[5]``.
    * - A list or array of integers, e.g. ``[4, 3, 0]``.
    * - A slice array string with ints, e.g. ``["1:7"]``.
    * - A boolean array.
    * - A ``callable`` function with one argument (the calling Series or
    * DataFrame) and that returns valid output for indexing (one of the above).
    * This is useful in method chains, when you don't have a reference to the
    * calling object, but would like to base your selection on some value.
    *
    * ``.iloc`` will raise ``IndexError`` if a requested indexer is
    * out-of-bounds.
    */
  iloc(args) {
    const { rows, columns } = { rows: undefined, columns: undefined, ...args };
    return _iloc({ ndFrame: this, rows, columns });
  }


  /**
     * Access a group of rows and columns by label(s) or a boolean array.
     * ``loc`` is primarily label based, but may also be used with a boolean array.
     *
     * @param rows Array of row indexes
     * @param columns Array of column indexes
     *
     * Allowed inputs are:
     *
     * - A single label, e.g. ``["5"]`` or ``['a']``, (note that ``5`` is interpreted as a
     *   *label* of the index, and **never** as an integer position along the index).
     *
     * - A list or array of labels, e.g. ``['a', 'b', 'c']``.
     *
     * - A slice object with labels, e.g. ``["a:f"]``. Note that start and the stop are included
     *
     * - A boolean array of the same length as the axis being sliced,
     * e.g. ``[True, False, True]``.
     *
     * - A ``callable`` function with one argument (the calling Series or
     * DataFrame) and that returns valid output for indexing (one of the above)
    */
  loc(args) {
    const { rows, columns } = args;
    return _loc({ ndFrame: this, rows, columns });
  }

  /**
     * Prints DataFrame to console as a formatted grid of row and columns.
    */
  toString() {
    const maxRow = this.config.getMaxRow;
    const maxColToDisplayInConsole = this.config.getTableMaxColInConsole;

    // let data;
    const dataArr = [];
    const colLen = this.columns.length;

    let header = [];

    if (colLen > maxColToDisplayInConsole) {
      //truncate displayed columns to fit in the console
      let firstFourcolNames = this.columns.slice(0, 4);
      let lastThreecolNames = this.columns.slice(colLen - 4);
      //join columns with truncate ellipse in the middle
      header = ["", ...firstFourcolNames, "...", ...lastThreecolNames];

      let subIdx;
      let firstHalfValues;
      let lastHalfValueS;

      if (this.values.length > maxRow) {
        //slice Object to show [max_rows]
        let dfSubset1 = this.iloc({
          rows: [`0:${maxRow}`],
          columns: ["0:4"]
        });

        let dfSubset2 = this.iloc({
          rows: [`0:${maxRow}`],
          columns: [`${colLen - 4}:`]
        });

        subIdx = this.index.slice(0, maxRow);
        firstHalfValues = dfSubset1.values;
        lastHalfValueS = dfSubset2.values;

      } else {
        let dfSubset1 = this.iloc({ columns: ["0:4"] });
        let dfSubset2 = this.iloc({ columns: [`${colLen - 4}:`] });

        subIdx = this.index.slice(0, maxRow);
        firstHalfValues = dfSubset1.values;
        lastHalfValueS = dfSubset2.values;
      }

      // merge subset
      for (let i = 0; i < subIdx.length; i++) {
        const idx = subIdx[i];
        const row = [idx, ...firstHalfValues[i], "...", ...lastHalfValueS[i]];
        dataArr.push(row);
      }

    } else {
      //display all columns
      header = ["", ...this.columns];
      let subIdx;
      let values;
      if (this.values.length > maxRow) {
        //slice Object to show a max of [max_rows]
        let data = this.iloc({ rows: [`0:${maxRow}`] });
        subIdx = data.index;
        values = data.values;
      } else {
        values = this.values;
        subIdx = this.index;
      }

      // merge subset
      for (let i = 0; i < subIdx.length; i++) {
        const idx = subIdx[i];
        const row = [idx, ...values[i]];
        dataArr.push(row);
      }
    }


    const columnsConfig = {};
    columnsConfig[0] = { width: 10 }; //set column width for index column

    for (let index = 1; index < header.length; index++) {
      columnsConfig[index] = { width: 17, truncate: 16 };
    }

    const tableData = [header, ...dataArr]; //Adds the column names to values before printing

    return table(tableData, { columns: columnsConfig, ...this.config.getTableDisplayConfig });
  }

  /**
      * Returns the first n values in a DataFrame
      * @param rows The number of rows to return
    */
  head(rows = 5) {
    if (rows > this.shape[0]) {
      throw new Error("ParamError of rows cannot be greater than available rows in data");
    }
    if (rows <= 0) {
      throw new Error("ParamError of rows cannot be less than 1");
    }

    return this.iloc({ rows: [`0:${rows}`] });
  }

  /**
      * Returns the last n values in a DataFrame
      * @param rows The number of rows to return
    */
  tail(rows = 5) {
    if (rows > this.shape[0]) {
      throw new Error("ParamError of rows cannot be greater than available rows in data");
    }
    if (rows <= 0) {
      throw new Error("ParamError of rows cannot be less than 1");
    }
    rows = this.shape[0] - rows;
    return this.iloc({ rows: [`${rows}:`] });
  }

  /**
     * Gets n number of random rows in a dataframe. Sample is reproducible if seed is provided.
     * @param num The number of rows to return. Default to 5.
     * @param options.seed An integer specifying the random seed that will be used to create the distribution.
    */
  async sample(num = 5, options) {
    const { seed } = { seed: 1, ...options };

    if (num > this.shape[0]) {
      throw new Error("ParamError: Sample size cannot be bigger than number of rows");
    }
    if (num <= 0) {
      throw new Error("ParamError: Sample size cannot be less than 1");
    }

    const shuffledIndex = await tfData.array(this.index).shuffle(num, `${seed}`).take(num).toArray();
    const df = this.iloc({ rows: shuffledIndex });
    return df;
  }

  /**
     * Return Addition of DataFrame and other, element-wise (binary operator add).
     * @param other DataFrame, Series, Array or Scalar number to add
     * @param options.axis 0 or 1. If 0, add column-wise, if 1, add row-wise
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  add(other, options) {
    const { inplace, axis } = { inplace: false, axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: add operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$MathOps(tensors, "add", inplace);
  }

  /**
     * Return substraction between DataFrame and other.
     * @param other DataFrame, Series, Array or Scalar number to substract from DataFrame
     * @param options.axis 0 or 1. If 0, compute the subtraction column-wise, if 1, row-wise
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  sub(other, options) {
    const { inplace, axis } = { inplace: false, axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: sub operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$MathOps(tensors, "sub", inplace);


  }
  /**
     * Return multiplciation between DataFrame and other.
     * @param other DataFrame, Series, Array or Scalar number to multiply with.
     * @param options.axis 0 or 1. If 0, compute the multiplication column-wise, if 1, row-wise
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  mul(other, options) {
    const { inplace, axis } = { inplace: false, axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: mul operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }
    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$MathOps(tensors, "mul", inplace);


  }

  /**
     * Return division of DataFrame with other.
     * @param other DataFrame, Series, Array or Scalar number to divide with.
     * @param options.axis 0 or 1. If 0, compute the division column-wise, if 1, row-wise
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  div(other, options) {
    const { inplace, axis } = { inplace: false, axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: div operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$MathOps(tensors, "div", inplace);


  }

  /**
     * Return DataFrame raised to the power of other.
     * @param other DataFrame, Series, Array or Scalar number to to raise to.
     * @param options.axis 0 or 1. If 0, compute the power column-wise, if 1, row-wise
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  pow(other, options) {
    const { inplace, axis } = { inplace: false, axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: pow operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$MathOps(tensors, "pow", inplace);


  }

  /**
     * Return modulus between DataFrame and other.
     * @param other DataFrame, Series, Array or Scalar number to modulus with.
     * @param options.axis 0 or 1. If 0, compute the mod column-wise, if 1, row-wise
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  mod(other, options) {
    const { inplace, axis } = { inplace: false, axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: mod operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$MathOps(tensors, "mod", inplace);

  }

  /**
     * Return mean of DataFrame across specified axis.
     * @param options.axis 0 or 1. If 0, compute the mean column-wise, if 1, row-wise. Defaults to 1
    */
  mean(options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: mean operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);
    const meanArr = newData.map((arr) => arr.reduce((a, b) => a + b, 0) / arr.length);
    if (axis === 1) {
      return new Series(meanArr, { index: this.columns });
    } else {
      return new Series(meanArr, { index: this.index });
    }
  }

  /**
     * Return median of DataFrame across specified axis.
     * @param options.axis 0 or 1. If 0, compute the median column-wise, if 1, row-wise. Defaults to 1
    */
  median(options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: median operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);
    const medianArr = newData.map((arr) => median(arr));
    if (axis === 1) {
      return new Series(medianArr, { index: this.columns });
    } else {
      return new Series(medianArr, { index: this.index });
    }

  }

  /**
     * Return mode of DataFrame across specified axis.
     * @param options.axis 0 or 1. If 0, compute the mode column-wise, if 1, row-wise. Defaults to 1
     * @param options.keep If there are more than one modes, returns the mode at position [keep]. Defaults to 0
    */
  mode(options) {
    const { axis, keep } = { axis: 1, keep: 0, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: mode operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);
    const modeArr = newData.map((arr) => {
      const tempMode = mode(arr);
      if (tempMode.length === 1) {
        return tempMode[0];
      } else {
        return tempMode[keep];
      }
    });
    if (axis === 1) {
      return new Series(modeArr, { index: this.columns });
    } else {
      return new Series(modeArr, { index: this.index });
    }
  }

  /**
     * Return minimum of values in a DataFrame across specified axis.
     * @param options.axis 0 or 1. If 0, compute the minimum value column-wise, if 1, row-wise. Defaults to 1
    */
  min(options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: min operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);

    const minArr = newData.map((arr) => {
      let smallestValue = arr[0];
      for (let i = 0; i < arr.length; i++) {
        smallestValue = smallestValue < arr[i] ? smallestValue : arr[i];
      }
      return smallestValue;
    });

    if (axis === 1) {
      return new Series(minArr, { index: this.columns });
    } else {
      return new Series(minArr, { index: this.index });
    }

  }

  /**
     * Return maximum of values in a DataFrame across specified axis.
     * @param options.axis 0 or 1. If 0, compute the maximum column-wise, if 1, row-wise. Defaults to 1
    */
  max(options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: max operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);

    const maxArr = newData.map((arr) => {
      let biggestValue = arr[0];
      for (let i = 0; i < arr.length; i++) {
        biggestValue = biggestValue > arr[i] ? biggestValue : arr[i];
      }
      return biggestValue;
    });

    if (axis === 1) {
      return new Series(maxArr, { index: this.columns });
    } else {
      return new Series(maxArr, { index: this.index });
    }

  }

  /**
     * Return standard deviation of values in a DataFrame across specified axis.
     * @param options.axis 0 or 1. If 0, compute the standard deviation column-wise, if 1, row-wise. Defaults to 1
    */
  std(options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: std operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);
    const stdArr = newData.map((arr) => std(arr));

    if (axis === 1) {
      return new Series(stdArr, { index: this.columns });
    } else {
      return new Series(stdArr, { index: this.index });
    }

  }

  /**
     * Return variance of values in a DataFrame across specified axis.
     * @param options.axis 0 or 1. If 0, compute the variance column-wise, if 1, add row-wise. Defaults to 1
    */
  var(options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: var operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);
    const varArr = newData.map((arr) => variance(arr));
    if (axis === 1) {
      return new Series(varArr, { index: this.columns });
    } else {
      return new Series(varArr, { index: this.index });
    }
  }

  /**
     * Get Less than of dataframe and other, element-wise (binary operator lt).
     * @param other DataFrame, Series, Array or Scalar number to compare with
     * @param options.axis 0 or 1. If 0, add column-wise, if 1, add row-wise
    */
  lt(other, options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: lt operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$logicalOps(tensors, "lt");
  }

  /**
     * Returns "greater than" of dataframe and other.
     * @param other DataFrame, Series, Array or Scalar number to compare with
     * @param options.axis 0 or 1. If 0, add column-wise, if 1, add row-wise
    */
  gt(other, options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: gt operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$logicalOps(tensors, "gt");
  }

  /**
     * Returns "equals to" of dataframe and other.
     * @param other DataFrame, Series, Array or Scalar number to compare with
     * @param options.axis 0 or 1. If 0, add column-wise, if 1, add row-wise
    */
  eq(other, options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: eq operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$logicalOps(tensors, "eq");
  }

  /**
     * Returns "not equal to" of dataframe and other.
     * @param other DataFrame, Series, Array or Scalar number to compare with
     * @param options.axis 0 or 1. If 0, add column-wise, if 1, add row-wise
    */
  ne(other, options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: ne operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$logicalOps(tensors, "ne");
  }

  /**
    * Returns "less than or equal to" of dataframe and other.
    * @param other DataFrame, Series, Array or Scalar number to compare with
    * @param options.axis 0 or 1. If 0, add column-wise, if 1, add row-wise
    */
  le(other, options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: le operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$logicalOps(tensors, "le");
  }

  /**
    * Returns "greater than or equal to" between dataframe and other.
    * @param other DataFrame, Series, Array or Scalar number to compare with
    * @param options.axis 0 or 1. If 0, add column-wise, if 1, add row-wise
    */
  ge(other, options) {
    const { axis } = { axis: 1, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: ge operation is not supported for string dtypes");
    }

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const tensors = this.$getTensorsForArithmeticOperationByAxis(other, axis);
    return this.$logicalOps(tensors, "ge");
  }

  /**
     * Return number of non-null elements in a Series
     * @param options.axis 0 or 1. If 0, count column-wise, if 1, add row-wise. Defaults to 1
    */
  count(options) {
    const { axis } = { axis: 1, ...options };

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newData = this.$getDataByAxisWithMissingValuesRemoved(axis);
    const countArr = newData.map((arr) => arr.length);

    if (axis === 1) {
      return new Series(countArr, { index: this.columns });
    } else {
      return new Series(countArr, { index: this.index });
    }

  }

  /**
     * Return the sum of values across an axis.
     * @param options.axis 0 or 1. If 0, count column-wise, if 1, add row-wise. Defaults to 1
    */
  sum(options) {
    const { axis } = { axis: 1, ...options };

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const result = this.$getDataByAxisWithMissingValuesRemoved(axis);
    const sumArr = result.map((innerArr) => {
      return innerArr.reduce((a, b) => Number(a) + Number(b), 0);
    });
    if (axis === 1) {
      return new Series(sumArr, {
        index: [...this.columns]
      });
    } else {
      return new Series(sumArr, {
        index: [...this.index]
      });
    }

  }

  /**
     * Return the absolute value of elements in a DataFrame.
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  abs(options) {
    const { inplace } = { inplace: false, ...options };

    const newData = (this.values).map((arr) => arr.map((val) => Math.abs(val)));
    if (inplace) {
      this.$setValues(newData);
    } else {
      return new DataFrame(newData, {
        index: [...this.index],
        columns: [...this.columns],
        dtypes: [...this.dtypes],
        config: { ...this.config }
      });
    }
  }

  /**
     * Rounds all element in the DataFrame to specified number of decimal places.
     * @param dp Number of decimal places to round to. Defaults to 1
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  round(dp = 1, options) {
    const { inplace } = { inplace: false, ...options };

    if (this.$frameIsNotCompactibleForArithmeticOperation()) {
      throw Error("TypeError: round operation is not supported for string dtypes");
    }

    if (typeof dp !== "number") {
      throw Error("ParamError: dp must be a number");
    }

    const newData = utils.round(this.values, dp, false);

    if (inplace) {
      this.$setValues(newData);
    } else {
      return new DataFrame(
        newData,
        {
          index: [...this.index],
          columns: [...this.columns],
          config: { ...this.config }
        });
    }
  }

  /**
     * Returns cumulative product accross specified axis.
     * @param options.axis 0 or 1. If 0, count column-wise, if 1, add row-wise. Defaults to 1
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  cumprod(options) {
    const { axis, inplace } = { axis: 1, inplace: false, ...options };
    return this.cumOps("prod", axis, inplace);
  }

  /**
     * Returns cumulative sum accross specified axis.
     * @param options.axis 0 or 1. If 0, count column-wise, if 1, add row-wise. Defaults to 1
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  cumsum(options) {
    const { axis, inplace } = { axis: 1, inplace: false, ...options };
    return this.cumOps("sum", axis, inplace);
  }

  /**
     * Returns cumulative minimum accross specified axis.
     * @param options.axis 0 or 1. If 0, count column-wise, if 1, add row-wise. Defaults to 1
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  cummin(options) {
    const { axis, inplace } = { axis: 1, inplace: false, ...options };
    return this.cumOps("min", axis, inplace);
  }

  /**
     * Returns cumulative maximum accross specified axis.
     * @param options.axis 0 or 1. If 0, count column-wise, if 1, add row-wise. Defaults to 1
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  cummax(options) {
    const { axis, inplace } = { axis: 1, inplace: false, ...options };
    return this.cumOps("max", axis, inplace);
  }

  /**
     * Internal helper function for cumulative operation on DataFrame
    */
  cumOps(ops, axis, inplace) {
    if (this.dtypes.includes("string")) ErrorThrower.throwStringDtypeOperationError(ops);

    const result = this.$getDataByAxisWithMissingValuesRemoved(axis);

    let newData = result.map((sData) => {
      let tempval = sData[0];
      const data = [tempval];

      for (let i = 1; i < sData.length; i++) {
        let currVal = sData[i];
        switch (ops) {
          case "max":
            if (currVal > tempval) {
              data.push(currVal);
              tempval = currVal;
            } else {
              data.push(tempval);
            }
            break;
          case "min":
            if (currVal < tempval) {
              data.push(currVal);
              tempval = currVal;
            } else {
              data.push(tempval);
            }
            break;
          case "sum":
            tempval = (tempval) + (currVal);
            data.push(tempval);
            break;
          case "prod":
            tempval = (tempval) * (currVal);
            data.push(tempval);
            break;

        }
      }
      return data;
    });

    if (axis === 1) {
      newData = utils.transposeArray(newData);
    }

    if (inplace) {
      this.$setValues(newData);
    } else {
      return new DataFrame(newData, {
        index: [...this.index],
        columns: [...this.columns],
        dtypes: [...this.dtypes],
        config: { ...this.config }
      });
    }
  }

  /**
     * Generate descriptive statistics for all numeric columns
     * Descriptive statistics include those that summarize the central tendency,
     * dispersion and shape of a dataset’s distribution, excluding NaN values.
     * @returns {Series}
     */
  describe() {
    const numericColumnNames = this.columns.filter((name) => this.$getColumnDtype(name) !== "string");
    const index = ["count", "mean", "std", "min", "median", "max", "variance"];
    const statsObject = {};
    for (let i = 0; i < numericColumnNames.length; i++) {
      const colName = numericColumnNames[i];
      const $count = (this.$getColumnData(colName)).count();
      const $mean = mean(this.$getColumnData(colName, false));
      const $std = std(this.$getColumnData(colName, false));
      const $min = (this.$getColumnData(colName)).min();
      const $median = median(this.$getColumnData(colName, false));
      const $max = (this.$getColumnData(colName)).max();
      const $variance = variance(this.$getColumnData(colName, false));

      const stats = [$count, $mean, $std, $min, $median, $max, $variance];
      statsObject[colName] = stats;

    }

    const df = new DataFrame(statsObject, { index });
    return df;
  }

  /**
     * Drops all rows or columns with missing values (NaN)
     * @param axis 0 or 1. If 0, drop columns with NaNs, if 1, drop rows with NaNs
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  dropna(axis = 1, options) {
    const { inplace } = { inplace: false, ...options };

    if ([0, 1].indexOf(axis) === -1) {
      throw Error("ParamError: Axis must be 0 or 1");
    }

    const newIndex = [];

    if (axis == 0) {
      const newData = [];

      const dfValues = this.values;
      for (let i = 0; i < dfValues.length; i++) {
        const values = dfValues[i];
        if (!values.includes(NaN) && !values.includes(undefined) && !values.includes(null)) {
          newData.push(values);
          newIndex.push(this.index[i]);
        }
      }

      if (inplace) {
        this.$setValues(newData, false);
        this.$setIndex(newIndex);
      } else {
        return new DataFrame(
          newData,
          {
            index: newIndex,
            columns: [...this.columns],
            dtypes: [...this.dtypes],
            config: { ...this.config }
          });
      }

    } else {
      const newColumnNames = [];
      const newDtypes = [];
      let dfValues = [];

      if (this.config.isLowMemoryMode) {
        dfValues = utils.transposeArray(this.values);
      } else {
        dfValues = this.$dataIncolumnFormat;
      }
      const tempColArr = [];

      for (let i = 0; i < dfValues.length; i++) {
        const values = dfValues[i];
        if (!values.includes(NaN)) {
          tempColArr.push(values);
          newColumnNames.push(this.columns[i]);
          newDtypes.push(this.dtypes[i]);
        }
      }

      const newData = utils.transposeArray(tempColArr);

      if (inplace) {
        this.$setValues(newData, false, false);
        this.$setColumnNames(newColumnNames);
        this.$setDtypes(newDtypes);
      } else {
        return new DataFrame(
          newData,
          {
            index: [...this.index],
            columns: newColumnNames,
            dtypes: newDtypes,
            config: { ...this.config }
          });
      }
    }

  }

  /**
     * Adds a new column to the DataFrame. If column exists, then the column values is replaced.
     * @param column The name of the column to add or replace.
     * @param values An array of values to be inserted into the DataFrame. Must be the same length as the columns
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  addColumn(options) {
    const { column, values, inplace } = { inplace: false, ...options };

    if (!column) {
      throw new Error("ParamError: column must be specified");
    }

    if (!values) {
      throw new Error("ParamError: values must be specified");
    }

    const columnIndex = this.$columns.indexOf(column);

    if (columnIndex === -1) {
      let colunmValuesToAdd;

      if (values instanceof Series) {
        colunmValuesToAdd = values.values;
      } else if (Array.isArray(values)) {
        colunmValuesToAdd = values;
      } else {
        throw new Error("ParamError: specified value not supported. It must either be an Array or a Series of the same length");
      }

      if (colunmValuesToAdd.length !== this.shape[0]) {
        ErrorThrower.throwColumnLengthError(this, colunmValuesToAdd.length);
      }

      const newData = [];
      const oldValues = this.$data;
      for (let i = 0; i < oldValues.length; i++) {
        const innerArr = [...oldValues[i]];
        innerArr.push(colunmValuesToAdd[i]);
        newData.push(innerArr);
      }

      if (inplace) {
        this.$setValues(newData, true, false);
        this.$setColumnNames([...this.columns, column]);
        this.$setInternalColumnDataProperty(column);

      } else {
        const df = new DataFrame(newData, {
          index: [...this.index],
          columns: [...this.columns, column],
          dtypes: [...this.dtypes, utils.inferDtype(colunmValuesToAdd)[0]],
          config: { ...this.$config }
        });
        return df;
      }
    } else {
      this.$setColumnData(column, values);
    }

  }

  /**
     * Makes a new copy of a DataFrame
     */
  copy() {
    let df = new DataFrame([...this.$data], {
      columns: [...this.columns],
      index: [...this.index],
      dtypes: [...this.dtypes],
      config: { ...this.$config }
    });
    return df;
  }

  /**
     * Return a boolean same-sized object indicating where elements are empty (NaN, undefined, null).
     * NaN, undefined and null values gets mapped to true, and everything else gets mapped to false.
    */
  isna() {
    const newData = [];
    for (let i = 0; i < this.values.length; i++) {
      const valueArr = this.values[i];
      const tempData = valueArr.map((value) => {
        if (utils.isEmpty(value)) {
          return true;
        } else {
          return false;
        }
      });
      newData.push(tempData);
    }

    const df = new DataFrame(newData,
      {
        index: [...this.index],
        columns: [...this.columns],
        config: { ...this.config }
      });
    return df;
  }

  /**
    * Replace all empty elements with a specified value. Replace params expect columns array to map to values array.
    * @param columns The list of column names to be replaced
    * @param options.values The list of values to use for replacement.
    * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  fillna(values, options) {
    let { columns, inplace } = { inplace: false, ...options };

    if (values === [] || typeof values === "undefined") {
      throw Error('ParamError: value must be specified');
    }

    if (Array.isArray(values)) {
      if (!Array.isArray(columns)) {
        throw Error('ParamError: value is an array, hence columns must also be an array of same length');
      }

      if (values.length !== columns.length) {
        throw Error('ParamError: specified column and values must have the same length');
      }

      columns.forEach((col) => {
        if (!this.columns.includes(col)) {
          throw Error(
            `ValueError: Specified column "${col}" must be one of ${this.columns}`
          );
        }
      });
    }

    const newData = [];
    const oldValues = [...this.values];

    if (!columns) {
      //Fill all columns
      for (let i = 0; i < oldValues.length; i++) {
        const valueArr = [...oldValues[i]];

        const tempArr = valueArr.map((innerVal) => {
          if (utils.isEmpty(innerVal)) {
            const replaceWith = Array.isArray(values) ? values[i] : values;
            return replaceWith;
          } else {
            return innerVal;
          }
        });
        newData.push(tempArr);
      }

    } else {
      //Fill specific columns
      const tempData = [...this.values];

      for (let i = 0; i < tempData.length; i++) {
        const valueArr = tempData[i];

        for (let i = 0; i < columns.length; i++) { //B
          const columnIndex = this.columns.indexOf(columns[i]);
          const replaceWith = Array.isArray(values) ? values[i] : values;
          valueArr[columnIndex] = utils.isEmpty(valueArr[columnIndex]) ? replaceWith : valueArr[columnIndex];
        }
        newData.push(valueArr);
      }
    }

    if (inplace) {
      this.$setValues(newData);
    } else {
      const df = new DataFrame(newData,
        {
          index: [...this.index],
          columns: [...this.columns],
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });
      return df;
    }
  }

  /**
    * Drop columns or rows with missing values. Missing values are NaN, undefined or null.
    * @param options.columns Array of column names to drop
    * @param options.index Array of index to drop
    * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  drop(options) {
    let { columns, index, inplace } = { inplace: false, ...options };

    if (!columns && !index) {
      throw Error('ParamError: Must specify one of columns or index');
    }

    if (columns && index) {
      throw Error('ParamError: Can only specify one of columns or index');
    }

    if (columns) {
      const columnIndices = [];

      if (typeof columns === "string") {
        columnIndices.push(this.columns.indexOf(columns));
      } else if (Array.isArray(columns)) {
        for (let column of columns) {
          if (this.columns.indexOf(column) === -1) {
            throw Error(`ParamError: specified column "${column}" not found in columns`);
          }
          columnIndices.push(this.columns.indexOf(column));
        }

      } else {
        throw Error('ParamError: columns must be an array of column names or a string of column name');
      }

      let newRowData = [];
      let newColumnNames = [];
      let newDtypes = [];

      for (let i = 0; i < this.values.length; i++) {
        const tempInnerArr = [];
        const innerArr = this.values[i];
        for (let j = 0; j < innerArr.length; j++) {
          if (!(columnIndices.includes(j))) {
            tempInnerArr.push(innerArr[j]);
          }
        }
        newRowData.push(tempInnerArr);
      }

      for (let i = 0; i < this.columns.length; i++) {
        const element = this.columns[i];
        if (!(columns.includes(element))) {
          newColumnNames.push(element);
          newDtypes.push(this.dtypes[i]);
        }
      }

      if (inplace) {
        this.$setValues(newRowData, true, false);
        this.$setColumnNames(newColumnNames);
      } else {
        const df = new DataFrame(newRowData,
          {
            index: [...this.index],
            columns: newColumnNames,
            dtypes: newDtypes,
            config: { ...this.config }
          });
        return df;
      }

    }

    if (index) {
      const rowIndices = [];

      if (typeof index === "string" || typeof index === "number" || typeof index === "boolean") {
        rowIndices.push(this.index.indexOf(index));
      } else if (Array.isArray(index)) {
        for (let indx of index) {
          if (this.index.indexOf(indx) === -1) {
            throw Error(`ParamError: specified index "${indx}" not found in indices`);
          }
          rowIndices.push(this.index.indexOf(indx));
        }
      } else {
        throw Error('ParamError: index must be an array of indices or a scalar index');
      }

      let newRowData = [];
      let newIndex = [];

      for (let i = 0; i < this.values.length; i++) {
        const innerArr = this.values[i];
        if (!(rowIndices.includes(i))) {
          newRowData.push(innerArr);
        }
      }

      for (let i = 0; i < this.index.length; i++) {
        const indx = this.index[i];
        if (!(index.includes(indx))) {
          newIndex.push(indx);
        }
      }

      if (inplace) {
        this.$setValues(newRowData, false);
        this.$setIndex(newIndex);
      } else {
        const df = new DataFrame(newRowData,
          {
            index: newIndex,
            columns: [...this.columns],
            dtypes: [...this.dtypes],
            config: { ...this.config }
          });
        return df;
      }
    }

  }

  /**
    * Sorts a Dataframe by a specified column values
    * @param options.column Column name to sort by
    * @param options.ascending Whether to sort values in ascending order or not. Defaults to true
    * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  sort_values(options) {
    const { by, ascending, inplace } = { by: undefined, ascending: true, inplace: false, ...options };

    if (!by) {
      throw Error(`ParamError: must specify a column to sort by`);
    }

    if (this.columns.indexOf(by) === -1) {
      throw Error(`ParamError: specified column "${by}" not found in columns`);
    }

    const columnValues = this.$getColumnData(by, false);
    const index = [...this.index];

    const objToSort = columnValues.map((value, i) => {
      return { index: index[i], value };
    });

    const sortedObjectArr = utils.sortObj(objToSort, ascending);
    const sortedIndex = sortedObjectArr.map((obj) => obj.index);

    const newDf = _loc({ ndFrame: this, rows: sortedIndex });

    if (inplace) {
      this.$setValues(newDf.values);
      this.$setIndex(newDf.index);
    } else {
      return newDf;
    }

  }

  /**
       * Sets the index of the DataFrame to the specified index.
       * @param options.index An array of index values to set
       * @param options.column A column name to set the index to
       * @param options.drop Whether to drop the column whose index was set. Defaults to false
       * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  set_index(options) {
    const { index, column, drop, inplace } = { drop: false, inplace: false, ...options };

    if (!index && !column) {
      throw new Error("ParamError: must specify either index or column");
    }

    let newIndex = [];

    if (index) {
      if (!Array.isArray(index)) {
        throw Error(`ParamError: index must be an array`);
      }

      if (index.length !== this.values.length) {
        throw Error(`ParamError: index must be the same length as the number of rows`);
      }
      newIndex = index;
    }

    if (column) {
      if (this.columns.indexOf(column) === -1) {
        throw Error(`ParamError: column not found in column names`);
      }

      newIndex = this.$getColumnData(column, false);
    }

    if (drop) {
      const dfDropped = this.drop({ columns: [column] });

      const newData = dfDropped.values;
      const newColumns = dfDropped.columns;
      const newDtypes = dfDropped.dtypes;

      if (inplace) {
        this.$setValues(newData, true, false);
        this.$setIndex(newIndex);
        this.$setColumnNames(newColumns);
      } else {
        const df = new DataFrame(newData,
          {
            index: newIndex,
            columns: newColumns,
            dtypes: newDtypes,
            config: { ...this.config }
          });
        return df;
      }
    } else {
      if (inplace) {
        this.$setIndex(newIndex);
      } else {
        const df = new DataFrame(this.values,
          {
            index: newIndex,
            columns: [...this.columns],
            dtypes: [...this.dtypes],
            config: { ...this.config }
          });
        return df;
      }
    }

  }

  /**
       * Resets the index of the DataFrame to the default index.
       * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  reset_index(options) {
    const { inplace } = { inplace: false, ...options };

    if (inplace) {
      this.$resetIndex();
    } else {
      const df = new DataFrame(this.values,
        {
          index: this.index.map((_, i) => i),
          columns: [...this.columns],
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });
      return df;
    }

  }

  /**
     * Apply a function along an axis of the DataFrame. To apply a function element-wise, use `applyMap`.
     * Objects passed to the function are Series values whose
     * index is either the DataFrame’s index (axis=0) or the DataFrame’s columns (axis=1)
     * @param callable Function to apply to each column or row
     * @param options.axis 0 or 1. If 0, compute the power column-wise, if 1, row-wise
    */
  apply(callable, options) {
    const { axis } = { axis: 1, ...options };

    if ([0, 1].indexOf(axis) === -1) {
      throw Error(`ParamError: axis must be 0 or 1`);
    }

    const valuesForFunc = this.$getDataByAxisWithMissingValuesRemoved(axis);

    const result = valuesForFunc.map((row) => {
      return callable(row);
    });

    if (axis === 1) {
      if (utils.is1DArray(result)) {
        return new Series(result, {
          index: [...this.columns]
        });
      } else {
        return new DataFrame(result, {
          index: [...this.columns],
          columns: [...this.columns],
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });
      }
    } else {
      if (utils.is1DArray(result)) {
        return new Series(result, {
          index: [...this.index]
        });
      } else {
        return new DataFrame(result, {
          index: [...this.index],
          columns: [...this.columns],
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });
      }
    }

  }

  /**
     * Apply a function to a Dataframe values element-wise.
     * @param callable Function to apply to each column or row
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  apply_map(callable, options) {
    const { inplace } = { inplace: false, ...options };

    const newData = this.values.map((row) => {
      const tempData = row.map((val) => {
        return callable(val);
      });
      return tempData;
    });

    if (inplace) {
      this.$setValues(newData);
    } else {
      return new DataFrame(newData,
        {
          index: [...this.index],
          columns: [...this.columns],
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });
    }
  }

  /**
     * Returns the specified column data as a Series object.
     * @param column The name of the column to return
    */
  column(column) {
    return this.$getColumnData(column);
  }

  /**
     * Return a subset of the DataFrame’s columns based on the column dtypes.
     * @param include An array of dtypes or strings to be included.
    */
  select_dtypes(include) {
    const supportedDtypes = ["float32", "int32", "string", "boolean", 'undefined'];

    if (Array.isArray(include) === false) {
      throw Error(`ParamError: include must be an array`);
    }

    include.forEach((dtype) => {
      if (supportedDtypes.indexOf(dtype) === -1) {
        throw Error(`ParamError: include must be an array of valid dtypes`);
      }
    });
    const newColumnNames = [];

    for (let i = 0; i < this.dtypes.length; i++) {
      if (include.includes(this.dtypes[i])) {
        newColumnNames.push(this.columns[i]);
      }
    }
    return this.loc({ columns: newColumnNames });

  }

  /**
     * Returns the transposes the DataFrame.
     **/
  transpose(options) {
    const { inplace } = { inplace: false, ...options };
    const newData = utils.transposeArray(this.values);
    const newColNames = [...this.index.map((i) => i.toString())];

    if (inplace) {
      this.$setValues(newData, false, false);
      this.$setIndex([...this.columns]);
      this.$setColumnNames(newColNames);
    } else {
      return new DataFrame(newData, {
        index: [...this.columns],
        columns: newColNames,
        config: { ...this.config }
      });
    }
  }

  /**
     * Returns the Transpose of the DataFrame. Similar to `transpose`, but does not change the original DataFrame.
    **/
  get T() {
    const newData = utils.transposeArray(this.values);
    return new DataFrame(newData, {
      index: [...this.columns],
      columns: [...this.index.map((i) => i.toString())],
      config: { ...this.config }
    });
  }

  /**
      * Replace all occurence of a value with a new value
      * @param oldValue The value you want to replace
      * @param newValue The new value you want to replace the old value with
      * @param options.columns An array of column names you want to replace. If not provided replace accross all columns.
      * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    */
  replace(
    oldValue,
    newValue,
    options
  ) {
    const { columns, inplace } = { inplace: false, ...options };

    if (!oldValue && typeof oldValue !== 'boolean') {
      throw Error(`Params Error: Must specify param 'oldValue' to replace`);
    }

    if (!newValue && typeof newValue !== 'boolean') {
      throw Error(`Params Error: Must specify param 'newValue' to replace with`);
    }

    let newData = [];

    if (columns) {
      if (!Array.isArray(columns)) {
        throw Error(`Params Error: column must be an array of column(s)`);
      }
      const columnIndex = [];

      columns.forEach((column) => {
        const _indx = this.columns.indexOf(column);
        if (_indx === -1) {
          throw Error(`Params Error: column not found in columns`);
        }
        columnIndex.push(_indx);
      });

      newData = (this.values).map(([...row]) => {
        for (const colIndx of columnIndex) {
          if (row[colIndx] === oldValue) {
            row[colIndx] = newValue;
          }
        }
        return row;
      });
    } else {
      newData = (this.values).map(([...row]) => {
        return row.map(((cell) => {
          if (cell === oldValue) {
            return newValue;
          } else {
            return cell;
          }
        }));
      });
    }

    if (inplace) {
      this.$setValues(newData);
    } else {
      return new DataFrame(newData, {
        index: [...this.index],
        columns: [...this.columns],
        dtypes: [...this.dtypes],
        config: { ...this.config }
      });
    }
  }


  /**
     * Cast the values of a column to specified data type
     * @param column The name of the column to cast
     * @param dtype Data type to cast to. One of [float32, int32, string, boolean]
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
     */
  astype(options) {
    const { inplace, column, dtype } = { inplace: false, ...options };
    const columnIndex = this.columns.indexOf(column);

    if (columnIndex === -1) {
      throw Error(`Params Error: column not found in columns`);
    }

    if (!(DATA_TYPES.includes(dtype))) {
      throw Error(`dtype ${dtype} not supported. dtype must be one of ${DATA_TYPES}`);
    }

    const data = this.values;

    const newData = data.map((row) => {
      if (dtype === "float32") {
        row[columnIndex] = Number(row[columnIndex]);
        return row;
      } else if (dtype === "int32") {
        row[columnIndex] = parseInt(row[columnIndex]);
        return row;
      } else if (dtype === "string") {
        row[columnIndex] = row[columnIndex].toString();
        return row;
      } else if (dtype === "boolean") {
        row[columnIndex] = Boolean(row[columnIndex]);
        return row;
      }
    });

    if (inplace) {
      this.$setValues(newData);
    } else {
      const newDtypes = [...this.dtypes];
      newDtypes[columnIndex] = dtype;

      return new DataFrame(newData, {
        index: [...this.index],
        columns: [...this.columns],
        dtypes: newDtypes,
        config: { ...this.config }
      });
    }
  }

  /**
     * Return the number of unique elements in a across the specified axis.
     * To get the values use `.unique()` instead.
     * @param axis The axis to count unique elements across. Defaults to 1
    */
  nunique(axis = 1) {
    if ([0, 1].indexOf(axis) === -1) {
      throw Error(`ParamError: axis must be 0 or 1`);
    }
    const data = this.$getDataArraysByAxis(axis);
    const newData = data.map((row) => new Set(row).size);

    if (axis === 0) {
      return new Series(newData, {
        index: [...this.columns],
        dtypes: ["int32"]
      });
    } else {
      return new Series(newData, {
        index: [...this.index],
        dtypes: ["int32"]
      });
    }
  }

  /**
     * Renames a column or index.
     * @param mapper An object that maps each column or index in the DataFrame to a new value
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
     * @param options.axis The axis to perform the operation on. Defaults to 1
     */
  rename(options) {
    const { mapper, axis, inplace } = { axis: 1, inplace: false, ...options };

    if ([0, 1].indexOf(axis) === -1) {
      throw Error(`ParamError: axis must be 0 or 1`);
    }

    if (axis === 1) {
      const colsAdded = [];
      const newColumns = this.columns.map((col) => {
        if (mapper[col] !== undefined) {
          colsAdded.push(mapper[col]);
          return mapper[col];
        } else {
          return col;
        }
      });

      if (inplace) {
        this.$setColumnNames(newColumns);
        for (const col of colsAdded) {
          this.$setInternalColumnDataProperty(col);
        }
      } else {
        return new DataFrame([...this.values], {
          index: [...this.index],
          columns: newColumns,
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });
      }
    } else {
      const newIndex = this.index.map((col) => {
        if (mapper[col] !== undefined) {
          return mapper[col];
        } else {
          return col;
        }
      });

      if (inplace) {
        this.$setIndex(newIndex);
      } else {
        return new DataFrame([...this.values], {
          index: newIndex,
          columns: [...this.columns],
          dtypes: [...this.dtypes],
          config: { ...this.config }
        });
      }
    }

  }

  /**
    * Sorts the Dataframe by the index.
    * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
    * @param options.ascending Whether to sort values in ascending order or not. Defaults to true
    */
  sort_index(options) {
    const { ascending, inplace } = { ascending: true, inplace: false, ...options };

    const indexPosition = utils.range(0, this.index.length - 1);
    const index = [...this.index];

    const objToSort = index.map((idx, i) => {
      return { index: indexPosition[i], value: idx };
    });

    const sortedObjectArr = utils.sortObj(objToSort, ascending);
    let sortedIndex = sortedObjectArr.map((obj) => obj.index);
    const newData = sortedIndex.map((i) => (this.values)[i]);
    sortedIndex = sortedIndex.map((i) => index[i]);

    if (inplace) {
      this.$setValues(newData);
      this.$setIndex(sortedIndex);
    } else {
      return new DataFrame(newData, {
        index: sortedIndex,
        columns: [...this.columns],
        dtypes: [...this.dtypes],
        config: { ...this.config }
      });
    }

  }

  /**
     * Add new rows to the end of the DataFrame.
     * @param newValues Array, Series or DataFrame to append to the DataFrame
     * @param index The new index value(s) to append to the Series. Must contain the same number of values as `newValues`
     * as they map `1 - 1`.
     * @param options.inplace Boolean indicating whether to perform the operation inplace or not. Defaults to false
     */
  append(
    newValues,
    index,
    options
  ) {
    const { inplace } = { inplace: false, ...options };

    if (!newValues) {
      throw Error(`ParamError: newValues must be a Series, DataFrame or Array`);
    }

    if (!index) {
      throw Error(`ParamError: index must be specified`);
    }

    let rowsToAdd = [];
    if (newValues instanceof Series) {

      if (newValues.values.length !== this.shape[1]) {
        throw Error(`ValueError: length of newValues must be the same as the number of columns.`);
      }
      rowsToAdd = [newValues.values];

    } else if (newValues instanceof DataFrame) {

      if (newValues.shape[1] !== this.shape[1]) {
        throw Error(`ValueError: length of newValues must be the same as the number of columns.`);
      }
      rowsToAdd = newValues.values;

    } else if (Array.isArray(newValues)) {

      if (utils.is1DArray(newValues)) {
        rowsToAdd = [newValues];
      } else {
        rowsToAdd = newValues;
      }

      if ((rowsToAdd[0]).length !== this.shape[1]) {
        throw Error(`ValueError: length of newValues must be the same as the number of columns.`);
      }

    } else {
      throw Error(`ValueError: newValues must be a Series, DataFrame or Array`);
    }


    let indexInArrFormat = [];
    if (!Array.isArray(index)) {
      indexInArrFormat = [index];
    } else {
      indexInArrFormat = index;
    }

    if (rowsToAdd.length !== indexInArrFormat.length) {
      throw Error(`ParamError: index must contain the same number of values as newValues`);
    }

    const newData = [...this.values];
    const newIndex = [...this.index];

    rowsToAdd.forEach((row, i) => {
      newData.push(row);
      newIndex.push(indexInArrFormat[i]);
    });

    if (inplace) {
      this.$setValues(newData);
      this.$setIndex(newIndex);
    } else {
      return new DataFrame(newData, {
        index: newIndex,
        columns: [...this.columns],
        dtypes: [...this.dtypes],
        config: { ...this.config }
      });
    }

  }

  /**
     * Queries the DataFrame for rows that meet the boolean criteria.
     * @param options
     * - `column` A column name to query with.
     * - `is` A logical operator. Can be one of the following: [">", "<", "<=", ">=", "==", "!="]
     * - `to` A value to query with.
     * - `condition` An array of boolean mask, one for each row in the DataFrame. Rows where the value are true will be returned.
     *  If specified, then other parameters are ignored.
     * - `inplace` Boolean indicating whether to perform the operation inplace or not. Defaults to false
    **/
  query(options) {
    const { inplace, condition, column, is, to } = { inplace: false, ...options };

    if (condition) {
      const result = _iloc({
        ndFrame: this,
        rows: condition
      });

      if (inplace) {
        this.$setValues(result.values, false, false);
        this.$setIndex(result.index);
        return;
      } else {
        return result;
      }

    }

    const operators = [">", "<", "<=", ">=", "==", "!="];

    let columnIndex, operator, value;

    if (column) {
      if (this.columns.includes(column)) {
        columnIndex = this.columns.indexOf(column);
      } else {
        throw new Error(`ParamError: column ${column} not found in column names`);
      }
    } else {
      throw new Error(`ParamError: specify a column name to query`);
    }

    if (is) {
      if (operators.includes(is)) {
        operator = is;
      } else {
        throw new Error(`ParamError: specified operato ${is} is not a supported. operator must be one of ${operators}`);
      }
    } else {
      throw new Error(`ParamError: specify an operator to apply. operator must be one of ${operators}`);
    }

    if (to) {
      value = to;
    } else {
      throw new Error("ParamError: specify a value to query by");
    }

    let data = this.values;
    let index = this.index;
    let newData = [];
    let newIndex = [];

    for (var i = 0; i < data.length; i++) {
      let dataValue = data[i];
      let elem = dataValue[columnIndex];
      //use eval function for easy operation
      //eval() takes in a string expression e.g eval('2>5')
      if (eval(`elem${operator}value`)) {
        newData.push(dataValue);
        newIndex.push(index[i]);
      }
    }

    if (inplace) {
      this.$setValues(newData, false, false);
      this.$setIndex(newIndex);
      return;
    } else {
      return new DataFrame(newData, {
        index: newIndex,
        columns: this.columns,
        config: { ...this.config }
      });
    }
  }

  /**
     * Returns the data types for each column as a Series.
     */
  get ctypes() {
    return new Series(this.dtypes, { index: this.columns });
  }

  /**
     * One-hot encode specified columns in the DataFrame. If columns are not specified, all columns of dtype string will be encoded.
     * @param options Options for the operation. The following options are available:
     * - `columns`: A single column name or an array of column names to encode. Defaults to all columns of dtype string.
     * - `prefix`: Prefix to add to the column names. Defaults to unique labels.
     * - `prefixSeparator`: Separator to use for the prefix. Defaults to '_'.
     * - `inplace` indicating whether to perform the operation inplace or not. Defaults to false
     * @returns A DataFrame with the one-hot encoded columns.
     * @example
     * df.getDummies({ columns: ['a', 'b'] })
     * df.getDummies({ columns: ['a', 'b'], prefix: 'cat' })
     * df.getDummies({ columns: ['a', 'b'], prefix: 'cat', prefixSeparator: '-' })
     * df.getDummies({ columns: ['a', 'b'], prefix: 'cat', prefixSeparator: '-', inplace: true })
     * df.getDummies({ columns: ['a', 'b'], prefix: ['col1', 'col2'], prefixSeparator: '-', inplace: true })
     */
  get_dummies(options) {
    const { inplace } = { inplace: false, ...options };

    const encodedDF = dummyEncode(this, options);
    if (inplace) {
      this.$setValues(encodedDF.values, false, false);
      this.$setColumnNames(encodedDF.columns);
    } else {
      return encodedDF;
    }

  }

  /**
   *
   * @param {col}  col is a list of columns
   */
  groupby(col) {
    const len = this.shape[0];
    const columns = this.columns;
    const col_index = col.map((val) => columns.indexOf(val));
    const col_dtype = this.dtypes.filter((val, index) => {
      return col_index.includes(index);
    });

    const self = this;
    const data = col.map(
      (column_name) => {
        if (!(columns.includes(column_name)))
          throw new Error(`column ${column_name} does not exist`);
        const column_data = self.column(column_name).values;
        return column_data;
      }
    );

    const unique_columns = data.map((column_data) => utils.unique(column_data));

    function getRecursiveDict(uniq_columns) {
      const first_uniq_columns = uniq_columns[0];
      const remaining_columns = uniq_columns.slice(1);
      const c_dict = {};
      if (!remaining_columns.length)
        first_uniq_columns.forEach((col_value) => c_dict[col_value] = []);
      else
        first_uniq_columns.forEach((col_value) => c_dict[col_value] = getRecursiveDict(remaining_columns));
      return c_dict;
    }
    const col_dict = getRecursiveDict(unique_columns);

    return new GroupBy(
      col_dict,
      col,
      this.values,
      columns,
      col_dtype
    ).group();
  }

}
