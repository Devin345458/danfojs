import * as tf from '@tensorflow/tfjs-node'
// import * as tf from '@tensorflow/tfjs'
import { table } from 'table'
import { Utils } from './utils'
import { Configs } from '../config/config'

const utils = new Utils()
const config = new Configs()  //package wide configuration object




export default class NDframe {
    /**
     * N-Dimensiona data structure. Stores multi-dimensional 
     * data in a size-mutable, labeled data structure. Analogous to the Python Pandas DataFrame. 
     * 
     * @param {data} Array, JSON, Tensor. Block of data.
     * @param {kwargs} Object,(Optional Configuration Object)
     *                 {columns: Array of column names. If not specified and data is an array of array, use range index.
 *                      dtypes: Data types of the columns }
     *      
     * @returns NDframe
     */

    constructor(data, kwargs = {}) {
        this.kwargs = kwargs

        if (utils.__is_1D_array(data)) {
            this.series = true
            this.__read_array(data)
        } else {
            this.series = false
            if (utils.__is_object(data[0])) { //check the type of the first object in the data
                this.__read_object(data)
            } else if (Array.isArray(data[0]) || utils.__is_number(data[0]) || utils.__is_string(data[0])) {
                this.__read_array(data)
            } else {
                throw "File format not supported for now"
            }
        }

    }


    __read_array(data) {
        this.data = utils.__replace_undefined_with_NaN(data, this.series) //Defualt array data in row format
        this.row_data_tensor = tf.tensor(this.data) //data saved as tensors TODO: INfer type before saving as tensor

        if (utils.__key_in_object(this.kwargs, 'index')) {
            this.__set_index(this.kwargs['index'])
        } else {
            this.index_arr = [...Array(this.row_data_tensor.shape[0]).keys()]   //set index
        }

        if (this.ndim == 1) {
            //series array
            if (!utils.__key_in_object(this.kwargs, 'columns')) {
                this.columns = ["0"]
            } else {
                this.columns = this.kwargs['columns']
            }

            if (utils.__key_in_object(this.kwargs, 'dtypes')) {
                this.__set_col_types(this.kwargs['dtypes'], false)
            } else {
                //infer dtypes
                this.__set_col_types(null, true)
            }

        } else {
            //2D or more array
            if (!utils.__key_in_object(this.kwargs, 'columns')) {
                //asign integer numbers
                this.columns = [...Array(this.row_data_tensor.shape[1]).keys()]
            } else {
                if (this.kwargs['columns'].length == Number(this.row_data_tensor.shape[1])) {
                    this.columns = this.kwargs['columns']
                } else {
                    throw `Column length mismatch. You provided a column of length ${this.kwargs['columns'].length} but data has lenght of ${this.row_data_tensor.shape[1]}`
                }
            }

            if (utils.__key_in_object(this.kwargs, 'dtypes')) {
                this.__set_col_types(this.kwargs['dtypes'], false)
            } else {
                //infer dtypes
                this.__set_col_types(null, true)
            }
        }
    }


    //Reads a Javascript Object of arrays of data points
    __read_object(data) {
        let data_arr = []
        //check format of objects
        let _key = Object.keys(data[0])[0]  //get first column name in data
        if (Array.isArray(data[0][_key])) {
            // format of data is [{"a": [1,2,3,4]}, {"b": [2,4,5,7]}]
            let result = utils.__get_row_values(data)
            data_arr = result[0]
            this.kwargs['columns'] = result[1]
            //call read array on result since it is an array of array format
            this.__read_array(data_arr)
        } else {
            //format of data is [{"a": 1, "b" : 2}, {"a": 2, "b" : 4}, {"a": 4, "b" : 5}]
            data.forEach((item) => {
                data_arr.push(Object.values(item))
            });

            this.data = utils.__replace_undefined_with_NaN(data_arr, this.series) //Defualt array data in row format
            this.row_data_tensor = tf.tensor(this.data) //data saved as tensors
            this.kwargs['columns'] = Object.keys(Object.values(data)[0]) //get names of the column from the first entry

            if (utils.__key_in_object(this.kwargs, 'index')) {
                this.__set_index(this.kwargs['index'])
            } else {
                this.index_arr = [...Array(this.row_data_tensor.shape[0]).keys()]   //set index
            }

            if (this.ndim == 1) {
                //series array
                if (this.kwargs['columns'] == undefined) {
                    this.columns = ["0"]
                } else {
                    this.columns = this.kwargs['columns']
                }

            } else {
                //2D or more array
                if (!utils.__key_in_object(this.kwargs, 'columns')) {
                    //asign integer numbers
                    this.columns = [...Array(this.row_data_tensor.shape[1]).keys()] //use 0 because we are testing lenght from an Object
                } else {
                    if (this.kwargs['columns'].length == Number(this.row_data_tensor.shape[1])) {
                        this.columns = this.kwargs['columns']
                    } else {
                        throw `Column lenght mismatch. You provided a column of lenght ${this.kwargs['columns'].length} but data has column length of ${this.row_data_tensor.shape[1]}`
                    }
                }

                //set column types
                if (utils.__key_in_object(this.kwargs, 'dtypes')) {
                    this.__set_col_types(this.kwargs['dtypes'], false)
                } else {
                    //infer dtypes
                    this.__set_col_types(null, true)
                }

            }
        }
    }


