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
/**
 * Generic function for performing add, sub, pow, mul and mod operation on a series
 * @param object
 *
 * ndframe ==> The current Series
 *
 * other ==> The Series or number to perform math operation with
 *
 * operation ==> The type of operation to perform
*/
export declare function _genericMathOp({ ndFrame, other, operation }: {
    ndFrame: Series;
    other: Series | number | Array<number>;
    operation: string;
}): number[] | undefined;
