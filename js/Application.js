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
   * @param {SceneView} view
   */
  initializeData(view) {
    return new Promise((resolve, reject) => {
      require(['esri/layers/CSVLayer'], (CSVLayer) => {

        const start = Date.now();

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
                        this.createCurtainMesh({view, lineID, renderer: csvLayer.renderer, maxDataValue: dataFileInfo.maxDataValue, features: lineFS.features}).then(({wallGraphic}) => {
                          resolve(wallGraphic)
                        }).catch(reject);
                      }).catch(reject);
                    });
                  });
                  Promise.all(processedLineHandles).then((wallGraphics) => {

                    view.graphics.addMany(wallGraphics);

                    const seconds = ((Date.now() - start) / 1000).toFixed(0);
                    alert(`Duration: ${ seconds } seconds`);

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

      workers.open(workerScriptUrl).then(connection => {

        this.getColors = (features, renderer) => {
          return new Promise((resolve, reject) => {

            const rendererJSON = renderer.toJSON();
            const featuresJSON = features.map(f => f.toJSON());

            connection.invoke("getColors", {featuresJSON, rendererJSON}).then(resolve).catch(reject);

          });
        }

      }).catch(console.error);
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

        const featureBins = features.reduce((bins, feature) => {

          const offset = (feature.attributes.GROUND_ELEVATION_m - feature.attributes.INTERVAL_BOTTOM_ELEVATION_m);
          const elevationOffset = Math.floor(offset);
          const bin = bins.get(elevationOffset) || [];

          const feature3D = feature.clone();
          feature3D.geometry = view.groundView.elevationSampler.queryElevation(feature3D.geometry);
          feature3D.geometry.z += offset;

          bin.push(feature3D);

          return bins.set(elevationOffset, bin);
        }, new Map());


        /*const getColors = features => {
         return new Promise((resolve, reject) => {
         const colorHandles = features.map(feature => {
         return symbolUtils.getDisplayedColor(feature, {renderer});
         });
         Promise.all(colorHandles).then((colors) => {
         resolve(colors.map(c => c.toRgb().concat(255)));
         });
         });
         };*/


        const elevationOffsets = Array.from(featureBins.keys());
        elevationOffsets.sort((a, b) => (b - a));

        const meshWallsHandles = elevationOffsets.map((elevationOffset, offsetIdx) => {
          //console.info(`================> ${ lineID }: ${ elevationOffset }`);

          if (offsetIdx < elevationOffsets.length - 1) {
            return new Promise(async (resolve, reject) => {

              // TOP AND BOTTOM COORDINATES //
              const topFeatures = featureBins.get(elevationOffsets[offsetIdx]);
              const coordsTop = topFeatures.map(f => f.geometry).map(geom => [geom.x, geom.y, geom.z]);

              const bottomFeatures = featureBins.get(elevationOffsets[offsetIdx + 1]);
              const coordsBottom = bottomFeatures.map(f => f.geometry).map(geom => [geom.x, geom.y, geom.z]);

              const colorsTop = await this.getColors(topFeatures, renderer);
              const colorsBottom = await this.getColors(bottomFeatures, renderer);

              if (coordsBottom.length === coordsTop.length) {

                // INTERLEAVED SIDE WALL COORDINATES //
                const vertexCoords = [];
                const vertexColors = [];
                for (let topIdx = 0; topIdx < (coordsTop.length - 1); topIdx++) {
                  vertexCoords.push(coordsTop[topIdx], coordsTop[topIdx + 1], coordsBottom[topIdx + 1]);
                  vertexColors.push(colorsTop[topIdx], colorsTop[topIdx + 1], colorsBottom[topIdx + 1]);

                  vertexCoords.push(coordsTop[topIdx], coordsBottom[topIdx + 1], coordsBottom[topIdx]);
                  vertexColors.push(colorsTop[topIdx], colorsBottom[topIdx + 1], colorsBottom[topIdx]);
                }

                if (vertexCoords.length % 3 === 0) {
                  console.info(`${ lineID }: ${ elevationOffset }: [ ${ coordsTop.length },${ coordsBottom.length } ]`);

                  const meshWallSection = new Mesh({
                    spatialReference: outputSR,
                    vertexAttributes: {
                      position: vertexCoords.flat(),
                      color: vertexColors.flat()
                    }
                  });

                  resolve(meshWallSection);
                } else {
                  console.error(new Error(`${ lineID }: ${ elevationOffset }: [ vertexCoords.length % 3 !== 0 ] [ ${ vertexCoords.length } ]`));
                  resolve();
                }
              } else {
                console.error(new Error(`${ lineID }: ${ elevationOffset }: [ coordsBottom.length !== coordsTop.length ] [ ${ coordsTop.length },${ coordsBottom.length } ]`));
                resolve();
              }
            });
          } else {
            return Promise.resolve();
          }
        });

        Promise.all(meshWallsHandles).then((meshWallsResponses) => {

          const meshWalls = meshWallsResponses.filter(mwr => { return (mwr != null); });

          const wallGraphic = {
            attributes: {id: lineID},
            geometry: meshUtils.merge(meshWalls),
            symbol: meshSymbol,
            popupTemplate: {title: '{id}'}
          };

          resolve({wallGraphic});
        });
      });
    });
  }


}

export default new Application();
