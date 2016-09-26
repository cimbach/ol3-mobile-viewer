/**
 * LausanneSearch based on WSGI search from QGIS Web Client
 */

function LausanneSearch(url, geomUrl, showHighlightLabel) {
  // search URL
  this.url = url;
  // geometry URL for highlighting
  this.geomUrl = geomUrl;
  // show highlight label
  this.showHighlightLabel = showHighlightLabel;
}

// inherit from Search
LausanneSearch.prototype = new Search();

/**
 * submit search query
 */
LausanneSearch.prototype.submit = function(searchParams, callback) {
  var request = $.ajax({
    url: this.url,
    data: {
      query: $.trim(searchParams)
    },
    dataType: 'jsonp',
    context: this
  });

  request.done(function(data, status) {
    this.parseResults(data, status, callback);
  });

  request.fail(function(jqXHR, status) {
    alert(I18n.search.failed + "\n" + jqXHR.status + ": " + jqXHR.statusText);
  });
};

/**
 * parse query result and invoke the callback with search result features
 *
 * [
 *   {
 *     category: <category>, // null to hide
 *     results: [
 *       {
 *         name: <visible name>,
 *         highlight: {
 *           searchtable: <search table>,
 *           displaytext: <string for search>,
 *         },
 *         bbox: [<minx>, <miny>, <maxx>, <maxy>]
 *       }
 *     ]
 *   }
 * ]
 */
LausanneSearch.prototype.parseResults = function(data, status, callback) {
  // group by category
  var categories = {};
  var category = 'resultats';
  categories[category] = [];
  for (var i=0; i<data.features.length; i++) {
    var result = data.features[i];
    if (result.bbox == null) {
      // add category
      category = result.displaytext;
      if (categories[category] === undefined) {
        categories[category] = [];
      }
    }
    else {
      // add result to current category
      categories[category].push({
        name: result.properties.label,
        highlight: {
          searchtable: result.searchtable,
          displaytext: result.displaytext
        },
        bbox: result.bbox
      });
    }
  }

  // convert to search results
  var results = $.map(categories, function(features, category) {
    return {
      category: category,
      results: features
    };
  });
  callback(results);
};

/**
 * create and add a highlight layer for the selected search result
 *
 * request geometry and add vector layer for highlighting
 *
 * highlight = {
 *   searchtable: <search table>,
 *   displaytext: <string for search and optional highlight label>,
 * }
 * callback(<OL3 layer>): add highlight layer to map
 */
LausanneSearch.prototype.highlight = function(highlight, callback) {
  // get geometry
  var request = $.ajax({
    url: this.geomUrl,
    data: {
      searchtable: highlight.searchtable,
      displaytext: highlight.displaytext
    },
    dataType: 'text',
  });

  var showHighlightLabel = this.showHighlightLabel;
  request.done(function(data, status) {
    // convert WKT to features
    var format = new ol.format.WKT({splitCollection: true});
    var features = format.readFeatures(data);

    if (showHighlightLabel && highlight.displaytext != null) {
      for (var featureIndex in features) {
        // adjust label text (remove last part in brackets)
        var labelstring = highlight.displaytext.replace(/ \([^\)]+\)$/, '');
        features[featureIndex].set('labelstring', labelstring);
      }
    }

    // feature style
    var style = function(feature, resolution) {
      var stroke = new ol.style.Stroke({
        color: 'rgba(255, 140, 0, 1.0)',
        width: 3
      });
      var fill = new ol.style.Fill({
        color: 'rgba(255, 140, 0, 0.3)'
      });

      var text = null;
      if (feature.get('labelstring')) {
        // label (NOTE: every subgeometry of a multigeometry is labeled)
        text = new ol.style.Text({
          text: feature.get('labelstring'),
          textAlign: 'center',
          textBaseline: 'bottom',
          offsetY: -5,
          font: 'normal 16px Helvetica,Arial,sans-serif',
          fill: new ol.style.Fill({
            color: 'rgba(0, 0, 0, 1.0)'
          }),
          stroke: new ol.style.Stroke({
            color: 'rgba(255, 255, 255, 1.0)',
            width: 2
          })
        });
      }

      return [new ol.style.Style({
        image: new ol.style.Circle({
          radius: 4,
          fill: fill,
          stroke: stroke
        }),
        fill: fill,
        stroke: stroke,
        text: text
      })];
    };

    // add highlight layer
    var layer = new ol.layer.Vector({
      source: new ol.source.Vector({
        features: features
      }),
      style: style
    });
    layer.name = 'highlight';
    callback(layer);
  });
};
