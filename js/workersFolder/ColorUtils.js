define([], () => {
  return {
    getColors: function ({featuresJSON, rendererJSON}) {
      return new Promise((resolve, reject) => {
        require([
          "esri/Graphic",
          "esri/renderers/support/jsonUtils",
          "esri/symbols/support/symbolUtils",
        ], (Graphic, rendererJsonUtils, symbolUtils) => {

          const features = featuresJSON.map(featureJSON => Graphic.fromJSON(featureJSON));
          const renderer = rendererJsonUtils.fromJSON(rendererJSON);

          const colorHandles = features.map(feature => {
            return symbolUtils.getDisplayedColor(feature, {renderer}).then(color => {
              return color.toRgb().concat(255);
            });
          });

          Promise.all(colorHandles).then(resolve).catch(reject);

        });
      });
    },

    /**
     *
     * @param {{coords:Number[][], colors:Number[]}} featureInfosLeft
     * @param {{coords:Number[][], colors:Number[]}} featureInfosRight
     * @returns {Promise<{position:Number[], color:Number[]}>}
     */
    createColumnSortedVertexAttributes: function ({featureInfosLeft, featureInfosRight}) {
      return new Promise((resolve, reject) => {

        const coordsLeft = featureInfosLeft.coords;
        const colorsLeft = featureInfosLeft.colors;
        const coordsRight = featureInfosRight.coords;
        const colorsRight = featureInfosRight.colors;

        // INTERLEAVED WALL COORDINATES //
        const vertexCoords = [];
        const vertexColors = [];
        for (let leftIdx = 0; leftIdx < (coordsLeft.length - 1); leftIdx++) {
          vertexCoords.push(coordsLeft[leftIdx], coordsRight[leftIdx], coordsLeft[leftIdx + 1]);
          vertexColors.push(colorsLeft[leftIdx], colorsRight[leftIdx], colorsLeft[leftIdx + 1]);
          vertexCoords.push(coordsLeft[leftIdx + 1], coordsRight[leftIdx], coordsRight[leftIdx + 1]);
          vertexColors.push(colorsLeft[leftIdx + 1], colorsRight[leftIdx], colorsRight[leftIdx + 1]);
        }

        resolve({
          position: vertexCoords.flat(),
          color: vertexColors.flat()
        });

      });
    }

  };
});
