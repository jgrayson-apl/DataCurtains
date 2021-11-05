/*
 Copyright 2021 Esri

 Licensed under the Apache License, Version 2.0 (the "License");
 you may not use this file except in compliance with the License.
 You may obtain a copy of the License at

 http://www.apache.org/licenses/LICENSE-2.0

 Unless required by applicable law or agreed to in writing, software
 distributed under the License is distributed on an "AS IS" BASIS,
 WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 See the License for the specific language governing permissions and
 limitations under the License.
 */

/**
 *
 * DataCurtainsUtils
 *  - Data Curtains Utilities
 *
 * Author:   John Grayson - Applications Prototype Lab - Esri
 * Created:  11/5/2021 - 0.0.1 -
 * Modified:
 *
 */

class DataCurtainsUtils extends EventTarget {

  static version = '0.0.1';

  _featureLayer;
  get featureLayer(){
    return this._featureLayer;
  }


  /**
   *
   */
  constructor() {
    super();

    this._initializeFeatureLayer()

  }

  /**
   *
   * @private
   */
  sourceLayer({sourceLayer}){
    require([
      "esri/layers/FeatureLayer"
    ], (FeatureLayer) => {

      this._featureLayer = new FeatureLayer({
          title: sourceLayer.title,
          fields: [...sourceLayer.fields],
          objectIdField: sourceLayer.objectIdField,
          geometryType: 'mesh',
          spatialReference: sourceLayer.spatialReference,
          source: [],
          renderer: {
            type: 'simple',
            symbol: {
              type: "point-3d",
              symbolLayers: [{
                type: "object",
                width: 100,
                height: 100,
                depth: 100,
                resource: {primitive: "sphere"},
                material: {color: "red"}
              }]
            }
          }

      });

    });
  }


/*
 require([
 "esri/symbols/support/symbolUtils",
 "esri/geometry/support/meshUtils",
 'esri/geometry/Mesh'
 ], (symbolUtils, meshUtils, Mesh) => {

 */


}

export default DataCurtainsUtils;
