/*
 Copyright 2020 Esri

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

import AppBase from "./support/AppBase.js";
import AppLoader from "./loaders/AppLoader.js";

class Application extends AppBase {

  // PORTAL //
  portal;

  constructor() {
    super();

    // LOAD APPLICATION BASE //
    super.load().then(() => {

      // APPLICATION LOADER //
      const applicationLoader = new AppLoader({app: this});
      applicationLoader.load().then(({portal, group, map, view}) => {
        //console.info(portal, group, map, view);

        // PORTAL //
        this.portal = portal;

        // APP TITLE //
        this.title = this.title || map?.portalItem?.title || 'Application';
        // APP DESCRIPTION //
        this.description = this.description || map?.portalItem?.description || group?.description || '...';

        // USER SIGN-IN //
        this.configUserSignIn();

        // APPLICATION //
        this.applicationReady({portal, group, map, view}).catch(this.displayError).then(() => {
          // HIDE APP LOADER //
          document.getElementById('app-loader').removeAttribute('active');
        });

      }).catch(this.displayError);
    }).catch(this.displayError);

  }

  /**
   *
   */
  configUserSignIn() {
    if (this.oauthappid || this.portal?.user) {

      const signIn = document.getElementById('sign-in');
      signIn && (signIn.portal = this.portal);

    }
  }

  /**
   *
   * @param view
   */
  configView(view) {
    return new Promise((resolve, reject) => {
      if (view) {
        require([
          'esri/widgets/Home',
          'esri/widgets/Search',
          'esri/widgets/LayerList',
          'esri/widgets/Legend'
        ], (Home, Search, LayerList, Legend) => {

          //
          // CONFIGURE VIEW SPECIFIC STUFF HERE //
          //
          view.set({
            constraints: {snapToZoom: false},
            qualityProfile: "high",
            popup: {
              defaultPopupTemplateEnabled: true
            }
          });

          // HOME //
          const home = new Home({view});
          view.ui.add(home, {position: 'top-left', index: 0});

          // LEGEND //
          /*
           const legend = new Legend({ view: view });
           view.ui.add(legend, {position: 'bottom-left', index: 0});
           */

          // SEARCH /
          /*
           const search = new Search({ view: view});
           view.ui.add(legend, {position: 'top-right', index: 0});
           */

          // LAYER LIST //
          const layerList = new LayerList({
            container: 'layer-list-container',
            view: view,
            visibleElements: {statusIndicators: true}
          });

          // VIEW UPDATING //
          const viewUpdating = document.getElementById('view-updating');
          this._watchUtils.init(view, 'updating', updating => {
            viewUpdating.toggleAttribute('active', updating);
          });

          resolve();
        });
      } else { resolve(); }
    });
  }

  /**
   *
   * @param portal
   * @param group
   * @param map
   * @param view
   * @returns {Promise}
   */
  applicationReady({portal, group, map, view}) {
    return new Promise(async (resolve, reject) => {
      // VIEW READY //
      this.configView(view).then(() => {

        this.initializeColorUtils();

        this.initializeData(view).then(resolve).catch(reject);

      });
    });
  }

  /**
   *
   * @param msg
   * @private
   */
  _progress(msg = '...') {

    if (!this.start) { this.start = Date.now(); }

    const seconds = ((Date.now() - this.start) / 1000).toFixed(0);
    console.info(`Duration: ${ seconds } seconds [ ${ msg } ]`);

  }


  /**
   *
   * @param {SceneView} view
   */
  initializeData(view) {
    return new Promise((resolve, reject) => {
      require(['esri/layers/CSVLayer'], (CSVLayer) => {

        this._progress('Started');

        const dataFilesInfos = [
          {title: 'Paso Robles', url: './data/PasoRobles_4326.csv', visible: false, maxDataValue: 1566},
          {title: 'Indian Wells Valley', url: './data/IndianWellsValley_4326.csv', visible: true, maxDataValue: 20000}
        ];

        // RHO
        // GROUND_ELEVATION_m
        // INTERVAL_BOTTOM_ELEVATION_m
        // INTERVAL_BOTTOM_DEPTH_m
        // INTERVAL_THICKNESS_m
        // LINE_NO
        // BELOW_DOI_m

        const cubeSizeMeters = {
          height: 25,
          width: 25,
          depth: 25
        };

        dataFilesInfos.forEach(dataFileInfo => {

          const csvLayer = new CSVLayer({
            ...dataFileInfo,
            elevationInfo: {
              mode: 'relative-to-ground',
              featureExpressionInfo: {
                expression: '($feature.GROUND_ELEVATION_m - $feature.INTERVAL_BOTTOM_ELEVATION_m)'
              }
            },
            /*labelingInfo: [
             {
             labelExpressionInfo: {
             expression: `Floor($feature.GROUND_ELEVATION_m - $feature.INTERVAL_BOTTOM_ELEVATION_m)`
             },
             symbol: {
             type: "text",
             color: "#ffffff",
             haloColor: "#242424",
             haloSize: 1.5,
             font: {
             size: 11,
             weight: "bold"
             }
             }
             }
             ],*/
            renderer: {
              type: 'simple',
              symbol: {
                type: "point-3d",
                symbolLayers: [
                  {
                    type: "object",
                    ...cubeSizeMeters,
                    resource: {primitive: "cylinder"},
                    material: {color: "#ffffff"}
                  }
                ]
              },
              visualVariables: [
                {
                  type: 'color',
                  valueExpression: `$feature.RHO / ${ dataFileInfo.maxDataValue }`,
                  stops: [
                    {value: 0.001, color: "#0000ff"},
                    {value: 0.010, color: "#00ffff"},
                    {value: 0.100, color: "#ffff00"},
                    {value: 1.000, color: "#850007"}
                  ]
                }
              ]
            }
          });
          csvLayer.load().then(() => {
            view.map.add(csvLayer);

            this._progress('CSV Layer loaded and added to map...');

            if (dataFileInfo.visible) {
              csvLayer.visible = false;

              view.goTo(csvLayer.fullExtent).then(() => {

                const lineIDsQuery = csvLayer.createQuery();
                lineIDsQuery.set({
                  where: '1=1',
                  outFields: ['LINE_NO'],
                  returnDistinctValues: true,
                  returnGeometry: false
                });
                csvLayer.queryFeatures(lineIDsQuery).then((lineIDsFS) => {

                  this._progress('list of LINE_NO retrieved...');
                  const lineIDs = lineIDsFS.features.map(feature => { return feature.attributes.LINE_NO; });

                  const processedLineHandles = lineIDs.map(lineID => {
                    return new Promise((resolve, reject) => {

                      const lineQuery = csvLayer.createQuery();
                      lineQuery.set({
                        where: `LINE_NO = ${ lineID }`,
                        outFields: ['*'],
                        returnGeometry: true
                      });
                      csvLayer.queryFeatures(lineQuery).then((lineFS) => {
                        this._progress(`Creating data curtain for (LINE_NO = ${ lineID })...`);

                        this.createCurtainMesh({
                          view,
                          lineID,
                          renderer: csvLayer.renderer,
                          maxDataValue: dataFileInfo.maxDataValue,
                          features: lineFS.features
                        }).then(resolve).catch(reject);

                      }).catch(reject);
                    });
                  });
                  Promise.all(processedLineHandles).then((wallGraphics) => {
                    this._progress('Finished');

                    view.graphics.addMany(wallGraphics);

                    resolve();
                  });
                });
              });
            }
          }).catch(this.displayError);
        });

      });
    });
  }


  /**
   *
   */
  initializeColorUtils() {
    require(["esri/config", "esri/core/workers"], (esriConfig, workers) => {

      const workerFolderUrl = new URL("./js/workersFolder", document.baseURI).href
      const workerScriptUrl = new URL("./js/workersFolder/ColorUtils.js", document.baseURI).href

      esriConfig.workers.loaderConfig = {
        paths: {
          myWorkers: workerFolderUrl
        }
      };

      this.getColors = (features, renderer) => {
        return new Promise((resolve, reject) => {
          workers.open(workerScriptUrl).then(connection => {

            const rendererJSON = renderer.toJSON();
            const featuresJSON = features.map(f => f.toJSON());

            connection.invoke("getColors", {featuresJSON, rendererJSON}).then(resolve).catch(reject);

          }).catch(reject);
        });
      }

    });
  }

  /**
   *
   * @param {SceneView} view
   * @param {Number} lineID
   * @param {Renderer} renderer
   * @param {Number} maxDataValue
   * @param {Graphic[]} features
   * @returns {Promise<Mesh>}
   */
  createCurtainMesh({view, lineID, renderer, maxDataValue, features}) {
    return new Promise((resolve, reject) => {
      require([
        "esri/geometry/support/meshUtils",
        'esri/geometry/Mesh'
      ], (meshUtils, Mesh) => {

        const meshSymbol = {
          type: "mesh-3d",
          symbolLayers: [
            {
              type: "fill",
              material: {color: "rgba(255,255,255,0.9)"},
              edges: {type: "solid", color: 'yellow', size: 2.5}
            }
          ]
        };

        const outputSR = features[0].geometry.spatialReference;

        this._progress(` - getting vertex colors for (LINE_NO = ${ lineID })...`);
        this.getColors(features, renderer).then(colors => {

          this._progress(` - creating location bins for (LINE_NO = ${ lineID })...`);
          const locationBins = features.reduce((bins, feature, featureIdx) => {

            const locationHash = `${ feature.geometry.x },${ feature.geometry.y }`;
            const bin = bins.get(locationHash) || {elevation: null, coords: [], colors: []};

            const elevationAtLocation = bin.elevation || view.groundView.elevationSampler.queryElevation(feature.geometry).z;
            const elevationOffset = (feature.attributes.GROUND_ELEVATION_m - feature.attributes.INTERVAL_BOTTOM_ELEVATION_m);

            bin.coords.push([feature.geometry.x, feature.geometry.y, (elevationAtLocation + elevationOffset)]);
            bin.colors.push(colors[featureIdx]);

            return bins.set(locationHash, bin);
          }, new Map());


          this._progress(` - assembling mesh triangles for (LINE_NO = ${ lineID })...`);
          const locationHashKeys = Array.from(locationBins.keys());

          const meshWallSections = locationHashKeys.reduce((wallSections, locationHash, locationHashIndex) => {

            if (locationHashIndex < (locationHashKeys.length - 1)) {

              // TOP AND BOTTOM COORDINATES //
              const featureInfosLeft = locationBins.get(locationHashKeys[locationHashIndex]);
              const featureInfosRight = locationBins.get(locationHashKeys[locationHashIndex + 1]);

              const coordsLeft = featureInfosLeft.coords;
              const colorsLeft = featureInfosLeft.colors;
              const coordsRight = featureInfosRight.coords;
              const colorsRight = featureInfosRight.colors;

              if (coordsLeft.length === coordsRight.length) {

                // INTERLEAVED WALL COORDINATES //
                const vertexCoords = [];
                const vertexColors = [];
                for (let leftIdx = 0; leftIdx < (coordsLeft.length - 1); leftIdx++) {
                  vertexCoords.push(coordsLeft[leftIdx], coordsRight[leftIdx], coordsLeft[leftIdx + 1]);
                  vertexColors.push(colorsLeft[leftIdx], colorsRight[leftIdx], colorsLeft[leftIdx + 1]);
                  vertexCoords.push(coordsLeft[leftIdx + 1], coordsRight[leftIdx], coordsRight[leftIdx + 1]);
                  vertexColors.push(colorsLeft[leftIdx + 1], colorsRight[leftIdx], colorsRight[leftIdx + 1]);
                }

                if (vertexCoords.length % 3 === 0) {

                  wallSections.push(new Mesh({
                    spatialReference: outputSR,
                    vertexAttributes: {
                      position: vertexCoords.flat(),
                      color: vertexColors.flat()
                    }
                  }));

                } else {
                  console.error(new Error(`${ lineID }: ${ locationHash }: [ vertexCoords.length % 3 !== 0 ] [ ${ vertexCoords.length } ]`));
                }
              } else {
                console.error(new Error(`${ lineID }: ${ locationHash }: [ coordsLeft.length !== coordsRight.length ] [ ${ coordsLeft.length },${ coordsRight.length } ]`));
              }
            }

            return wallSections;
          }, []);

          const wallGraphic = {
            attributes: {id: lineID},
            geometry: meshUtils.merge(meshWallSections),
            symbol: meshSymbol,
            popupTemplate: {title: '{id}'}
          };

          this._progress(` - wall graphic created for (LINE_NO = ${ lineID })...`);

          resolve(wallGraphic);
        });
      });
    });
  }


}

export default new Application();