    __set_col_types(dtypes, infer) {
        //set data type for each column in an NDFrame
        const __supported_dtypes = ['float32', "int32", 'string', 'boolean']

        if (infer) {
            //saves array data in column form for easy access
            if (this.series) {
                this.col_types = utils.__get_t(this.values)
            } else {
                this.col_data = utils.__get_col_values(this.data)
                this.col_data_tensor = tf.tensor(this.col_data) //column wise data saved as tensors used in DataFrame
                this.col_types = utils.__get_t(this.col_data)
            }
        } else {
            if (this.series) {
                this.col_types = dtypes
            } else {
                if (Array.isArray(dtypes) && dtypes.length == this.columns.length) {
                    dtypes.map((type, indx) => {
                        if (!__supported_dtypes.includes(type)) {
                            throw new Error(`dtype error: dtype specified at index ${indx} is not supported`)
                        }
                    })
                    this.col_data = utils.__get_col_values(this.data)
                    this.col_data_tensor = tf.tensor(this.col_data) //column wise data saved as tensors used in DataFrame
                    this.col_types = dtypes
                } else {
                    throw new Error(`dtypes: lenght mismatch. Specified dtype has a lenght
                 of ${dtypes.length} but NDframe has ${this.column_names.length} number of columns`)
                }
            }
        }
    }




    /**
        * Returns the data types in the DataFrame 
        * @return {Array} list of data types for each column
        */
    get dtypes() {
        // let col_data = utils.get_col_values(this.data)
        // this.col_types = utils.__get_t(col_data)
        // let sf = new Series({dtypes: this.col_types, index: this.column_names})
        return this.col_types
    }


    /**
     * Sets the data types of an NDFrame 
     * @return {Array} list of data type for each column
     */
    astype(dtypes) {
        this.__set_col_types(dtypes, false)
        return this
    }



    /**
     * Gets dimension of the NDFrame
     * @returns {Integer} dimension of NDFrame
     */
    get ndim() {
        if (this.series) {
            return 1
        } else {
            return this.row_data_tensor.shape.length
        }
    }


    /**
    * Gets values for index and columns
    * @return {Object} axes configuration for index and columns of NDFrame
    */
    get axes() {
        let axes = {
            "index": [...Array(this.data.length - 1).keys()],
            "columns": this.columns
        }
        return axes
    }

    /**
    * Gets index of the NDframe
    * @return {Array} array of index from series
    */
    get index() {
        return this.index_arr
    }

    /**
    * Sets index of the NDFrame
    */
    __set_index(labels) {
        if (!Array.isArray(labels)) {
            throw Error("Value Error: index must be an array")
        }
        if (labels.length > this.row_data_tensor.shape[0] || labels.length < this.row_data_tensor.shape[0]) {
            throw Error("Value Error: length of labels must match row shape of data")
        }
        this.index_arr = labels

    }

    /**
    * Generate a new index for NDFrame.
    */
    __reset_index() {
        let new_idx = [...Array(this.values.length).keys()]
        this.index_arr = new_idx
    }



    /**
     * Gets a sequence of axis dimension along row and columns
     * @returns {Array} the shape of the NDFrame
     */
    get shape() {
        if (this.series) {
            return [this.values.length, 1]
        } else {
            return this.row_data_tensor.shape
        }
    }


    /**
     * Gets the values in the NDFrame in JS array
     * @returns {Array} Arrays of arrays of data instances
     */
    get values() {
        return this.data
    }



