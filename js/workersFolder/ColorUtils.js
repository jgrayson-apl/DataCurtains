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
    }
  };
});
