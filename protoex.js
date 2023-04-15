// Example of loading a protocol buffer feed directly into an ArcGIS
// API for JavaScript map.
//
// In this case we are loading Bus locations from MetroSTL
// (https://www.metrostlouis.org/developer-resources/)
// As of right now, it only updates every 10 mins :( so don't expect to see
// many changes on the map (although if you hang out for awhile it WILL update)
//
// Useful links:
// https://github.com/mapbox/pbf
// https://github.com/protobufjs/protobuf.js/wiki/How-to-read-binary-data-in-the-browser-or-under-node.js%3F
//
// One-time:
// Had to convert this proto file:
// https://developers.google.com/transit/gtfs-realtime/gtfs-realtime-proto
// into a JS module first using
// `npm install pbf; pbf gtfs-realtime.proto --browser > gtfs-realtime.browser.proto.js`
// (this is where `FeedMessage` is coming from below)

import { loadModules } from "https://unpkg.com/esri-loader/dist/esm/esri-loader.js";
// Note that the import line above works because Codepen is setting this script
// tag to have 'type="module"' - more info:
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules
// https://blog.codepen.io/2017/12/26/adding-typemodule-scripts-pens/

const protobufUpdate = async () => {
  // This is a reverse proxy to 
  // https://www.metrostlouis.org/RealTimeData/StlRealTimeVehicles.pb
  const url =
    "https://stlrealtimevehicles.alligator.workers.dev/?cacheBust=" +
    new Date().getTime();
  let response = await fetch(url);
  if (response.ok) {
    // if HTTP-status is 200-299
    // get the response body (the method explained below)
    const bufferRes = await response.arrayBuffer();
    const pbf = new Pbf(new Uint8Array(bufferRes));
    const obj = FeedMessage.read(pbf);
    return obj.entity;
  } else {
    console.error("error:", response.status);
  }
};

let timerInterval;
const resetTimer = () => {
  clearInterval(timerInterval);
  
  const node = document.querySelector(".countdownTimer");
  node.innerHTML = 15;
  timerInterval = setInterval(() => {
    const n = document.querySelector(".countdownTimer");
    n.innerHTML = n.innerHTML - 1;
  }, 1000);
}

// Removes all the graphics, calls the API to get the data,
// and adds all the Graphics to the input graphicsLayer.
const updateLayer = async (featureLayer, layerView) => {
  const [Graphic] = await loadModules(["esri/Graphic"]);

  // then get all the locations by calling the API (Protocol buffer service)
  const locations = await protobufUpdate();
  // console.log("locations:", locations);

  // Add all the locations to the map:
  const graphics = locations.map(locationObject => {
    var point = {
      type: "point", // autocasts as new Polyline()
      latitude: locationObject.vehicle.position.latitude,
      longitude: locationObject.vehicle.position.longitude
    };

    var timeStampDate = new Date(0); // The 0 there is the key, which sets the date to the epoch
    timeStampDate.setUTCSeconds(locationObject.vehicle.timestamp);

    var attributes = {
      name: locationObject.vehicle.vehicle.label,
      timestamp: timeStampDate.toTimeString(),
      route: locationObject.vehicle.trip.route_id,
      route_start: locationObject.vehicle.trip.start_time
    };

    return new Graphic({
      geometry: point,
      attributes: attributes,
    });
  });

  // first clear out the graphicsLayer
  // console.log('featureLayer:', featureLayer);
  layerView.queryFeatures().then((results) => {
    featureLayer.applyEdits({
      deleteFeatures: results.features,
      addFeatures: graphics
    });
  });
  
};

const main = async () => {
  // More info on esri-loader's loadModules function:
  // https://github.com/Esri/esri-loader#loading-modules-from-the-arcgis-api-for-javascript
  const [MapView, FeatureLayer] = await loadModules(
    ["esri/views/MapView", "esri/layers/FeatureLayer"],
    { css: true }
  );

  const fl = new FeatureLayer({
    fields: [
      {
        name: "ObjectID",
        alias: "ObjectID",
        type: "oid"
      },
      {
        name: "name",
        alias: "Name",
        type: "string"
      },
      {
        name: "timestamp",
        alias: "timestamp",
        type: "string"
      },
      {
        name: "route",
        alias: "route",
        type: "string"
      },
      {
        name: "route_start",
        alias: "route_start",
        type: "string"
      }
    ],
    objectIdField: "ObjectID",
    geometryType: "point",
    renderer: {
      type: "simple", // autocasts as new SimpleRenderer()
      symbol: {
        type: "simple-marker", // autocasts as new SimpleMarkerSymbol()
        style: "circle",
        color: "blue",
        size: "15px", // pixels
        outline: {
          // autocasts as new SimpleLineSymbol()
          color: [255, 255, 255],
          width: 1, // points
        }
      }
    },
    popupTemplate: {
      title: "{name}",
      content:
        "Updated: {timestamp}<br />Route: {route} (Started {route_start})"
    },
    labelingInfo: [
      {  // autocasts as new LabelClass()
        symbol: {
          type: "text",  // autocasts as new TextSymbol()
          color: "black",
          // haloColor: "blue",
          // haloSize: 1,
          font: {  // autocast as new Font()
             // family: "Ubuntu Mono",
             size: 10,
             weight: "bold"
           }
        },
        labelPlacement: "center-right",
        labelExpressionInfo: {
          expression: "$feature.name"
        },
        maxScale: 0,
        minScale: 100000
      }
    ],
    source: []
  });

  const viewOptions = {
    container: "viewDiv",
    map: {
      basemap: "streets-vector",
      layers: [fl]
    },
    center: [-90.3, 38.6],
    zoom: 10
  };

  // create 2D map:
  var view = new MapView(viewOptions);
  
  view.whenLayerView(fl).then(function(layerView) {
    // console.log('layerView', layerView);
    // do something with the layerView
    updateLayer(fl, layerView);
    resetTimer();
    // every 15 seconds update the graphicsLayer:
    setInterval(() => {
      updateLayer(fl, layerView);
      resetTimer();
    }, 15000);
  });

  
};
main();




Resources