    /**
     * Gets the column names of the data
     * @returns {Array} strings of column names
     */
    get column_names() {
        return this.columns
    }

    // /**
    //  * Gets the column names of the data
    //  * @returns {Array} strings of column names
    //  */
    // set col_names() {

    // }

    /*
     * Gets binary size of the NDFrame
     * @returns {String} size of the NDFrame
     */
    get size() {
        return this.row_data_tensor.size
    }

    // /**
    // * Write object to a comma-separated values (csv) file.
    //  * @params {path} File path or object, if None is provided the result is returned as a string
    //  */
    // async to_csv(path = "") {
    //     let records = this.values

    //     if (path == "" || path == undefined) {
    //         //return string version of CSV
    //         const csvStringifier = createArrayCsvStringifier({
    //             header: this.column_names
    //         });
    //         let head = csvStringifier.getHeaderString()
    //         let csv_string = csvStringifier.stringifyRecords(records)
    //         let file = `${head}${csv_string}`
    //         return file

    //     } else {
    //         //save to path and return path uri of CSV
    //         const csvWriter = createArrayCsvWriter({
    //             header: this.column_names,
    //             path: path
    //         });

    //         csvWriter.writeRecords(records)
    //             .then(() => {
    //                 console.log(`CSV file saved in ${path}`)
    //                 return path
    //             }).catch((err) => {
    //                 throw Error(err)
    //             })
    //     }



    // }

    //     /**
    //    * Write object to a JSON Format (csv) file.
    //     * @params {path} File path or object, if None is provided the result is returned as a string
    //     */
    //     to_json(kwargs = {}) {
    //         //TODO
    //     }

    /**
    * Prints the data in a Series as a grid of row and columns
    */
    toString() {
        let table_width = config.get_width
        let table_truncate = config.get_truncate
        let max_row = config.get_max_row
        let max_col_in_console = config.get_max_col_in_console

        // let data;
        let data_arr = []
        let table_config = {}
        // let idx = this.index
        let col_len = this.columns.length
        let row_len = this.values.length - 1
        let header = []

        if (col_len > max_col_in_console) {
            //truncate displayed columns to fit in the console
            let first_4_cols = this.columns.slice(0, 3)
            let last_3_cols = this.columns.slice(col_len - 4, col_len)
            //join columns with truncate ellipse in the middle
            header = [""].concat(first_4_cols).concat(["..."]).concat(last_3_cols)

            let sub_idx, values_1, value_2

            if (this.values.length > max_row) {
                //slice Object to show a max of [max_rows]
                let df_subset_1 = this.loc({ rows: [`0:${max_row}`], columns: first_4_cols })
                let df_subset_2 = this.loc({ rows: [`0:${max_row}`], columns: last_3_cols })
                sub_idx = this.index.slice(0, max_row)
                values_1 = df_subset_1.values
                value_2 = df_subset_2.values
            } else {
                let df_subset_1 = this.loc({ rows: [`0:${row_len}`], columns: first_4_cols })
                let df_subset_2 = this.loc({ rows: [`0:${row_len}`], columns: last_3_cols })
                sub_idx = this.index.slice(0, max_row)
                values_1 = df_subset_1.values
                value_2 = df_subset_2.values
            }

            // merge cols
            sub_idx.map((val, i) => {
                let row = [val].concat(values_1[i]).concat(["..."]).concat(value_2[i])
                data_arr.push(row)
            })


        } else {
            //display all columns
            header = [""].concat(this.columns)
            let idx, values;
            if (this.values.length > max_row) {
                //slice Object to show a max of [max_rows]
                let data = this.loc({ rows: [`0:${max_row}`], columns: this.columns })
                idx = data.index
                values = data.values
            } else {
                values = this.values
                idx = this.index

            }

            // merge cols
            idx.map((val, i) => {
                let row = [val].concat(values[i])
                data_arr.push(row)
            })


        }

        //set column width of all columns
        table_config[0] = 10
        for (let index = 1; index < header.length; index++) {
            table_config[index] = { width: table_width, truncate: table_truncate }
        }

        data_arr.unshift(header) //Adds the column names to values before printing
        console.log(`\n Shape: (${this.shape}) \n`);
        return table(data_arr, { columns: table_config })
    }


    /**
    * Pretty prints a DataFrame or Series in the console
    */
    print() {
        console.log(this + "");
    }

}