﻿(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.RotateMode = f()}})(function(){var define,module,exports;return (function(){function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s}return e})()({1:[function(require,module,exports){
        const distance = require('@turf/distance').default;
        const centroid = require('@turf/centroid').default;
        const bearing = require('@turf/bearing').default;
        const destination = require('@turf/destination').default;
        const EventEmitter = require('events');
        const emitter = new EventEmitter();

        var RotateMode = {

            rotatestart: function(selectedFeature,originalCenter) {},
            rotating: function(selectedFeature,originalCenter,lastMouseDown) {},
            rotateend: function(selectedFeature) {},

            onSetup: function(opts) {
                var state = {};

                emitter.addListener('rotatestart',function() {
                    this.rotatestart(state.selectedFeature,state.originalCenter)
                }.bind(this));
                emitter.addListener('rotating', function() {
                    this.rotating(state.selectedFeature,state.originalCenter,state.lastMouseDownLngLat)
                }.bind(this));
                emitter.addListener('rotateend', function() {
                    this.rotateend(state.selectedFeature,state.lastMouseDownLngLat)
                }.bind(this));

                state.selectedFeature = opts.selectedFeature || false;
                state.lastMouseDownLngLat = false;
                state.originalCenter = false;
                state.mode = 'rotate' || false;
                return state;
            },

            onMouseDown: function(state, e) {
                if(e.featureTarget) {
                    if(this._ctx.api.get(e.featureTarget.properties.id)) {
                        e.target['dragPan'].disable();
                        state.selectedFeature = this._ctx.api.get(e.featureTarget.properties.id);
                        state.originalCenter = centroid(e.featureTarget);
                        state.originalFeature = e.featureTarget;
                        emitter.emit('rotatestart');
                    }
                }
                return state;
            },

            toDisplayFeatures: function(state, geojson, display) {
                display(geojson);
            },

            onDrag: function(state, e) {
                if(state.selectedFeature&&state.mode) {
                    if(state.mode==='rotate') {
                        state.lastMouseDownLngLat = {lng:e.lngLat.lng, lat: e.lngLat.lat};
                        var draggedBearing = bearing(state.originalCenter, [e.lngLat.lng, e.lngLat.lat]);
                        var rotatedCoords = [];
                        switch (state.originalFeature.properties['meta:type']) {
                            case 'Point':
                                break;
                            case 'LineString':
                                state.originalFeature.geometry.coordinates.forEach(function(coords,index) {
                                    var distanceFromCenter = distance(state.originalCenter, coords);
                                    var bearingFromCenter = bearing(state.originalCenter, coords);
                                    var newPoint = destination(state.originalCenter, distanceFromCenter, bearingFromCenter+draggedBearing);
                                    rotatedCoords.push(newPoint.geometry.coordinates);
                                })
                                break;
                            case 'Polygon':
                                var polyCoords = [];
                                state.originalFeature.geometry.coordinates[0].forEach(function(coords,index) {
                                    var distanceFromCenter = distance(state.originalCenter, coords);
                                    var bearingFromCenter = bearing(state.originalCenter, coords);
                                    var newPoint = destination(state.originalCenter, distanceFromCenter, bearingFromCenter+draggedBearing);
                                    polyCoords.push(newPoint.geometry.coordinates);
                                })
                                rotatedCoords.push(polyCoords);
                                break;
                            case 'MultiLineString':
                                var multipolys = [];
                                state.originalFeature.geometry.coordinates.forEach(function(polygon,index) {
                                    var polyCoords = [];
                                    polygon.forEach(function(coords,index) {
                                        var distanceFromCenter = distance(state.originalCenter, coords);
                                        var bearingFromCenter = bearing(state.originalCenter, coords);
                                        var newPoint = destination(state.originalCenter, distanceFromCenter, bearingFromCenter+draggedBearing);
                                        polyCoords.push(newPoint.geometry.coordinates);
                                    })
                                    multipolys.push(polyCoords);
                                })
                                rotatedCoords = multipolys;
                                break;
                            case 'MultiPolygon':
                                var multipolys = [];
                                state.originalFeature.geometry.coordinates.forEach(function(polygon,index) {
                                    var polyCoords = [];
                                    polygon.forEach(function(polygonHoles,index) {
                                        var polyHoleCoords = [];
                                        polygonHoles.forEach(function(coords,index) {
                                            var distanceFromCenter = distance(state.originalCenter, coords);
                                            var bearingFromCenter = bearing(state.originalCenter, coords);
                                            var newPoint = destination(state.originalCenter, distanceFromCenter, bearingFromCenter+draggedBearing);
                                            polyHoleCoords.push(newPoint.geometry.coordinates);
                                        });
                                        polyCoords.push(polyHoleCoords);
                                    })
                                    multipolys.push(polyCoords);
                                })
                                rotatedCoords = multipolys;
                                break;
                            default:
                                return;
                        }
                        emitter.emit('rotating');
                        var newFeature = state.selectedFeature;
                        newFeature.geometry.coordinates = rotatedCoords;
                        var thisFeat = this._ctx.api.add(newFeature);
                    }
                }
            },

            onMouseUp: function(state, e) {
                e.target['dragPan'].enable();
                emitter.emit('rotateend');
                state.selectedFeature = false;
                state.lastMouseDownLngLat = false;
                state.originalCenter = false;
                return state;
            }
        }

        module.exports = RotateMode;

    },{"@turf/bearing":2,"@turf/centroid":5,"@turf/destination":6,"@turf/distance":7,"events":11}],2:[function(require,module,exports){
        'use strict';

        var invariant = require('@turf/invariant');
        var helpers = require('@turf/helpers');

//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html

        /**
         * Takes two {@link Point|points} and finds the geographic bearing between them,
         * i.e. the angle measured in degrees from the north line (0 degrees)
         *
         * @name bearing
         * @param {Coord} start starting Point
         * @param {Coord} end ending Point
         * @param {Object} [options={}] Optional parameters
         * @param {boolean} [options.final=false] calculates the final bearing if true
         * @returns {number} bearing in decimal degrees, between -180 and 180 degrees (positive clockwise)
         * @example
         * var point1 = turf.point([-75.343, 39.984]);
         * var point2 = turf.point([-75.534, 39.123]);
         *
         * var bearing = turf.bearing(point1, point2);
         *
         * //addToMap
         * var addToMap = [point1, point2]
         * point1.properties['marker-color'] = '#f00'
         * point2.properties['marker-color'] = '#0f0'
         * point1.properties.bearing = bearing
         */
        function bearing(start, end, options) {
            // Optional parameters
            options = options || {};
            if (!helpers.isObject(options)) throw new Error('options is invalid');
            var final = options.final;

            // Reverse calculation
            if (final === true) return calculateFinalBearing(start, end);

            var coordinates1 = invariant.getCoord(start);
            var coordinates2 = invariant.getCoord(end);

            var lon1 = helpers.degreesToRadians(coordinates1[0]);
            var lon2 = helpers.degreesToRadians(coordinates2[0]);
            var lat1 = helpers.degreesToRadians(coordinates1[1]);
            var lat2 = helpers.degreesToRadians(coordinates2[1]);
            var a = Math.sin(lon2 - lon1) * Math.cos(lat2);
            var b = Math.cos(lat1) * Math.sin(lat2) -
                Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

            return helpers.radiansToDegrees(Math.atan2(a, b));
        }

        /**
         * Calculates Final Bearing
         *
         * @private
         * @param {Coord} start starting Point
         * @param {Coord} end ending Point
         * @returns {number} bearing
         */
        function calculateFinalBearing(start, end) {
            // Swap start & end
            var bear = bearing(end, start);
            bear = (bear + 180) % 360;
            return bear;
        }

        module.exports = bearing;
        module.exports.default = bearing;

    },{"@turf/helpers":3,"@turf/invariant":4}],3:[function(require,module,exports){
        'use strict';

        Object.defineProperty(exports, '__esModule', { value: true });

        /**
         * Earth Radius used with the Harvesine formula and approximates using a spherical (non-ellipsoid) Earth.
         */
        var earthRadius = 6371008.8;

        /**
         * Unit of measurement factors using a spherical (non-ellipsoid) earth radius.
         */
        var factors = {
            meters: earthRadius,
            metres: earthRadius,
            millimeters: earthRadius * 1000,
            millimetres: earthRadius * 1000,
            centimeters: earthRadius * 100,
            centimetres: earthRadius * 100,
            kilometers: earthRadius / 1000,
            kilometres: earthRadius / 1000,
            miles: earthRadius / 1609.344,
            nauticalmiles: earthRadius / 1852,
            inches: earthRadius * 39.370,
            yards: earthRadius / 1.0936,
            feet: earthRadius * 3.28084,
            radians: 1,
            degrees: earthRadius / 111325,
        };

        /**
         * Units of measurement factors based on 1 meter.
         */
        var unitsFactors = {
            meters: 1,
            metres: 1,
            millimeters: 1000,
            millimetres: 1000,
            centimeters: 100,
            centimetres: 100,
            kilometers: 1 / 1000,
            kilometres: 1 / 1000,
            miles: 1 / 1609.344,
            nauticalmiles: 1 / 1852,
            inches: 39.370,
            yards: 1 / 1.0936,
            feet: 3.28084,
            radians: 1 / earthRadius,
            degrees: 1 / 111325,
        };

        /**
         * Area of measurement factors based on 1 square meter.
         */
        var areaFactors = {
            meters: 1,
            metres: 1,
            millimeters: 1000000,
            millimetres: 1000000,
            centimeters: 10000,
            centimetres: 10000,
            kilometers: 0.000001,
            kilometres: 0.000001,
            acres: 0.000247105,
            miles: 3.86e-7,
            yards: 1.195990046,
            feet: 10.763910417,
            inches: 1550.003100006
        };

        /**
         * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
         *
         * @name feature
         * @param {Geometry} geometry input geometry
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature} a GeoJSON Feature
         * @example
         * var geometry = {
         *   "type": "Point",
         *   "coordinates": [110, 50]
         * };
         *
         * var feature = turf.feature(geometry);
         *
         * //=feature
         */
        function feature(geometry, properties, options) {
            // Optional Parameters
            options = options || {};
            if (!isObject(options)) throw new Error('options is invalid');
            var bbox = options.bbox;
            var id = options.id;

            // Validation
            if (geometry === undefined) throw new Error('geometry is required');
            if (properties && properties.constructor !== Object) throw new Error('properties must be an Object');
            if (bbox) validateBBox(bbox);
            if (id) validateId(id);

            // Main
            var feat = {type: 'Feature'};
            if (id) feat.id = id;
            if (bbox) feat.bbox = bbox;
            feat.properties = properties || {};
            feat.geometry = geometry;
            return feat;
        }

        /**
         * Creates a GeoJSON {@link Geometry} from a Geometry string type & coordinates.
         * For GeometryCollection type use `helpers.geometryCollection`
         *
         * @name geometry
         * @param {string} type Geometry Type
         * @param {Array<number>} coordinates Coordinates
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Geometry
         * @returns {Geometry} a GeoJSON Geometry
         * @example
         * var type = 'Point';
         * var coordinates = [110, 50];
         *
         * var geometry = turf.geometry(type, coordinates);
         *
         * //=geometry
         */
        function geometry(type, coordinates, options) {
            // Optional Parameters
            options = options || {};
            if (!isObject(options)) throw new Error('options is invalid');
            var bbox = options.bbox;

            // Validation
            if (!type) throw new Error('type is required');
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');
            if (bbox) validateBBox(bbox);

            // Main
            var geom;
            switch (type) {
                case 'Point': geom = point(coordinates).geometry; break;
                case 'LineString': geom = lineString(coordinates).geometry; break;
                case 'Polygon': geom = polygon(coordinates).geometry; break;
                case 'MultiPoint': geom = multiPoint(coordinates).geometry; break;
                case 'MultiLineString': geom = multiLineString(coordinates).geometry; break;
                case 'MultiPolygon': geom = multiPolygon(coordinates).geometry; break;
                default: throw new Error(type + ' is invalid');
            }
            if (bbox) geom.bbox = bbox;
            return geom;
        }

        /**
         * Creates a {@link Point} {@link Feature} from a Position.
         *
         * @name point
         * @param {Array<number>} coordinates longitude, latitude position (each in decimal degrees)
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<Point>} a Point feature
         * @example
         * var point = turf.point([-75.343, 39.984]);
         *
         * //=point
         */
        function point(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');
            if (coordinates.length < 2) throw new Error('coordinates must be at least 2 numbers long');
            if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) throw new Error('coordinates must contain numbers');

            return feature({
                type: 'Point',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Point} {@link FeatureCollection} from an Array of Point coordinates.
         *
         * @name points
         * @param {Array<Array<number>>} coordinates an array of Points
         * @param {Object} [properties={}] Translate these properties to each Feature
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the FeatureCollection
         * @param {string|number} [options.id] Identifier associated with the FeatureCollection
         * @returns {FeatureCollection<Point>} Point Feature
         * @example
         * var points = turf.points([
         *   [-75, 39],
         *   [-80, 45],
         *   [-78, 50]
         * ]);
         *
         * //=points
         */
        function points(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');

            return featureCollection(coordinates.map(function (coords) {
                return point(coords, properties);
            }), options);
        }

        /**
         * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
         *
         * @name polygon
         * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<Polygon>} Polygon Feature
         * @example
         * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
         *
         * //=polygon
         */
        function polygon(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            for (var i = 0; i < coordinates.length; i++) {
                var ring = coordinates[i];
                if (ring.length < 4) {
                    throw new Error('Each LinearRing of a Polygon must have 4 or more Positions.');
                }
                for (var j = 0; j < ring[ring.length - 1].length; j++) {
                    // Check if first point of Polygon contains two numbers
                    if (i === 0 && j === 0 && !isNumber(ring[0][0]) || !isNumber(ring[0][1])) throw new Error('coordinates must contain numbers');
                    if (ring[ring.length - 1][j] !== ring[0][j]) {
                        throw new Error('First and last Position are not equivalent.');
                    }
                }
            }

            return feature({
                type: 'Polygon',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Polygon} {@link FeatureCollection} from an Array of Polygon coordinates.
         *
         * @name polygons
         * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygon coordinates
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the FeatureCollection
         * @returns {FeatureCollection<Polygon>} Polygon FeatureCollection
         * @example
         * var polygons = turf.polygons([
         *   [[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]],
         *   [[[-15, 42], [-14, 46], [-12, 41], [-17, 44], [-15, 42]]],
         * ]);
         *
         * //=polygons
         */
        function polygons(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');

            return featureCollection(coordinates.map(function (coords) {
                return polygon(coords, properties);
            }), options);
        }

        /**
         * Creates a {@link LineString} {@link Feature} from an Array of Positions.
         *
         * @name lineString
         * @param {Array<Array<number>>} coordinates an array of Positions
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<LineString>} LineString Feature
         * @example
         * var linestring1 = turf.lineString([[-24, 63], [-23, 60], [-25, 65], [-20, 69]], {name: 'line 1'});
         * var linestring2 = turf.lineString([[-14, 43], [-13, 40], [-15, 45], [-10, 49]], {name: 'line 2'});
         *
         * //=linestring1
         * //=linestring2
         */
        function lineString(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (coordinates.length < 2) throw new Error('coordinates must be an array of two or more positions');
            // Check if first point of LineString contains two numbers
            if (!isNumber(coordinates[0][1]) || !isNumber(coordinates[0][1])) throw new Error('coordinates must contain numbers');

            return feature({
                type: 'LineString',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link LineString} {@link FeatureCollection} from an Array of LineString coordinates.
         *
         * @name lineStrings
         * @param {Array<Array<number>>} coordinates an array of LinearRings
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the FeatureCollection
         * @param {string|number} [options.id] Identifier associated with the FeatureCollection
         * @returns {FeatureCollection<LineString>} LineString FeatureCollection
         * @example
         * var linestrings = turf.lineStrings([
         *   [[-24, 63], [-23, 60], [-25, 65], [-20, 69]],
         *   [[-14, 43], [-13, 40], [-15, 45], [-10, 49]]
         * ]);
         *
         * //=linestrings
         */
        function lineStrings(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');

            return featureCollection(coordinates.map(function (coords) {
                return lineString(coords, properties);
            }), options);
        }

        /**
         * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.
         *
         * @name featureCollection
         * @param {Feature[]} features input features
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {FeatureCollection} FeatureCollection of Features
         * @example
         * var locationA = turf.point([-75.343, 39.984], {name: 'Location A'});
         * var locationB = turf.point([-75.833, 39.284], {name: 'Location B'});
         * var locationC = turf.point([-75.534, 39.123], {name: 'Location C'});
         *
         * var collection = turf.featureCollection([
         *   locationA,
         *   locationB,
         *   locationC
         * ]);
         *
         * //=collection
         */
        function featureCollection(features, options) {
            // Optional Parameters
            options = options || {};
            if (!isObject(options)) throw new Error('options is invalid');
            var bbox = options.bbox;
            var id = options.id;

            // Validation
            if (!features) throw new Error('No features passed');
            if (!Array.isArray(features)) throw new Error('features must be an Array');
            if (bbox) validateBBox(bbox);
            if (id) validateId(id);

            // Main
            var fc = {type: 'FeatureCollection'};
            if (id) fc.id = id;
            if (bbox) fc.bbox = bbox;
            fc.features = features;
            return fc;
        }

        /**
         * Creates a {@link Feature<MultiLineString>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name multiLineString
         * @param {Array<Array<Array<number>>>} coordinates an array of LineStrings
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<MultiLineString>} a MultiLineString feature
         * @throws {Error} if no coordinates are passed
         * @example
         * var multiLine = turf.multiLineString([[[0,0],[10,10]]]);
         *
         * //=multiLine
         */
        function multiLineString(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            return feature({
                type: 'MultiLineString',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Feature<MultiPoint>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name multiPoint
         * @param {Array<Array<number>>} coordinates an array of Positions
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<MultiPoint>} a MultiPoint feature
         * @throws {Error} if no coordinates are passed
         * @example
         * var multiPt = turf.multiPoint([[0,0],[10,10]]);
         *
         * //=multiPt
         */
        function multiPoint(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            return feature({
                type: 'MultiPoint',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Feature<MultiPolygon>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name multiPolygon
         * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygons
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<MultiPolygon>} a multipolygon feature
         * @throws {Error} if no coordinates are passed
         * @example
         * var multiPoly = turf.multiPolygon([[[[0,0],[0,10],[10,10],[10,0],[0,0]]]]);
         *
         * //=multiPoly
         *
         */
        function multiPolygon(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            return feature({
                type: 'MultiPolygon',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Feature<GeometryCollection>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name geometryCollection
         * @param {Array<Geometry>} geometries an array of GeoJSON Geometries
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<GeometryCollection>} a GeoJSON GeometryCollection Feature
         * @example
         * var pt = {
         *     "type": "Point",
         *       "coordinates": [100, 0]
         *     };
         * var line = {
         *     "type": "LineString",
         *     "coordinates": [ [101, 0], [102, 1] ]
         *   };
         * var collection = turf.geometryCollection([pt, line]);
         *
         * //=collection
         */
        function geometryCollection(geometries, properties, options) {
            if (!geometries) throw new Error('geometries is required');
            if (!Array.isArray(geometries)) throw new Error('geometries must be an Array');

            return feature({
                type: 'GeometryCollection',
                geometries: geometries
            }, properties, options);
        }

        /**
         * Round number to precision
         *
         * @param {number} num Number
         * @param {number} [precision=0] Precision
         * @returns {number} rounded number
         * @example
         * turf.round(120.4321)
         * //=120
         *
         * turf.round(120.4321, 2)
         * //=120.43
         */
        function round(num, precision) {
            if (num === undefined || num === null || isNaN(num)) throw new Error('num is required');
            if (precision && !(precision >= 0)) throw new Error('precision must be a positive number');
            var multiplier = Math.pow(10, precision || 0);
            return Math.round(num * multiplier) / multiplier;
        }

        /**
         * Convert a distance measurement (assuming a spherical Earth) from radians to a more friendly unit.
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
         *
         * @name radiansToLength
         * @param {number} radians in radians across the sphere
         * @param {string} [units='kilometers'] can be degrees, radians, miles, or kilometers inches, yards, metres, meters, kilometres, kilometers.
         * @returns {number} distance
         */
        function radiansToLength(radians, units) {
            if (radians === undefined || radians === null) throw new Error('radians is required');

            if (units && typeof units !== 'string') throw new Error('units must be a string');
            var factor = factors[units || 'kilometers'];
            if (!factor) throw new Error(units + ' units is invalid');
            return radians * factor;
        }

        /**
         * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
         *
         * @name lengthToRadians
         * @param {number} distance in real units
         * @param {string} [units='kilometers'] can be degrees, radians, miles, or kilometers inches, yards, metres, meters, kilometres, kilometers.
         * @returns {number} radians
         */
        function lengthToRadians(distance, units) {
            if (distance === undefined || distance === null) throw new Error('distance is required');

            if (units && typeof units !== 'string') throw new Error('units must be a string');
            var factor = factors[units || 'kilometers'];
            if (!factor) throw new Error(units + ' units is invalid');
            return distance / factor;
        }

        /**
         * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into degrees
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, centimeters, kilometres, feet
         *
         * @name lengthToDegrees
         * @param {number} distance in real units
         * @param {string} [units='kilometers'] can be degrees, radians, miles, or kilometers inches, yards, metres, meters, kilometres, kilometers.
         * @returns {number} degrees
         */
        function lengthToDegrees(distance, units) {
            return radiansToDegrees(lengthToRadians(distance, units));
        }

        /**
         * Converts any bearing angle from the north line direction (positive clockwise)
         * and returns an angle between 0-360 degrees (positive clockwise), 0 being the north line
         *
         * @name bearingToAzimuth
         * @param {number} bearing angle, between -180 and +180 degrees
         * @returns {number} angle between 0 and 360 degrees
         */
        function bearingToAzimuth(bearing) {
            if (bearing === null || bearing === undefined) throw new Error('bearing is required');

            var angle = bearing % 360;
            if (angle < 0) angle += 360;
            return angle;
        }

        /**
         * Converts an angle in radians to degrees
         *
         * @name radiansToDegrees
         * @param {number} radians angle in radians
         * @returns {number} degrees between 0 and 360 degrees
         */
        function radiansToDegrees(radians) {
            if (radians === null || radians === undefined) throw new Error('radians is required');

            var degrees = radians % (2 * Math.PI);
            return degrees * 180 / Math.PI;
        }

        /**
         * Converts an angle in degrees to radians
         *
         * @name degreesToRadians
         * @param {number} degrees angle between 0 and 360 degrees
         * @returns {number} angle in radians
         */
        function degreesToRadians(degrees) {
            if (degrees === null || degrees === undefined) throw new Error('degrees is required');

            var radians = degrees % 360;
            return radians * Math.PI / 180;
        }

        /**
         * Converts a length to the requested unit.
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
         *
         * @param {number} length to be converted
         * @param {string} originalUnit of the length
         * @param {string} [finalUnit='kilometers'] returned unit
         * @returns {number} the converted length
         */
        function convertLength(length, originalUnit, finalUnit) {
            if (length === null || length === undefined) throw new Error('length is required');
            if (!(length >= 0)) throw new Error('length must be a positive number');

            return radiansToLength(lengthToRadians(length, originalUnit), finalUnit || 'kilometers');
        }

        /**
         * Converts a area to the requested unit.
         * Valid units: kilometers, kilometres, meters, metres, centimetres, millimeters, acres, miles, yards, feet, inches
         * @param {number} area to be converted
         * @param {string} [originalUnit='meters'] of the distance
         * @param {string} [finalUnit='kilometers'] returned unit
         * @returns {number} the converted distance
         */
        function convertArea(area, originalUnit, finalUnit) {
            if (area === null || area === undefined) throw new Error('area is required');
            if (!(area >= 0)) throw new Error('area must be a positive number');

            var startFactor = areaFactors[originalUnit || 'meters'];
            if (!startFactor) throw new Error('invalid original units');

            var finalFactor = areaFactors[finalUnit || 'kilometers'];
            if (!finalFactor) throw new Error('invalid final units');

            return (area / startFactor) * finalFactor;
        }

        /**
         * isNumber
         *
         * @param {*} num Number to validate
         * @returns {boolean} true/false
         * @example
         * turf.isNumber(123)
         * //=true
         * turf.isNumber('foo')
         * //=false
         */
        function isNumber(num) {
            return !isNaN(num) && num !== null && !Array.isArray(num);
        }

        /**
         * isObject
         *
         * @param {*} input variable to validate
         * @returns {boolean} true/false
         * @example
         * turf.isObject({elevation: 10})
         * //=true
         * turf.isObject('foo')
         * //=false
         */
        function isObject(input) {
            return (!!input) && (input.constructor === Object);
        }

        /**
         * Validate BBox
         *
         * @private
         * @param {Array<number>} bbox BBox to validate
         * @returns {void}
         * @throws Error if BBox is not valid
         * @example
         * validateBBox([-180, -40, 110, 50])
         * //=OK
         * validateBBox([-180, -40])
         * //=Error
         * validateBBox('Foo')
         * //=Error
         * validateBBox(5)
         * //=Error
         * validateBBox(null)
         * //=Error
         * validateBBox(undefined)
         * //=Error
         */
        function validateBBox(bbox) {
            if (!bbox) throw new Error('bbox is required');
            if (!Array.isArray(bbox)) throw new Error('bbox must be an Array');
            if (bbox.length !== 4 && bbox.length !== 6) throw new Error('bbox must be an Array of 4 or 6 numbers');
            bbox.forEach(function (num) {
                if (!isNumber(num)) throw new Error('bbox must only contain numbers');
            });
        }

        /**
         * Validate Id
         *
         * @private
         * @param {string|number} id Id to validate
         * @returns {void}
         * @throws Error if Id is not valid
         * @example
         * validateId([-180, -40, 110, 50])
         * //=Error
         * validateId([-180, -40])
         * //=Error
         * validateId('Foo')
         * //=OK
         * validateId(5)
         * //=OK
         * validateId(null)
         * //=Error
         * validateId(undefined)
         * //=Error
         */
        function validateId(id) {
            if (!id) throw new Error('id is required');
            if (['string', 'number'].indexOf(typeof id) === -1) throw new Error('id must be a number or a string');
        }

// Deprecated methods
        function radians2degrees() {
            throw new Error('method has been renamed to `radiansToDegrees`');
        }

        function degrees2radians() {
            throw new Error('method has been renamed to `degreesToRadians`');
        }

        function distanceToDegrees() {
            throw new Error('method has been renamed to `lengthToDegrees`');
        }

        function distanceToRadians() {
            throw new Error('method has been renamed to `lengthToRadians`');
        }

        function radiansToDistance() {
            throw new Error('method has been renamed to `radiansToLength`');
        }

        function bearingToAngle() {
            throw new Error('method has been renamed to `bearingToAzimuth`');
        }

        function convertDistance() {
            throw new Error('method has been renamed to `convertLength`');
        }

        exports.earthRadius = earthRadius;
        exports.factors = factors;
        exports.unitsFactors = unitsFactors;
        exports.areaFactors = areaFactors;
        exports.feature = feature;
        exports.geometry = geometry;
        exports.point = point;
        exports.points = points;
        exports.polygon = polygon;
        exports.polygons = polygons;
        exports.lineString = lineString;
        exports.lineStrings = lineStrings;
        exports.featureCollection = featureCollection;
        exports.multiLineString = multiLineString;
        exports.multiPoint = multiPoint;
        exports.multiPolygon = multiPolygon;
        exports.geometryCollection = geometryCollection;
        exports.round = round;
        exports.radiansToLength = radiansToLength;
        exports.lengthToRadians = lengthToRadians;
        exports.lengthToDegrees = lengthToDegrees;
        exports.bearingToAzimuth = bearingToAzimuth;
        exports.radiansToDegrees = radiansToDegrees;
        exports.degreesToRadians = degreesToRadians;
        exports.convertLength = convertLength;
        exports.convertArea = convertArea;
        exports.isNumber = isNumber;
        exports.isObject = isObject;
        exports.validateBBox = validateBBox;
        exports.validateId = validateId;
        exports.radians2degrees = radians2degrees;
        exports.degrees2radians = degrees2radians;
        exports.distanceToDegrees = distanceToDegrees;
        exports.distanceToRadians = distanceToRadians;
        exports.radiansToDistance = radiansToDistance;
        exports.bearingToAngle = bearingToAngle;
        exports.convertDistance = convertDistance;

    },{}],4:[function(require,module,exports){
        'use strict';

        Object.defineProperty(exports, '__esModule', { value: true });

        var helpers = require('@turf/helpers');

        /**
         * Unwrap a coordinate from a Point Feature, Geometry or a single coordinate.
         *
         * @name getCoord
         * @param {Array<number>|Geometry<Point>|Feature<Point>} coord GeoJSON Point or an Array of numbers
         * @returns {Array<number>} coordinates
         * @example
         * var pt = turf.point([10, 10]);
         *
         * var coord = turf.getCoord(pt);
         * //= [10, 10]
         */
        function getCoord(coord) {
            if (!coord) throw new Error('coord is required');
            if (coord.type === 'Feature' && coord.geometry !== null && coord.geometry.type === 'Point') return coord.geometry.coordinates;
            if (coord.type === 'Point') return coord.coordinates;
            if (Array.isArray(coord) && coord.length >= 2 && coord[0].length === undefined && coord[1].length === undefined) return coord;

            throw new Error('coord must be GeoJSON Point or an Array of numbers');
        }

        /**
         * Unwrap coordinates from a Feature, Geometry Object or an Array
         *
         * @name getCoords
         * @param {Array<any>|Geometry|Feature} coords Feature, Geometry Object or an Array
         * @returns {Array<any>} coordinates
         * @example
         * var poly = turf.polygon([[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]);
         *
         * var coords = turf.getCoords(poly);
         * //= [[[119.32, -8.7], [119.55, -8.69], [119.51, -8.54], [119.32, -8.7]]]
         */
        function getCoords(coords) {
            if (!coords) throw new Error('coords is required');

            // Feature
            if (coords.type === 'Feature' && coords.geometry !== null) return coords.geometry.coordinates;

            // Geometry
            if (coords.coordinates) return coords.coordinates;

            // Array of numbers
            if (Array.isArray(coords)) return coords;

            throw new Error('coords must be GeoJSON Feature, Geometry Object or an Array');
        }

        /**
         * Checks if coordinates contains a number
         *
         * @name containsNumber
         * @param {Array<any>} coordinates GeoJSON Coordinates
         * @returns {boolean} true if Array contains a number
         */
        function containsNumber(coordinates) {
            if (coordinates.length > 1 && helpers.isNumber(coordinates[0]) && helpers.isNumber(coordinates[1])) {
                return true;
            }

            if (Array.isArray(coordinates[0]) && coordinates[0].length) {
                return containsNumber(coordinates[0]);
            }
            throw new Error('coordinates must only contain numbers');
        }

        /**
         * Enforce expectations about types of GeoJSON objects for Turf.
         *
         * @name geojsonType
         * @param {GeoJSON} value any GeoJSON object
         * @param {string} type expected GeoJSON type
         * @param {string} name name of calling function
         * @throws {Error} if value is not the expected type.
         */
        function geojsonType(value, type, name) {
            if (!type || !name) throw new Error('type and name required');

            if (!value || value.type !== type) {
                throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + value.type);
            }
        }

        /**
         * Enforce expectations about types of {@link Feature} inputs for Turf.
         * Internally this uses {@link geojsonType} to judge geometry types.
         *
         * @name featureOf
         * @param {Feature} feature a feature with an expected geometry type
         * @param {string} type expected GeoJSON type
         * @param {string} name name of calling function
         * @throws {Error} error if value is not the expected type.
         */
        function featureOf(feature, type, name) {
            if (!feature) throw new Error('No feature passed');
            if (!name) throw new Error('.featureOf() requires a name');
            if (!feature || feature.type !== 'Feature' || !feature.geometry) {
                throw new Error('Invalid input to ' + name + ', Feature with geometry required');
            }
            if (!feature.geometry || feature.geometry.type !== type) {
                throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + feature.geometry.type);
            }
        }

        /**
         * Enforce expectations about types of {@link FeatureCollection} inputs for Turf.
         * Internally this uses {@link geojsonType} to judge geometry types.
         *
         * @name collectionOf
         * @param {FeatureCollection} featureCollection a FeatureCollection for which features will be judged
         * @param {string} type expected GeoJSON type
         * @param {string} name name of calling function
         * @throws {Error} if value is not the expected type.
         */
        function collectionOf(featureCollection, type, name) {
            if (!featureCollection) throw new Error('No featureCollection passed');
            if (!name) throw new Error('.collectionOf() requires a name');
            if (!featureCollection || featureCollection.type !== 'FeatureCollection') {
                throw new Error('Invalid input to ' + name + ', FeatureCollection required');
            }
            for (var i = 0; i < featureCollection.features.length; i++) {
                var feature = featureCollection.features[i];
                if (!feature || feature.type !== 'Feature' || !feature.geometry) {
                    throw new Error('Invalid input to ' + name + ', Feature with geometry required');
                }
                if (!feature.geometry || feature.geometry.type !== type) {
                    throw new Error('Invalid input to ' + name + ': must be a ' + type + ', given ' + feature.geometry.type);
                }
            }
        }

        /**
         * Get Geometry from Feature or Geometry Object
         *
         * @param {Feature|Geometry} geojson GeoJSON Feature or Geometry Object
         * @returns {Geometry|null} GeoJSON Geometry Object
         * @throws {Error} if geojson is not a Feature or Geometry Object
         * @example
         * var point = {
         *   "type": "Feature",
         *   "properties": {},
         *   "geometry": {
         *     "type": "Point",
         *     "coordinates": [110, 40]
         *   }
         * }
         * var geom = turf.getGeom(point)
         * //={"type": "Point", "coordinates": [110, 40]}
         */
        function getGeom(geojson) {
            if (!geojson) throw new Error('geojson is required');
            if (geojson.geometry !== undefined) return geojson.geometry;
            if (geojson.coordinates || geojson.geometries) return geojson;
            throw new Error('geojson must be a valid Feature or Geometry Object');
        }

        /**
         * Get Geometry Type from Feature or Geometry Object
         *
         * @throws {Error} **DEPRECATED** in v5.0.0 in favor of getType
         */
        function getGeomType() {
            throw new Error('invariant.getGeomType has been deprecated in v5.0 in favor of invariant.getType');
        }

        /**
         * Get GeoJSON object's type, Geometry type is prioritize.
         *
         * @param {GeoJSON} geojson GeoJSON object
         * @param {string} [name="geojson"] name of the variable to display in error message
         * @returns {string} GeoJSON type
         * @example
         * var point = {
         *   "type": "Feature",
         *   "properties": {},
         *   "geometry": {
         *     "type": "Point",
         *     "coordinates": [110, 40]
         *   }
         * }
         * var geom = turf.getType(point)
         * //="Point"
         */
        function getType(geojson, name) {
            if (!geojson) throw new Error((name || 'geojson') + ' is required');
            // GeoJSON Feature & GeometryCollection
            if (geojson.geometry && geojson.geometry.type) return geojson.geometry.type;
            // GeoJSON Geometry & FeatureCollection
            if (geojson.type) return geojson.type;
            throw new Error((name || 'geojson') + ' is invalid');
        }

        exports.getCoord = getCoord;
        exports.getCoords = getCoords;
        exports.containsNumber = containsNumber;
        exports.geojsonType = geojsonType;
        exports.featureOf = featureOf;
        exports.collectionOf = collectionOf;
        exports.getGeom = getGeom;
        exports.getGeomType = getGeomType;
        exports.getType = getType;

    },{"@turf/helpers":3}],5:[function(require,module,exports){
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        var meta_1 = require("@turf/meta");
        var helpers_1 = require("@turf/helpers");
        /**
         * Takes one or more features and calculates the centroid using the mean of all vertices.
         * This lessens the effect of small islands and artifacts when calculating the centroid of a set of polygons.
         *
         * @name centroid
         * @param {GeoJSON} geojson GeoJSON to be centered
         * @param {Object} [properties={}] an Object that is used as the {@link Feature}'s properties
         * @returns {Feature<Point>} the centroid of the input features
         * @example
         * var polygon = turf.polygon([[[-81, 41], [-88, 36], [-84, 31], [-80, 33], [-77, 39], [-81, 41]]]);
         *
         * var centroid = turf.centroid(polygon);
         *
         * //addToMap
         * var addToMap = [polygon, centroid]
         */
        function centroid(geojson, properties) {
            var xSum = 0;
            var ySum = 0;
            var len = 0;
            meta_1.coordEach(geojson, function (coord) {
                xSum += coord[0];
                ySum += coord[1];
                len++;
            });
            return helpers_1.point([xSum / len, ySum / len], properties);
        }
        exports.default = centroid;

    },{"@turf/helpers":8,"@turf/meta":10}],6:[function(require,module,exports){
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html
        var invariant_1 = require("@turf/invariant");
        var helpers_1 = require("@turf/helpers");
        /**
         * Takes a {@link Point} and calculates the location of a destination point given a distance in degrees, radians, miles, or kilometers; and bearing in degrees. This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.
         *
         * @name destination
         * @param {Coord} origin starting point
         * @param {number} distance distance from the origin point
         * @param {number} bearing ranging from -180 to 180
         * @param {Object} [options={}] Optional parameters
         * @param {string} [options.units='kilometers'] miles, kilometers, degrees, or radians
         * @param {Object} [options.properties={}] Translate properties to Point
         * @returns {Feature<Point>} destination point
         * @example
         * var point = turf.point([-75.343, 39.984]);
         * var distance = 50;
         * var bearing = 90;
         * var options = {units: 'miles'};
         *
         * var destination = turf.destination(point, distance, bearing, options);
         *
         * //addToMap
         * var addToMap = [point, destination]
         * destination.properties['marker-color'] = '#f00';
         * point.properties['marker-color'] = '#0f0';
         */
        function destination(origin, distance, bearing, options) {
            if (options === void 0) { options = {}; }
            // Handle input
            var coordinates1 = invariant_1.getCoord(origin);
            var longitude1 = helpers_1.degreesToRadians(coordinates1[0]);
            var latitude1 = helpers_1.degreesToRadians(coordinates1[1]);
            var bearing_rad = helpers_1.degreesToRadians(bearing);
            var radians = helpers_1.lengthToRadians(distance, options.units);
            // Main
            var latitude2 = Math.asin(Math.sin(latitude1) * Math.cos(radians) +
                Math.cos(latitude1) * Math.sin(radians) * Math.cos(bearing_rad));
            var longitude2 = longitude1 + Math.atan2(Math.sin(bearing_rad) * Math.sin(radians) * Math.cos(latitude1), Math.cos(radians) - Math.sin(latitude1) * Math.sin(latitude2));
            var lng = helpers_1.radiansToDegrees(longitude2);
            var lat = helpers_1.radiansToDegrees(latitude2);
            return helpers_1.point([lng, lat], options.properties);
        }
        exports.default = destination;

    },{"@turf/helpers":8,"@turf/invariant":9}],7:[function(require,module,exports){
        "use strict";
        Object.defineProperty(exports, "__esModule", { value: true });
        var invariant_1 = require("@turf/invariant");
        var helpers_1 = require("@turf/helpers");
//http://en.wikipedia.org/wiki/Haversine_formula
//http://www.movable-type.co.uk/scripts/latlong.html
        /**
         * Calculates the distance between two {@link Point|points} in degrees, radians, miles, or kilometers.
         * This uses the [Haversine formula](http://en.wikipedia.org/wiki/Haversine_formula) to account for global curvature.
         *
         * @name distance
         * @param {Coord} from origin point
         * @param {Coord} to destination point
         * @param {Object} [options={}] Optional parameters
         * @param {string} [options.units='kilometers'] can be degrees, radians, miles, or kilometers
         * @returns {number} distance between the two points
         * @example
         * var from = turf.point([-75.343, 39.984]);
         * var to = turf.point([-75.534, 39.123]);
         * var options = {units: 'miles'};
         *
         * var distance = turf.distance(from, to, options);
         *
         * //addToMap
         * var addToMap = [from, to];
         * from.properties.distance = distance;
         * to.properties.distance = distance;
         */
        function distance(from, to, options) {
            if (options === void 0) { options = {}; }
            var coordinates1 = invariant_1.getCoord(from);
            var coordinates2 = invariant_1.getCoord(to);
            var dLat = helpers_1.degreesToRadians((coordinates2[1] - coordinates1[1]));
            var dLon = helpers_1.degreesToRadians((coordinates2[0] - coordinates1[0]));
            var lat1 = helpers_1.degreesToRadians(coordinates1[1]);
            var lat2 = helpers_1.degreesToRadians(coordinates2[1]);
            var a = Math.pow(Math.sin(dLat / 2), 2) +
                Math.pow(Math.sin(dLon / 2), 2) * Math.cos(lat1) * Math.cos(lat2);
            return helpers_1.radiansToLength(2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)), options.units);
        }
        exports.default = distance;

    },{"@turf/helpers":8,"@turf/invariant":9}],8:[function(require,module,exports){
        'use strict';

        Object.defineProperty(exports, '__esModule', { value: true });

        /**
         * Earth Radius used with the Harvesine formula and approximates using a spherical (non-ellipsoid) Earth.
         */
        var earthRadius = 6371008.8;

        /**
         * Unit of measurement factors using a spherical (non-ellipsoid) earth radius.
         */
        var factors = {
            meters: earthRadius,
            metres: earthRadius,
            millimeters: earthRadius * 1000,
            millimetres: earthRadius * 1000,
            centimeters: earthRadius * 100,
            centimetres: earthRadius * 100,
            kilometers: earthRadius / 1000,
            kilometres: earthRadius / 1000,
            miles: earthRadius / 1609.344,
            nauticalmiles: earthRadius / 1852,
            inches: earthRadius * 39.370,
            yards: earthRadius / 1.0936,
            feet: earthRadius * 3.28084,
            radians: 1,
            degrees: earthRadius / 111325,
        };

        /**
         * Units of measurement factors based on 1 meter.
         */
        var unitsFactors = {
            meters: 1,
            metres: 1,
            millimeters: 1000,
            millimetres: 1000,
            centimeters: 100,
            centimetres: 100,
            kilometers: 1 / 1000,
            kilometres: 1 / 1000,
            miles: 1 / 1609.344,
            nauticalmiles: 1 / 1852,
            inches: 39.370,
            yards: 1 / 1.0936,
            feet: 3.28084,
            radians: 1 / earthRadius,
            degrees: 1 / 111325,
        };

        /**
         * Area of measurement factors based on 1 square meter.
         */
        var areaFactors = {
            meters: 1,
            metres: 1,
            millimeters: 1000000,
            millimetres: 1000000,
            centimeters: 10000,
            centimetres: 10000,
            kilometers: 0.000001,
            kilometres: 0.000001,
            acres: 0.000247105,
            miles: 3.86e-7,
            yards: 1.195990046,
            feet: 10.763910417,
            inches: 1550.003100006
        };

        /**
         * Wraps a GeoJSON {@link Geometry} in a GeoJSON {@link Feature}.
         *
         * @name feature
         * @param {Geometry} geometry input geometry
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature} a GeoJSON Feature
         * @example
         * var geometry = {
         *   "type": "Point",
         *   "coordinates": [110, 50]
         * };
         *
         * var feature = turf.feature(geometry);
         *
         * //=feature
         */
        function feature(geometry, properties, options) {
            // Optional Parameters
            options = options || {};
            if (!isObject(options)) throw new Error('options is invalid');
            var bbox = options.bbox;
            var id = options.id;

            // Validation
            if (geometry === undefined) throw new Error('geometry is required');
            if (properties && properties.constructor !== Object) throw new Error('properties must be an Object');
            if (bbox) validateBBox(bbox);
            if (id !== 0 && id) validateId(id);

            // Main
            var feat = {type: 'Feature'};
            if (id === 0 || id) feat.id = id;
            if (bbox) feat.bbox = bbox;
            feat.properties = properties || {};
            feat.geometry = geometry;
            return feat;
        }

        /**
         * Creates a GeoJSON {@link Geometry} from a Geometry string type & coordinates.
         * For GeometryCollection type use `helpers.geometryCollection`
         *
         * @name geometry
         * @param {string} type Geometry Type
         * @param {Array<number>} coordinates Coordinates
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Geometry
         * @returns {Geometry} a GeoJSON Geometry
         * @example
         * var type = 'Point';
         * var coordinates = [110, 50];
         *
         * var geometry = turf.geometry(type, coordinates);
         *
         * //=geometry
         */
        function geometry(type, coordinates, options) {
            // Optional Parameters
            options = options || {};
            if (!isObject(options)) throw new Error('options is invalid');
            var bbox = options.bbox;

            // Validation
            if (!type) throw new Error('type is required');
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');
            if (bbox) validateBBox(bbox);

            // Main
            var geom;
            switch (type) {
                case 'Point': geom = point(coordinates).geometry; break;
                case 'LineString': geom = lineString(coordinates).geometry; break;
                case 'Polygon': geom = polygon(coordinates).geometry; break;
                case 'MultiPoint': geom = multiPoint(coordinates).geometry; break;
                case 'MultiLineString': geom = multiLineString(coordinates).geometry; break;
                case 'MultiPolygon': geom = multiPolygon(coordinates).geometry; break;
                default: throw new Error(type + ' is invalid');
            }
            if (bbox) geom.bbox = bbox;
            return geom;
        }

        /**
         * Creates a {@link Point} {@link Feature} from a Position.
         *
         * @name point
         * @param {Array<number>} coordinates longitude, latitude position (each in decimal degrees)
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<Point>} a Point feature
         * @example
         * var point = turf.point([-75.343, 39.984]);
         *
         * //=point
         */
        function point(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');
            if (coordinates.length < 2) throw new Error('coordinates must be at least 2 numbers long');
            if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) throw new Error('coordinates must contain numbers');

            return feature({
                type: 'Point',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Point} {@link FeatureCollection} from an Array of Point coordinates.
         *
         * @name points
         * @param {Array<Array<number>>} coordinates an array of Points
         * @param {Object} [properties={}] Translate these properties to each Feature
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the FeatureCollection
         * @param {string|number} [options.id] Identifier associated with the FeatureCollection
         * @returns {FeatureCollection<Point>} Point Feature
         * @example
         * var points = turf.points([
         *   [-75, 39],
         *   [-80, 45],
         *   [-78, 50]
         * ]);
         *
         * //=points
         */
        function points(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');

            return featureCollection(coordinates.map(function (coords) {
                return point(coords, properties);
            }), options);
        }

        /**
         * Creates a {@link Polygon} {@link Feature} from an Array of LinearRings.
         *
         * @name polygon
         * @param {Array<Array<Array<number>>>} coordinates an array of LinearRings
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<Polygon>} Polygon Feature
         * @example
         * var polygon = turf.polygon([[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]], { name: 'poly1' });
         *
         * //=polygon
         */
        function polygon(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            for (var i = 0; i < coordinates.length; i++) {
                var ring = coordinates[i];
                if (ring.length < 4) {
                    throw new Error('Each LinearRing of a Polygon must have 4 or more Positions.');
                }
                for (var j = 0; j < ring[ring.length - 1].length; j++) {
                    // Check if first point of Polygon contains two numbers
                    if (i === 0 && j === 0 && !isNumber(ring[0][0]) || !isNumber(ring[0][1])) throw new Error('coordinates must contain numbers');
                    if (ring[ring.length - 1][j] !== ring[0][j]) {
                        throw new Error('First and last Position are not equivalent.');
                    }
                }
            }

            return feature({
                type: 'Polygon',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Polygon} {@link FeatureCollection} from an Array of Polygon coordinates.
         *
         * @name polygons
         * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygon coordinates
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the FeatureCollection
         * @returns {FeatureCollection<Polygon>} Polygon FeatureCollection
         * @example
         * var polygons = turf.polygons([
         *   [[[-5, 52], [-4, 56], [-2, 51], [-7, 54], [-5, 52]]],
         *   [[[-15, 42], [-14, 46], [-12, 41], [-17, 44], [-15, 42]]],
         * ]);
         *
         * //=polygons
         */
        function polygons(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');

            return featureCollection(coordinates.map(function (coords) {
                return polygon(coords, properties);
            }), options);
        }

        /**
         * Creates a {@link LineString} {@link Feature} from an Array of Positions.
         *
         * @name lineString
         * @param {Array<Array<number>>} coordinates an array of Positions
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<LineString>} LineString Feature
         * @example
         * var linestring1 = turf.lineString([[-24, 63], [-23, 60], [-25, 65], [-20, 69]], {name: 'line 1'});
         * var linestring2 = turf.lineString([[-14, 43], [-13, 40], [-15, 45], [-10, 49]], {name: 'line 2'});
         *
         * //=linestring1
         * //=linestring2
         */
        function lineString(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (coordinates.length < 2) throw new Error('coordinates must be an array of two or more positions');
            // Check if first point of LineString contains two numbers
            if (!isNumber(coordinates[0][1]) || !isNumber(coordinates[0][1])) throw new Error('coordinates must contain numbers');

            return feature({
                type: 'LineString',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link LineString} {@link FeatureCollection} from an Array of LineString coordinates.
         *
         * @name lineStrings
         * @param {Array<Array<number>>} coordinates an array of LinearRings
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the FeatureCollection
         * @param {string|number} [options.id] Identifier associated with the FeatureCollection
         * @returns {FeatureCollection<LineString>} LineString FeatureCollection
         * @example
         * var linestrings = turf.lineStrings([
         *   [[-24, 63], [-23, 60], [-25, 65], [-20, 69]],
         *   [[-14, 43], [-13, 40], [-15, 45], [-10, 49]]
         * ]);
         *
         * //=linestrings
         */
        function lineStrings(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');
            if (!Array.isArray(coordinates)) throw new Error('coordinates must be an Array');

            return featureCollection(coordinates.map(function (coords) {
                return lineString(coords, properties);
            }), options);
        }

        /**
         * Takes one or more {@link Feature|Features} and creates a {@link FeatureCollection}.
         *
         * @name featureCollection
         * @param {Feature[]} features input features
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {FeatureCollection} FeatureCollection of Features
         * @example
         * var locationA = turf.point([-75.343, 39.984], {name: 'Location A'});
         * var locationB = turf.point([-75.833, 39.284], {name: 'Location B'});
         * var locationC = turf.point([-75.534, 39.123], {name: 'Location C'});
         *
         * var collection = turf.featureCollection([
         *   locationA,
         *   locationB,
         *   locationC
         * ]);
         *
         * //=collection
         */
        function featureCollection(features, options) {
            // Optional Parameters
            options = options || {};
            if (!isObject(options)) throw new Error('options is invalid');
            var bbox = options.bbox;
            var id = options.id;

            // Validation
            if (!features) throw new Error('No features passed');
            if (!Array.isArray(features)) throw new Error('features must be an Array');
            if (bbox) validateBBox(bbox);
            if (id) validateId(id);

            // Main
            var fc = {type: 'FeatureCollection'};
            if (id) fc.id = id;
            if (bbox) fc.bbox = bbox;
            fc.features = features;
            return fc;
        }

        /**
         * Creates a {@link Feature<MultiLineString>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name multiLineString
         * @param {Array<Array<Array<number>>>} coordinates an array of LineStrings
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<MultiLineString>} a MultiLineString feature
         * @throws {Error} if no coordinates are passed
         * @example
         * var multiLine = turf.multiLineString([[[0,0],[10,10]]]);
         *
         * //=multiLine
         */
        function multiLineString(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            return feature({
                type: 'MultiLineString',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Feature<MultiPoint>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name multiPoint
         * @param {Array<Array<number>>} coordinates an array of Positions
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<MultiPoint>} a MultiPoint feature
         * @throws {Error} if no coordinates are passed
         * @example
         * var multiPt = turf.multiPoint([[0,0],[10,10]]);
         *
         * //=multiPt
         */
        function multiPoint(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            return feature({
                type: 'MultiPoint',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Feature<MultiPolygon>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name multiPolygon
         * @param {Array<Array<Array<Array<number>>>>} coordinates an array of Polygons
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<MultiPolygon>} a multipolygon feature
         * @throws {Error} if no coordinates are passed
         * @example
         * var multiPoly = turf.multiPolygon([[[[0,0],[0,10],[10,10],[10,0],[0,0]]]]);
         *
         * //=multiPoly
         *
         */
        function multiPolygon(coordinates, properties, options) {
            if (!coordinates) throw new Error('coordinates is required');

            return feature({
                type: 'MultiPolygon',
                coordinates: coordinates
            }, properties, options);
        }

        /**
         * Creates a {@link Feature<GeometryCollection>} based on a
         * coordinate array. Properties can be added optionally.
         *
         * @name geometryCollection
         * @param {Array<Geometry>} geometries an array of GeoJSON Geometries
         * @param {Object} [properties={}] an Object of key-value pairs to add as properties
         * @param {Object} [options={}] Optional Parameters
         * @param {Array<number>} [options.bbox] Bounding Box Array [west, south, east, north] associated with the Feature
         * @param {string|number} [options.id] Identifier associated with the Feature
         * @returns {Feature<GeometryCollection>} a GeoJSON GeometryCollection Feature
         * @example
         * var pt = {
         *     "type": "Point",
         *       "coordinates": [100, 0]
         *     };
         * var line = {
         *     "type": "LineString",
         *     "coordinates": [ [101, 0], [102, 1] ]
         *   };
         * var collection = turf.geometryCollection([pt, line]);
         *
         * //=collection
         */
        function geometryCollection(geometries, properties, options) {
            if (!geometries) throw new Error('geometries is required');
            if (!Array.isArray(geometries)) throw new Error('geometries must be an Array');

            return feature({
                type: 'GeometryCollection',
                geometries: geometries
            }, properties, options);
        }

        /**
         * Round number to precision
         *
         * @param {number} num Number
         * @param {number} [precision=0] Precision
         * @returns {number} rounded number
         * @example
         * turf.round(120.4321)
         * //=120
         *
         * turf.round(120.4321, 2)
         * //=120.43
         */
        function round(num, precision) {
            if (num === undefined || num === null || isNaN(num)) throw new Error('num is required');
            if (precision && !(precision >= 0)) throw new Error('precision must be a positive number');
            var multiplier = Math.pow(10, precision || 0);
            return Math.round(num * multiplier) / multiplier;
        }

        /**
         * Convert a distance measurement (assuming a spherical Earth) from radians to a more friendly unit.
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
         *
         * @name radiansToLength
         * @param {number} radians in radians across the sphere
         * @param {string} [units='kilometers'] can be degrees, radians, miles, or kilometers inches, yards, metres, meters, kilometres, kilometers.
         * @returns {number} distance
         */
        function radiansToLength(radians, units) {
            if (radians === undefined || radians === null) throw new Error('radians is required');

            if (units && typeof units !== 'string') throw new Error('units must be a string');
            var factor = factors[units || 'kilometers'];
            if (!factor) throw new Error(units + ' units is invalid');
            return radians * factor;
        }

        /**
         * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into radians
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
         *
         * @name lengthToRadians
         * @param {number} distance in real units
         * @param {string} [units='kilometers'] can be degrees, radians, miles, or kilometers inches, yards, metres, meters, kilometres, kilometers.
         * @returns {number} radians
         */
        function lengthToRadians(distance, units) {
            if (distance === undefined || distance === null) throw new Error('distance is required');

            if (units && typeof units !== 'string') throw new Error('units must be a string');
            var factor = factors[units || 'kilometers'];
            if (!factor) throw new Error(units + ' units is invalid');
            return distance / factor;
        }

        /**
         * Convert a distance measurement (assuming a spherical Earth) from a real-world unit into degrees
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, centimeters, kilometres, feet
         *
         * @name lengthToDegrees
         * @param {number} distance in real units
         * @param {string} [units='kilometers'] can be degrees, radians, miles, or kilometers inches, yards, metres, meters, kilometres, kilometers.
         * @returns {number} degrees
         */
        function lengthToDegrees(distance, units) {
            return radiansToDegrees(lengthToRadians(distance, units));
        }

        /**
         * Converts any bearing angle from the north line direction (positive clockwise)
         * and returns an angle between 0-360 degrees (positive clockwise), 0 being the north line
         *
         * @name bearingToAzimuth
         * @param {number} bearing angle, between -180 and +180 degrees
         * @returns {number} angle between 0 and 360 degrees
         */
        function bearingToAzimuth(bearing) {
            if (bearing === null || bearing === undefined) throw new Error('bearing is required');

            var angle = bearing % 360;
            if (angle < 0) angle += 360;
            return angle;
        }

        /**
         * Converts an angle in radians to degrees
         *
         * @name radiansToDegrees
         * @param {number} radians angle in radians
         * @returns {number} degrees between 0 and 360 degrees
         */
        function radiansToDegrees(radians) {
            if (radians === null || radians === undefined) throw new Error('radians is required');

            var degrees = radians % (2 * Math.PI);
            return degrees * 180 / Math.PI;
        }

        /**
         * Converts an angle in degrees to radians
         *
         * @name degreesToRadians
         * @param {number} degrees angle between 0 and 360 degrees
         * @returns {number} angle in radians
         */
        function degreesToRadians(degrees) {
            if (degrees === null || degrees === undefined) throw new Error('degrees is required');

            var radians = degrees % 360;
            return radians * Math.PI / 180;
        }

        /**
         * Converts a length to the requested unit.
         * Valid units: miles, nauticalmiles, inches, yards, meters, metres, kilometers, centimeters, feet
         *
         * @param {number} length to be converted
         * @param {string} originalUnit of the length
         * @param {string} [finalUnit='kilometers'] returned unit
         * @returns {number} the converted length
         */
        function convertLength(length, originalUnit, finalUnit) {
            if (length === null || length === undefined) throw new Error('length is required');
            if (!(length >= 0)) throw new Error('length must be a positive number');

            return radiansToLength(lengthToRadians(length, originalUnit), finalUnit || 'kilometers');
        }

        /**
         * Converts a area to the requested unit.
         * Valid units: kilometers, kilometres, meters, metres, centimetres, millimeters, acres, miles, yards, feet, inches
         * @param {number} area to be converted
         * @param {string} [originalUnit='meters'] of the distance
         * @param {string} [finalUnit='kilometers'] returned unit
         * @returns {number} the converted distance
         */
        function convertArea(area, originalUnit, finalUnit) {
            if (area === null || area === undefined) throw new Error('area is required');
            if (!(area >= 0)) throw new Error('area must be a positive number');

            var startFactor = areaFactors[originalUnit || 'meters'];
            if (!startFactor) throw new Error('invalid original units');

            var finalFactor = areaFactors[finalUnit || 'kilometers'];
            if (!finalFactor) throw new Error('invalid final units');

            return (area / startFactor) * finalFactor;
        }

        /**
         * isNumber
         *
         * @param {*} num Number to validate
         * @returns {boolean} true/false
         * @example
         * turf.isNumber(123)
         * //=true
         * turf.isNumber('foo')
         * //=false
         */
        function isNumber(num) {
            return !isNaN(num) && num !== null && !Array.isArray(num);
        }

        /**
         * isObject
         *
         * @param {*} input variable to validate
         * @returns {boolean} true/false
         * @example
         * turf.isObject({elevation: 10})
         * //=true
         * turf.isObject('foo')
         * //=false
         */
        function isObject(input) {
            return (!!input) && (input.constructor === Object);
        }

        /**
         * Validate BBox
         *
         * @private
         * @param {Array<number>} bbox BBox to validate
         * @returns {void}
         * @throws Error if BBox is not valid
         * @example
         * validateBBox([-180, -40, 110, 50])
         * //=OK
         * validateBBox([-180, -40])
         * //=Error
         * validateBBox('Foo')
         * //=Error
         * validateBBox(5)
         * //=Error
         * validateBBox(null)
         * //=Error
         * validateBBox(undefined)
         * //=Error
         */
        function validateBBox(bbox) {
            if (!bbox) throw new Error('bbox is required');
            if (!Array.isArray(bbox)) throw new Error('bbox must be an Array');
            if (bbox.length !== 4 && bbox.length !== 6) throw new Error('bbox must be an Array of 4 or 6 numbers');
            bbox.forEach(function (num) {
                if (!isNumber(num)) throw new Error('bbox must only contain numbers');
            });
        }

        /**
         * Validate Id
         *
         * @private
         * @param {string|number} id Id to validate
         * @returns {void}
         * @throws Error if Id is not valid
         * @example
         * validateId([-180, -40, 110, 50])
         * //=Error
         * validateId([-180, -40])
         * //=Error
         * validateId('Foo')
         * //=OK
         * validateId(5)
         * //=OK
         * validateId(null)
         * //=Error
         * validateId(undefined)
         * //=Error
         */
        function validateId(id) {
            if (!id) throw new Error('id is required');
            if (['string', 'number'].indexOf(typeof id) === -1) throw new Error('id must be a number or a string');
        }

// Deprecated methods
        function radians2degrees() {
            throw new Error('method has been renamed to `radiansToDegrees`');
        }

        function degrees2radians() {
            throw new Error('method has been renamed to `degreesToRadians`');
        }

        function distanceToDegrees() {
            throw new Error('method has been renamed to `lengthToDegrees`');
        }

        function distanceToRadians() {
            throw new Error('method has been renamed to `lengthToRadians`');
        }

        function radiansToDistance() {
            throw new Error('method has been renamed to `radiansToLength`');
        }

        function bearingToAngle() {
            throw new Error('method has been renamed to `bearingToAzimuth`');
        }

        function convertDistance() {
            throw new Error('method has been renamed to `convertLength`');
        }

        exports.earthRadius = earthRadius;
        exports.factors = factors;
        exports.unitsFactors = unitsFactors;
        exports.areaFactors = areaFactors;
        exports.feature = feature;
        exports.geometry = geometry;
        exports.point = point;
        exports.points = points;
        exports.polygon = polygon;
        exports.polygons = polygons;
        exports.lineString = lineString;
        exports.lineStrings = lineStrings;
        exports.featureCollection = featureCollection;
        exports.multiLineString = multiLineString;
        exports.multiPoint = multiPoint;
        exports.multiPolygon = multiPolygon;
        exports.geometryCollection = geometryCollection;
        exports.round = round;
        exports.radiansToLength = radiansToLength;
        exports.lengthToRadians = lengthToRadians;
        exports.lengthToDegrees = lengthToDegrees;
        exports.bearingToAzimuth = bearingToAzimuth;
        exports.radiansToDegrees = radiansToDegrees;
        exports.degreesToRadians = degreesToRadians;
        exports.convertLength = convertLength;
        exports.convertArea = convertArea;
        exports.isNumber = isNumber;
        exports.isObject = isObject;
        exports.validateBBox = validateBBox;
        exports.validateId = validateId;
        exports.radians2degrees = radians2degrees;
        exports.degrees2radians = degrees2radians;
        exports.distanceToDegrees = distanceToDegrees;
        exports.distanceToRadians = distanceToRadians;
        exports.radiansToDistance = radiansToDistance;
        exports.bearingToAngle = bearingToAngle;
        exports.convertDistance = convertDistance;

    },{}],9:[function(require,module,exports){
        arguments[4][4][0].apply(exports,arguments)
    },{"@turf/helpers":8,"dup":4}],10:[function(require,module,exports){
        'use strict';

        Object.defineProperty(exports, '__esModule', { value: true });

        var helpers = require('@turf/helpers');

        /**
         * Callback for coordEach
         *
         * @callback coordEachCallback
         * @param {Array<number>} currentCoord The current coordinate being processed.
         * @param {number} coordIndex The current index of the coordinate being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
         * @param {number} geometryIndex The current index of the Geometry being processed.
         */

        /**
         * Iterate over coordinates in any GeoJSON object, similar to Array.forEach()
         *
         * @name coordEach
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @param {Function} callback a method that takes (currentCoord, coordIndex, featureIndex, multiFeatureIndex)
         * @param {boolean} [excludeWrapCoord=false] whether or not to include the final coordinate of LinearRings that wraps the ring in its iteration.
         * @returns {void}
         * @example
         * var features = turf.featureCollection([
         *   turf.point([26, 37], {"foo": "bar"}),
         *   turf.point([36, 53], {"hello": "world"})
         * ]);
         *
         * turf.coordEach(features, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
         *   //=currentCoord
         *   //=coordIndex
         *   //=featureIndex
         *   //=multiFeatureIndex
         *   //=geometryIndex
         * });
         */
        function coordEach(geojson, callback, excludeWrapCoord) {
            // Handles null Geometry -- Skips this GeoJSON
            if (geojson === null) return;
            var j, k, l, geometry, stopG, coords,
                geometryMaybeCollection,
                wrapShrink = 0,
                coordIndex = 0,
                isGeometryCollection,
                type = geojson.type,
                isFeatureCollection = type === 'FeatureCollection',
                isFeature = type === 'Feature',
                stop = isFeatureCollection ? geojson.features.length : 1;

            // This logic may look a little weird. The reason why it is that way
            // is because it's trying to be fast. GeoJSON supports multiple kinds
            // of objects at its root: FeatureCollection, Features, Geometries.
            // This function has the responsibility of handling all of them, and that
            // means that some of the `for` loops you see below actually just don't apply
            // to certain inputs. For instance, if you give this just a
            // Point geometry, then both loops are short-circuited and all we do
            // is gradually rename the input until it's called 'geometry'.
            //
            // This also aims to allocate as few resources as possible: just a
            // few numbers and booleans, rather than any temporary arrays as would
            // be required with the normalization approach.
            for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
                geometryMaybeCollection = (isFeatureCollection ? geojson.features[featureIndex].geometry :
                    (isFeature ? geojson.geometry : geojson));
                isGeometryCollection = (geometryMaybeCollection) ? geometryMaybeCollection.type === 'GeometryCollection' : false;
                stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

                for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
                    var multiFeatureIndex = 0;
                    var geometryIndex = 0;
                    geometry = isGeometryCollection ?
                        geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;

                    // Handles null Geometry -- Skips this geometry
                    if (geometry === null) continue;
                    coords = geometry.coordinates;
                    var geomType = geometry.type;

                    wrapShrink = (excludeWrapCoord && (geomType === 'Polygon' || geomType === 'MultiPolygon')) ? 1 : 0;

                    switch (geomType) {
                        case null:
                            break;
                        case 'Point':
                            if (callback(coords, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                            coordIndex++;
                            multiFeatureIndex++;
                            break;
                        case 'LineString':
                        case 'MultiPoint':
                            for (j = 0; j < coords.length; j++) {
                                if (callback(coords[j], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                                coordIndex++;
                                if (geomType === 'MultiPoint') multiFeatureIndex++;
                            }
                            if (geomType === 'LineString') multiFeatureIndex++;
                            break;
                        case 'Polygon':
                        case 'MultiLineString':
                            for (j = 0; j < coords.length; j++) {
                                for (k = 0; k < coords[j].length - wrapShrink; k++) {
                                    if (callback(coords[j][k], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                                    coordIndex++;
                                }
                                if (geomType === 'MultiLineString') multiFeatureIndex++;
                                if (geomType === 'Polygon') geometryIndex++;
                            }
                            if (geomType === 'Polygon') multiFeatureIndex++;
                            break;
                        case 'MultiPolygon':
                            for (j = 0; j < coords.length; j++) {
                                if (geomType === 'MultiPolygon') geometryIndex = 0;
                                for (k = 0; k < coords[j].length; k++) {
                                    for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                                        if (callback(coords[j][k][l], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                                        coordIndex++;
                                    }
                                    geometryIndex++;
                                }
                                multiFeatureIndex++;
                            }
                            break;
                        case 'GeometryCollection':
                            for (j = 0; j < geometry.geometries.length; j++)
                                if (coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false) return false;
                            break;
                        default:
                            throw new Error('Unknown Geometry Type');
                    }
                }
            }
        }

        /**
         * Callback for coordReduce
         *
         * The first time the callback function is called, the values provided as arguments depend
         * on whether the reduce method has an initialValue argument.
         *
         * If an initialValue is provided to the reduce method:
         *  - The previousValue argument is initialValue.
         *  - The currentValue argument is the value of the first element present in the array.
         *
         * If an initialValue is not provided:
         *  - The previousValue argument is the value of the first element present in the array.
         *  - The currentValue argument is the value of the second element present in the array.
         *
         * @callback coordReduceCallback
         * @param {*} previousValue The accumulated value previously returned in the last invocation
         * of the callback, or initialValue, if supplied.
         * @param {Array<number>} currentCoord The current coordinate being processed.
         * @param {number} coordIndex The current index of the coordinate being processed.
         * Starts at index 0, if an initialValue is provided, and at index 1 otherwise.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
         * @param {number} geometryIndex The current index of the Geometry being processed.
         */

        /**
         * Reduce coordinates in any GeoJSON object, similar to Array.reduce()
         *
         * @name coordReduce
         * @param {FeatureCollection|Geometry|Feature} geojson any GeoJSON object
         * @param {Function} callback a method that takes (previousValue, currentCoord, coordIndex)
         * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
         * @param {boolean} [excludeWrapCoord=false] whether or not to include the final coordinate of LinearRings that wraps the ring in its iteration.
         * @returns {*} The value that results from the reduction.
         * @example
         * var features = turf.featureCollection([
         *   turf.point([26, 37], {"foo": "bar"}),
         *   turf.point([36, 53], {"hello": "world"})
         * ]);
         *
         * turf.coordReduce(features, function (previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
         *   //=previousValue
         *   //=currentCoord
         *   //=coordIndex
         *   //=featureIndex
         *   //=multiFeatureIndex
         *   //=geometryIndex
         *   return currentCoord;
         * });
         */
        function coordReduce(geojson, callback, initialValue, excludeWrapCoord) {
            var previousValue = initialValue;
            coordEach(geojson, function (currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) {
                if (coordIndex === 0 && initialValue === undefined) previousValue = currentCoord;
                else previousValue = callback(previousValue, currentCoord, coordIndex, featureIndex, multiFeatureIndex, geometryIndex);
            }, excludeWrapCoord);
            return previousValue;
        }

        /**
         * Callback for propEach
         *
         * @callback propEachCallback
         * @param {Object} currentProperties The current Properties being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         */

        /**
         * Iterate over properties in any GeoJSON object, similar to Array.forEach()
         *
         * @name propEach
         * @param {FeatureCollection|Feature} geojson any GeoJSON object
         * @param {Function} callback a method that takes (currentProperties, featureIndex)
         * @returns {void}
         * @example
         * var features = turf.featureCollection([
         *     turf.point([26, 37], {foo: 'bar'}),
         *     turf.point([36, 53], {hello: 'world'})
         * ]);
         *
         * turf.propEach(features, function (currentProperties, featureIndex) {
         *   //=currentProperties
         *   //=featureIndex
         * });
         */
        function propEach(geojson, callback) {
            var i;
            switch (geojson.type) {
                case 'FeatureCollection':
                    for (i = 0; i < geojson.features.length; i++) {
                        if (callback(geojson.features[i].properties, i) === false) break;
                    }
                    break;
                case 'Feature':
                    callback(geojson.properties, 0);
                    break;
            }
        }


        /**
         * Callback for propReduce
         *
         * The first time the callback function is called, the values provided as arguments depend
         * on whether the reduce method has an initialValue argument.
         *
         * If an initialValue is provided to the reduce method:
         *  - The previousValue argument is initialValue.
         *  - The currentValue argument is the value of the first element present in the array.
         *
         * If an initialValue is not provided:
         *  - The previousValue argument is the value of the first element present in the array.
         *  - The currentValue argument is the value of the second element present in the array.
         *
         * @callback propReduceCallback
         * @param {*} previousValue The accumulated value previously returned in the last invocation
         * of the callback, or initialValue, if supplied.
         * @param {*} currentProperties The current Properties being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         */

        /**
         * Reduce properties in any GeoJSON object into a single value,
         * similar to how Array.reduce works. However, in this case we lazily run
         * the reduction, so an array of all properties is unnecessary.
         *
         * @name propReduce
         * @param {FeatureCollection|Feature} geojson any GeoJSON object
         * @param {Function} callback a method that takes (previousValue, currentProperties, featureIndex)
         * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
         * @returns {*} The value that results from the reduction.
         * @example
         * var features = turf.featureCollection([
         *     turf.point([26, 37], {foo: 'bar'}),
         *     turf.point([36, 53], {hello: 'world'})
         * ]);
         *
         * turf.propReduce(features, function (previousValue, currentProperties, featureIndex) {
         *   //=previousValue
         *   //=currentProperties
         *   //=featureIndex
         *   return currentProperties
         * });
         */
        function propReduce(geojson, callback, initialValue) {
            var previousValue = initialValue;
            propEach(geojson, function (currentProperties, featureIndex) {
                if (featureIndex === 0 && initialValue === undefined) previousValue = currentProperties;
                else previousValue = callback(previousValue, currentProperties, featureIndex);
            });
            return previousValue;
        }

        /**
         * Callback for featureEach
         *
         * @callback featureEachCallback
         * @param {Feature<any>} currentFeature The current Feature being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         */

        /**
         * Iterate over features in any GeoJSON object, similar to
         * Array.forEach.
         *
         * @name featureEach
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @param {Function} callback a method that takes (currentFeature, featureIndex)
         * @returns {void}
         * @example
         * var features = turf.featureCollection([
         *   turf.point([26, 37], {foo: 'bar'}),
         *   turf.point([36, 53], {hello: 'world'})
         * ]);
         *
         * turf.featureEach(features, function (currentFeature, featureIndex) {
         *   //=currentFeature
         *   //=featureIndex
         * });
         */
        function featureEach(geojson, callback) {
            if (geojson.type === 'Feature') {
                callback(geojson, 0);
            } else if (geojson.type === 'FeatureCollection') {
                for (var i = 0; i < geojson.features.length; i++) {
                    if (callback(geojson.features[i], i) === false) break;
                }
            }
        }

        /**
         * Callback for featureReduce
         *
         * The first time the callback function is called, the values provided as arguments depend
         * on whether the reduce method has an initialValue argument.
         *
         * If an initialValue is provided to the reduce method:
         *  - The previousValue argument is initialValue.
         *  - The currentValue argument is the value of the first element present in the array.
         *
         * If an initialValue is not provided:
         *  - The previousValue argument is the value of the first element present in the array.
         *  - The currentValue argument is the value of the second element present in the array.
         *
         * @callback featureReduceCallback
         * @param {*} previousValue The accumulated value previously returned in the last invocation
         * of the callback, or initialValue, if supplied.
         * @param {Feature} currentFeature The current Feature being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         */

        /**
         * Reduce features in any GeoJSON object, similar to Array.reduce().
         *
         * @name featureReduce
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @param {Function} callback a method that takes (previousValue, currentFeature, featureIndex)
         * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
         * @returns {*} The value that results from the reduction.
         * @example
         * var features = turf.featureCollection([
         *   turf.point([26, 37], {"foo": "bar"}),
         *   turf.point([36, 53], {"hello": "world"})
         * ]);
         *
         * turf.featureReduce(features, function (previousValue, currentFeature, featureIndex) {
         *   //=previousValue
         *   //=currentFeature
         *   //=featureIndex
         *   return currentFeature
         * });
         */
        function featureReduce(geojson, callback, initialValue) {
            var previousValue = initialValue;
            featureEach(geojson, function (currentFeature, featureIndex) {
                if (featureIndex === 0 && initialValue === undefined) previousValue = currentFeature;
                else previousValue = callback(previousValue, currentFeature, featureIndex);
            });
            return previousValue;
        }

        /**
         * Get all coordinates from any GeoJSON object.
         *
         * @name coordAll
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @returns {Array<Array<number>>} coordinate position array
         * @example
         * var features = turf.featureCollection([
         *   turf.point([26, 37], {foo: 'bar'}),
         *   turf.point([36, 53], {hello: 'world'})
         * ]);
         *
         * var coords = turf.coordAll(features);
         * //= [[26, 37], [36, 53]]
         */
        function coordAll(geojson) {
            var coords = [];
            coordEach(geojson, function (coord) {
                coords.push(coord);
            });
            return coords;
        }

        /**
         * Callback for geomEach
         *
         * @callback geomEachCallback
         * @param {Geometry} currentGeometry The current Geometry being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {Object} featureProperties The current Feature Properties being processed.
         * @param {Array<number>} featureBBox The current Feature BBox being processed.
         * @param {number|string} featureId The current Feature Id being processed.
         */

        /**
         * Iterate over each geometry in any GeoJSON object, similar to Array.forEach()
         *
         * @name geomEach
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @param {Function} callback a method that takes (currentGeometry, featureIndex, featureProperties, featureBBox, featureId)
         * @returns {void}
         * @example
         * var features = turf.featureCollection([
         *     turf.point([26, 37], {foo: 'bar'}),
         *     turf.point([36, 53], {hello: 'world'})
         * ]);
         *
         * turf.geomEach(features, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
         *   //=currentGeometry
         *   //=featureIndex
         *   //=featureProperties
         *   //=featureBBox
         *   //=featureId
         * });
         */
        function geomEach(geojson, callback) {
            var i, j, g, geometry, stopG,
                geometryMaybeCollection,
                isGeometryCollection,
                featureProperties,
                featureBBox,
                featureId,
                featureIndex = 0,
                isFeatureCollection = geojson.type === 'FeatureCollection',
                isFeature = geojson.type === 'Feature',
                stop = isFeatureCollection ? geojson.features.length : 1;

            // This logic may look a little weird. The reason why it is that way
            // is because it's trying to be fast. GeoJSON supports multiple kinds
            // of objects at its root: FeatureCollection, Features, Geometries.
            // This function has the responsibility of handling all of them, and that
            // means that some of the `for` loops you see below actually just don't apply
            // to certain inputs. For instance, if you give this just a
            // Point geometry, then both loops are short-circuited and all we do
            // is gradually rename the input until it's called 'geometry'.
            //
            // This also aims to allocate as few resources as possible: just a
            // few numbers and booleans, rather than any temporary arrays as would
            // be required with the normalization approach.
            for (i = 0; i < stop; i++) {

                geometryMaybeCollection = (isFeatureCollection ? geojson.features[i].geometry :
                    (isFeature ? geojson.geometry : geojson));
                featureProperties = (isFeatureCollection ? geojson.features[i].properties :
                    (isFeature ? geojson.properties : {}));
                featureBBox = (isFeatureCollection ? geojson.features[i].bbox :
                    (isFeature ? geojson.bbox : undefined));
                featureId = (isFeatureCollection ? geojson.features[i].id :
                    (isFeature ? geojson.id : undefined));
                isGeometryCollection = (geometryMaybeCollection) ? geometryMaybeCollection.type === 'GeometryCollection' : false;
                stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;

                for (g = 0; g < stopG; g++) {
                    geometry = isGeometryCollection ?
                        geometryMaybeCollection.geometries[g] : geometryMaybeCollection;

                    // Handle null Geometry
                    if (geometry === null) {
                        if (callback(null, featureIndex, featureProperties, featureBBox, featureId) === false) return false;
                        continue;
                    }
                    switch (geometry.type) {
                        case 'Point':
                        case 'LineString':
                        case 'MultiPoint':
                        case 'Polygon':
                        case 'MultiLineString':
                        case 'MultiPolygon': {
                            if (callback(geometry, featureIndex, featureProperties, featureBBox, featureId) === false) return false;
                            break;
                        }
                        case 'GeometryCollection': {
                            for (j = 0; j < geometry.geometries.length; j++) {
                                if (callback(geometry.geometries[j], featureIndex, featureProperties, featureBBox, featureId) === false) return false;
                            }
                            break;
                        }
                        default:
                            throw new Error('Unknown Geometry Type');
                    }
                }
                // Only increase `featureIndex` per each feature
                featureIndex++;
            }
        }

        /**
         * Callback for geomReduce
         *
         * The first time the callback function is called, the values provided as arguments depend
         * on whether the reduce method has an initialValue argument.
         *
         * If an initialValue is provided to the reduce method:
         *  - The previousValue argument is initialValue.
         *  - The currentValue argument is the value of the first element present in the array.
         *
         * If an initialValue is not provided:
         *  - The previousValue argument is the value of the first element present in the array.
         *  - The currentValue argument is the value of the second element present in the array.
         *
         * @callback geomReduceCallback
         * @param {*} previousValue The accumulated value previously returned in the last invocation
         * of the callback, or initialValue, if supplied.
         * @param {Geometry} currentGeometry The current Geometry being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {Object} featureProperties The current Feature Properties being processed.
         * @param {Array<number>} featureBBox The current Feature BBox being processed.
         * @param {number|string} featureId The current Feature Id being processed.
         */

        /**
         * Reduce geometry in any GeoJSON object, similar to Array.reduce().
         *
         * @name geomReduce
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @param {Function} callback a method that takes (previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId)
         * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
         * @returns {*} The value that results from the reduction.
         * @example
         * var features = turf.featureCollection([
         *     turf.point([26, 37], {foo: 'bar'}),
         *     turf.point([36, 53], {hello: 'world'})
         * ]);
         *
         * turf.geomReduce(features, function (previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
         *   //=previousValue
         *   //=currentGeometry
         *   //=featureIndex
         *   //=featureProperties
         *   //=featureBBox
         *   //=featureId
         *   return currentGeometry
         * });
         */
        function geomReduce(geojson, callback, initialValue) {
            var previousValue = initialValue;
            geomEach(geojson, function (currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
                if (featureIndex === 0 && initialValue === undefined) previousValue = currentGeometry;
                else previousValue = callback(previousValue, currentGeometry, featureIndex, featureProperties, featureBBox, featureId);
            });
            return previousValue;
        }

        /**
         * Callback for flattenEach
         *
         * @callback flattenEachCallback
         * @param {Feature} currentFeature The current flattened feature being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
         */

        /**
         * Iterate over flattened features in any GeoJSON object, similar to
         * Array.forEach.
         *
         * @name flattenEach
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @param {Function} callback a method that takes (currentFeature, featureIndex, multiFeatureIndex)
         * @example
         * var features = turf.featureCollection([
         *     turf.point([26, 37], {foo: 'bar'}),
         *     turf.multiPoint([[40, 30], [36, 53]], {hello: 'world'})
         * ]);
         *
         * turf.flattenEach(features, function (currentFeature, featureIndex, multiFeatureIndex) {
         *   //=currentFeature
         *   //=featureIndex
         *   //=multiFeatureIndex
         * });
         */
        function flattenEach(geojson, callback) {
            geomEach(geojson, function (geometry, featureIndex, properties, bbox, id) {
                // Callback for single geometry
                var type = (geometry === null) ? null : geometry.type;
                switch (type) {
                    case null:
                    case 'Point':
                    case 'LineString':
                    case 'Polygon':
                        if (callback(helpers.feature(geometry, properties, {bbox: bbox, id: id}), featureIndex, 0) === false) return false;
                        return;
                }

                var geomType;

                // Callback for multi-geometry
                switch (type) {
                    case 'MultiPoint':
                        geomType = 'Point';
                        break;
                    case 'MultiLineString':
                        geomType = 'LineString';
                        break;
                    case 'MultiPolygon':
                        geomType = 'Polygon';
                        break;
                }

                for (var multiFeatureIndex = 0; multiFeatureIndex < geometry.coordinates.length; multiFeatureIndex++) {
                    var coordinate = geometry.coordinates[multiFeatureIndex];
                    var geom = {
                        type: geomType,
                        coordinates: coordinate
                    };
                    if (callback(helpers.feature(geom, properties), featureIndex, multiFeatureIndex) === false) return false;
                }
            });
        }

        /**
         * Callback for flattenReduce
         *
         * The first time the callback function is called, the values provided as arguments depend
         * on whether the reduce method has an initialValue argument.
         *
         * If an initialValue is provided to the reduce method:
         *  - The previousValue argument is initialValue.
         *  - The currentValue argument is the value of the first element present in the array.
         *
         * If an initialValue is not provided:
         *  - The previousValue argument is the value of the first element present in the array.
         *  - The currentValue argument is the value of the second element present in the array.
         *
         * @callback flattenReduceCallback
         * @param {*} previousValue The accumulated value previously returned in the last invocation
         * of the callback, or initialValue, if supplied.
         * @param {Feature} currentFeature The current Feature being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
         */

        /**
         * Reduce flattened features in any GeoJSON object, similar to Array.reduce().
         *
         * @name flattenReduce
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON object
         * @param {Function} callback a method that takes (previousValue, currentFeature, featureIndex, multiFeatureIndex)
         * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
         * @returns {*} The value that results from the reduction.
         * @example
         * var features = turf.featureCollection([
         *     turf.point([26, 37], {foo: 'bar'}),
         *     turf.multiPoint([[40, 30], [36, 53]], {hello: 'world'})
         * ]);
         *
         * turf.flattenReduce(features, function (previousValue, currentFeature, featureIndex, multiFeatureIndex) {
         *   //=previousValue
         *   //=currentFeature
         *   //=featureIndex
         *   //=multiFeatureIndex
         *   return currentFeature
         * });
         */
        function flattenReduce(geojson, callback, initialValue) {
            var previousValue = initialValue;
            flattenEach(geojson, function (currentFeature, featureIndex, multiFeatureIndex) {
                if (featureIndex === 0 && multiFeatureIndex === 0 && initialValue === undefined) previousValue = currentFeature;
                else previousValue = callback(previousValue, currentFeature, featureIndex, multiFeatureIndex);
            });
            return previousValue;
        }

        /**
         * Callback for segmentEach
         *
         * @callback segmentEachCallback
         * @param {Feature<LineString>} currentSegment The current Segment being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
         * @param {number} geometryIndex The current index of the Geometry being processed.
         * @param {number} segmentIndex The current index of the Segment being processed.
         * @returns {void}
         */

        /**
         * Iterate over 2-vertex line segment in any GeoJSON object, similar to Array.forEach()
         * (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
         *
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON
         * @param {Function} callback a method that takes (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex)
         * @returns {void}
         * @example
         * var polygon = turf.polygon([[[-50, 5], [-40, -10], [-50, -10], [-40, 5], [-50, 5]]]);
         *
         * // Iterate over GeoJSON by 2-vertex segments
         * turf.segmentEach(polygon, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
         *   //=currentSegment
         *   //=featureIndex
         *   //=multiFeatureIndex
         *   //=geometryIndex
         *   //=segmentIndex
         * });
         *
         * // Calculate the total number of segments
         * var total = 0;
         * turf.segmentEach(polygon, function () {
         *     total++;
         * });
         */
        function segmentEach(geojson, callback) {
            flattenEach(geojson, function (feature$$1, featureIndex, multiFeatureIndex) {
                var segmentIndex = 0;

                // Exclude null Geometries
                if (!feature$$1.geometry) return;
                // (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
                var type = feature$$1.geometry.type;
                if (type === 'Point' || type === 'MultiPoint') return;

                // Generate 2-vertex line segments
                var previousCoords;
                if (coordEach(feature$$1, function (currentCoord, coordIndex, featureIndexCoord, mutliPartIndexCoord, geometryIndex) {
                    // Simulating a meta.coordReduce() since `reduce` operations cannot be stopped by returning `false`
                    if (previousCoords === undefined) {
                        previousCoords = currentCoord;
                        return;
                    }
                    var currentSegment = helpers.lineString([previousCoords, currentCoord], feature$$1.properties);
                    if (callback(currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) === false) return false;
                    segmentIndex++;
                    previousCoords = currentCoord;
                }) === false) return false;
            });
        }

        /**
         * Callback for segmentReduce
         *
         * The first time the callback function is called, the values provided as arguments depend
         * on whether the reduce method has an initialValue argument.
         *
         * If an initialValue is provided to the reduce method:
         *  - The previousValue argument is initialValue.
         *  - The currentValue argument is the value of the first element present in the array.
         *
         * If an initialValue is not provided:
         *  - The previousValue argument is the value of the first element present in the array.
         *  - The currentValue argument is the value of the second element present in the array.
         *
         * @callback segmentReduceCallback
         * @param {*} previousValue The accumulated value previously returned in the last invocation
         * of the callback, or initialValue, if supplied.
         * @param {Feature<LineString>} currentSegment The current Segment being processed.
         * @param {number} featureIndex The current index of the Feature being processed.
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed.
         * @param {number} geometryIndex The current index of the Geometry being processed.
         * @param {number} segmentIndex The current index of the Segment being processed.
         */

        /**
         * Reduce 2-vertex line segment in any GeoJSON object, similar to Array.reduce()
         * (Multi)Point geometries do not contain segments therefore they are ignored during this operation.
         *
         * @param {FeatureCollection|Feature|Geometry} geojson any GeoJSON
         * @param {Function} callback a method that takes (previousValue, currentSegment, currentIndex)
         * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
         * @returns {void}
         * @example
         * var polygon = turf.polygon([[[-50, 5], [-40, -10], [-50, -10], [-40, 5], [-50, 5]]]);
         *
         * // Iterate over GeoJSON by 2-vertex segments
         * turf.segmentReduce(polygon, function (previousSegment, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
         *   //= previousSegment
         *   //= currentSegment
         *   //= featureIndex
         *   //= multiFeatureIndex
         *   //= geometryIndex
         *   //= segmentInex
         *   return currentSegment
         * });
         *
         * // Calculate the total number of segments
         * var initialValue = 0
         * var total = turf.segmentReduce(polygon, function (previousValue) {
         *     previousValue++;
         *     return previousValue;
         * }, initialValue);
         */
        function segmentReduce(geojson, callback, initialValue) {
            var previousValue = initialValue;
            var started = false;
            segmentEach(geojson, function (currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex) {
                if (started === false && initialValue === undefined) previousValue = currentSegment;
                else previousValue = callback(previousValue, currentSegment, featureIndex, multiFeatureIndex, geometryIndex, segmentIndex);
                started = true;
            });
            return previousValue;
        }

        /**
         * Callback for lineEach
         *
         * @callback lineEachCallback
         * @param {Feature<LineString>} currentLine The current LineString|LinearRing being processed
         * @param {number} featureIndex The current index of the Feature being processed
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed
         * @param {number} geometryIndex The current index of the Geometry being processed
         */

        /**
         * Iterate over line or ring coordinates in LineString, Polygon, MultiLineString, MultiPolygon Features or Geometries,
         * similar to Array.forEach.
         *
         * @name lineEach
         * @param {Geometry|Feature<LineString|Polygon|MultiLineString|MultiPolygon>} geojson object
         * @param {Function} callback a method that takes (currentLine, featureIndex, multiFeatureIndex, geometryIndex)
         * @example
         * var multiLine = turf.multiLineString([
         *   [[26, 37], [35, 45]],
         *   [[36, 53], [38, 50], [41, 55]]
         * ]);
         *
         * turf.lineEach(multiLine, function (currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
         *   //=currentLine
         *   //=featureIndex
         *   //=multiFeatureIndex
         *   //=geometryIndex
         * });
         */
        function lineEach(geojson, callback) {
            // validation
            if (!geojson) throw new Error('geojson is required');

            flattenEach(geojson, function (feature$$1, featureIndex, multiFeatureIndex) {
                if (feature$$1.geometry === null) return;
                var type = feature$$1.geometry.type;
                var coords = feature$$1.geometry.coordinates;
                switch (type) {
                    case 'LineString':
                        if (callback(feature$$1, featureIndex, multiFeatureIndex, 0, 0) === false) return false;
                        break;
                    case 'Polygon':
                        for (var geometryIndex = 0; geometryIndex < coords.length; geometryIndex++) {
                            if (callback(helpers.lineString(coords[geometryIndex], feature$$1.properties), featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                        }
                        break;
                }
            });
        }

        /**
         * Callback for lineReduce
         *
         * The first time the callback function is called, the values provided as arguments depend
         * on whether the reduce method has an initialValue argument.
         *
         * If an initialValue is provided to the reduce method:
         *  - The previousValue argument is initialValue.
         *  - The currentValue argument is the value of the first element present in the array.
         *
         * If an initialValue is not provided:
         *  - The previousValue argument is the value of the first element present in the array.
         *  - The currentValue argument is the value of the second element present in the array.
         *
         * @callback lineReduceCallback
         * @param {*} previousValue The accumulated value previously returned in the last invocation
         * of the callback, or initialValue, if supplied.
         * @param {Feature<LineString>} currentLine The current LineString|LinearRing being processed.
         * @param {number} featureIndex The current index of the Feature being processed
         * @param {number} multiFeatureIndex The current index of the Multi-Feature being processed
         * @param {number} geometryIndex The current index of the Geometry being processed
         */

        /**
         * Reduce features in any GeoJSON object, similar to Array.reduce().
         *
         * @name lineReduce
         * @param {Geometry|Feature<LineString|Polygon|MultiLineString|MultiPolygon>} geojson object
         * @param {Function} callback a method that takes (previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex)
         * @param {*} [initialValue] Value to use as the first argument to the first call of the callback.
         * @returns {*} The value that results from the reduction.
         * @example
         * var multiPoly = turf.multiPolygon([
         *   turf.polygon([[[12,48],[2,41],[24,38],[12,48]], [[9,44],[13,41],[13,45],[9,44]]]),
         *   turf.polygon([[[5, 5], [0, 0], [2, 2], [4, 4], [5, 5]]])
         * ]);
         *
         * turf.lineReduce(multiPoly, function (previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
         *   //=previousValue
         *   //=currentLine
         *   //=featureIndex
         *   //=multiFeatureIndex
         *   //=geometryIndex
         *   return currentLine
         * });
         */
        function lineReduce(geojson, callback, initialValue) {
            var previousValue = initialValue;
            lineEach(geojson, function (currentLine, featureIndex, multiFeatureIndex, geometryIndex) {
                if (featureIndex === 0 && initialValue === undefined) previousValue = currentLine;
                else previousValue = callback(previousValue, currentLine, featureIndex, multiFeatureIndex, geometryIndex);
            });
            return previousValue;
        }

        /**
         * Finds a particular 2-vertex LineString Segment from a GeoJSON using `@turf/meta` indexes.
         *
         * Negative indexes are permitted.
         * Point & MultiPoint will always return null.
         *
         * @param {FeatureCollection|Feature|Geometry} geojson Any GeoJSON Feature or Geometry
         * @param {Object} [options={}] Optional parameters
         * @param {number} [options.featureIndex=0] Feature Index
         * @param {number} [options.multiFeatureIndex=0] Multi-Feature Index
         * @param {number} [options.geometryIndex=0] Geometry Index
         * @param {number} [options.segmentIndex=0] Segment Index
         * @param {Object} [options.properties={}] Translate Properties to output LineString
         * @param {BBox} [options.bbox={}] Translate BBox to output LineString
         * @param {number|string} [options.id={}] Translate Id to output LineString
         * @returns {Feature<LineString>} 2-vertex GeoJSON Feature LineString
         * @example
         * var multiLine = turf.multiLineString([
         *     [[10, 10], [50, 30], [30, 40]],
         *     [[-10, -10], [-50, -30], [-30, -40]]
         * ]);
         *
         * // First Segment (defaults are 0)
         * turf.findSegment(multiLine);
         * // => Feature<LineString<[[10, 10], [50, 30]]>>
         *
         * // First Segment of 2nd Multi Feature
         * turf.findSegment(multiLine, {multiFeatureIndex: 1});
         * // => Feature<LineString<[[-10, -10], [-50, -30]]>>
         *
         * // Last Segment of Last Multi Feature
         * turf.findSegment(multiLine, {multiFeatureIndex: -1, segmentIndex: -1});
         * // => Feature<LineString<[[-50, -30], [-30, -40]]>>
         */
        function findSegment(geojson, options) {
            // Optional Parameters
            options = options || {};
            if (!helpers.isObject(options)) throw new Error('options is invalid');
            var featureIndex = options.featureIndex || 0;
            var multiFeatureIndex = options.multiFeatureIndex || 0;
            var geometryIndex = options.geometryIndex || 0;
            var segmentIndex = options.segmentIndex || 0;

            // Find FeatureIndex
            var properties = options.properties;
            var geometry;

            switch (geojson.type) {
                case 'FeatureCollection':
                    if (featureIndex < 0) featureIndex = geojson.features.length + featureIndex;
                    properties = properties || geojson.features[featureIndex].properties;
                    geometry = geojson.features[featureIndex].geometry;
                    break;
                case 'Feature':
                    properties = properties || geojson.properties;
                    geometry = geojson.geometry;
                    break;
                case 'Point':
                case 'MultiPoint':
                    return null;
                case 'LineString':
                case 'Polygon':
                case 'MultiLineString':
                case 'MultiPolygon':
                    geometry = geojson;
                    break;
                default:
                    throw new Error('geojson is invalid');
            }

            // Find SegmentIndex
            if (geometry === null) return null;
            var coords = geometry.coordinates;
            switch (geometry.type) {
                case 'Point':
                case 'MultiPoint':
                    return null;
                case 'LineString':
                    if (segmentIndex < 0) segmentIndex = coords.length + segmentIndex - 1;
                    return helpers.lineString([coords[segmentIndex], coords[segmentIndex + 1]], properties, options);
                case 'Polygon':
                    if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
                    if (segmentIndex < 0) segmentIndex = coords[geometryIndex].length + segmentIndex - 1;
                    return helpers.lineString([coords[geometryIndex][segmentIndex], coords[geometryIndex][segmentIndex + 1]], properties, options);
                case 'MultiLineString':
                    if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
                    if (segmentIndex < 0) segmentIndex = coords[multiFeatureIndex].length + segmentIndex - 1;
                    return helpers.lineString([coords[multiFeatureIndex][segmentIndex], coords[multiFeatureIndex][segmentIndex + 1]], properties, options);
                case 'MultiPolygon':
                    if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
                    if (geometryIndex < 0) geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
                    if (segmentIndex < 0) segmentIndex = coords[multiFeatureIndex][geometryIndex].length - segmentIndex - 1;
                    return helpers.lineString([coords[multiFeatureIndex][geometryIndex][segmentIndex], coords[multiFeatureIndex][geometryIndex][segmentIndex + 1]], properties, options);
            }
            throw new Error('geojson is invalid');
        }

        /**
         * Finds a particular Point from a GeoJSON using `@turf/meta` indexes.
         *
         * Negative indexes are permitted.
         *
         * @param {FeatureCollection|Feature|Geometry} geojson Any GeoJSON Feature or Geometry
         * @param {Object} [options={}] Optional parameters
         * @param {number} [options.featureIndex=0] Feature Index
         * @param {number} [options.multiFeatureIndex=0] Multi-Feature Index
         * @param {number} [options.geometryIndex=0] Geometry Index
         * @param {number} [options.coordIndex=0] Coord Index
         * @param {Object} [options.properties={}] Translate Properties to output Point
         * @param {BBox} [options.bbox={}] Translate BBox to output Point
         * @param {number|string} [options.id={}] Translate Id to output Point
         * @returns {Feature<Point>} 2-vertex GeoJSON Feature Point
         * @example
         * var multiLine = turf.multiLineString([
         *     [[10, 10], [50, 30], [30, 40]],
         *     [[-10, -10], [-50, -30], [-30, -40]]
         * ]);
         *
         * // First Segment (defaults are 0)
         * turf.findPoint(multiLine);
         * // => Feature<Point<[10, 10]>>
         *
         * // First Segment of the 2nd Multi-Feature
         * turf.findPoint(multiLine, {multiFeatureIndex: 1});
         * // => Feature<Point<[-10, -10]>>
         *
         * // Last Segment of last Multi-Feature
         * turf.findPoint(multiLine, {multiFeatureIndex: -1, coordIndex: -1});
         * // => Feature<Point<[-30, -40]>>
         */
        function findPoint(geojson, options) {
            // Optional Parameters
            options = options || {};
            if (!helpers.isObject(options)) throw new Error('options is invalid');
            var featureIndex = options.featureIndex || 0;
            var multiFeatureIndex = options.multiFeatureIndex || 0;
            var geometryIndex = options.geometryIndex || 0;
            var coordIndex = options.coordIndex || 0;

            // Find FeatureIndex
            var properties = options.properties;
            var geometry;

            switch (geojson.type) {
                case 'FeatureCollection':
                    if (featureIndex < 0) featureIndex = geojson.features.length + featureIndex;
                    properties = properties || geojson.features[featureIndex].properties;
                    geometry = geojson.features[featureIndex].geometry;
                    break;
                case 'Feature':
                    properties = properties || geojson.properties;
                    geometry = geojson.geometry;
                    break;
                case 'Point':
                case 'MultiPoint':
                    return null;
                case 'LineString':
                case 'Polygon':
                case 'MultiLineString':
                case 'MultiPolygon':
                    geometry = geojson;
                    break;
                default:
                    throw new Error('geojson is invalid');
            }

            // Find Coord Index
            if (geometry === null) return null;
            var coords = geometry.coordinates;
            switch (geometry.type) {
                case 'Point':
                    return helpers.point(coords, properties, options);
                case 'MultiPoint':
                    if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
                    return helpers.point(coords[multiFeatureIndex], properties, options);
                case 'LineString':
                    if (coordIndex < 0) coordIndex = coords.length + coordIndex;
                    return helpers.point(coords[coordIndex], properties, options);
                case 'Polygon':
                    if (geometryIndex < 0) geometryIndex = coords.length + geometryIndex;
                    if (coordIndex < 0) coordIndex = coords[geometryIndex].length + coordIndex;
                    return helpers.point(coords[geometryIndex][coordIndex], properties, options);
                case 'MultiLineString':
                    if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
                    if (coordIndex < 0) coordIndex = coords[multiFeatureIndex].length + coordIndex;
                    return helpers.point(coords[multiFeatureIndex][coordIndex], properties, options);
                case 'MultiPolygon':
                    if (multiFeatureIndex < 0) multiFeatureIndex = coords.length + multiFeatureIndex;
                    if (geometryIndex < 0) geometryIndex = coords[multiFeatureIndex].length + geometryIndex;
                    if (coordIndex < 0) coordIndex = coords[multiFeatureIndex][geometryIndex].length - coordIndex;
                    return helpers.point(coords[multiFeatureIndex][geometryIndex][coordIndex], properties, options);
            }
            throw new Error('geojson is invalid');
        }

        exports.coordEach = coordEach;
        exports.coordReduce = coordReduce;
        exports.propEach = propEach;
        exports.propReduce = propReduce;
        exports.featureEach = featureEach;
        exports.featureReduce = featureReduce;
        exports.coordAll = coordAll;
        exports.geomEach = geomEach;
        exports.geomReduce = geomReduce;
        exports.flattenEach = flattenEach;
        exports.flattenReduce = flattenReduce;
        exports.segmentEach = segmentEach;
        exports.segmentReduce = segmentReduce;
        exports.lineEach = lineEach;
        exports.lineReduce = lineReduce;
        exports.findSegment = findSegment;
        exports.findPoint = findPoint;

    },{"@turf/helpers":8}],11:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

        var objectCreate = Object.create || objectCreatePolyfill
        var objectKeys = Object.keys || objectKeysPolyfill
        var bind = Function.prototype.bind || functionBindPolyfill

        function EventEmitter() {
            if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
                this._events = objectCreate(null);
                this._eventsCount = 0;
            }

            this._maxListeners = this._maxListeners || undefined;
        }
        module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
        EventEmitter.EventEmitter = EventEmitter;

        EventEmitter.prototype._events = undefined;
        EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
        var defaultMaxListeners = 10;

        var hasDefineProperty;
        try {
            var o = {};
            if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
            hasDefineProperty = o.x === 0;
        } catch (err) { hasDefineProperty = false }
        if (hasDefineProperty) {
            Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
                enumerable: true,
                get: function() {
                    return defaultMaxListeners;
                },
                set: function(arg) {
                    // check whether the input is a positive number (whose value is zero or
                    // greater and not a NaN).
                    if (typeof arg !== 'number' || arg < 0 || arg !== arg)
                        throw new TypeError('"defaultMaxListeners" must be a positive number');
                    defaultMaxListeners = arg;
                }
            });
        } else {
            EventEmitter.defaultMaxListeners = defaultMaxListeners;
        }

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
        EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
            if (typeof n !== 'number' || n < 0 || isNaN(n))
                throw new TypeError('"n" argument must be a positive number');
            this._maxListeners = n;
            return this;
        };

        function $getMaxListeners(that) {
            if (that._maxListeners === undefined)
                return EventEmitter.defaultMaxListeners;
            return that._maxListeners;
        }

        EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
            return $getMaxListeners(this);
        };

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
        function emitNone(handler, isFn, self) {
            if (isFn)
                handler.call(self);
            else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                    listeners[i].call(self);
            }
        }
        function emitOne(handler, isFn, self, arg1) {
            if (isFn)
                handler.call(self, arg1);
            else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                    listeners[i].call(self, arg1);
            }
        }
        function emitTwo(handler, isFn, self, arg1, arg2) {
            if (isFn)
                handler.call(self, arg1, arg2);
            else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                    listeners[i].call(self, arg1, arg2);
            }
        }
        function emitThree(handler, isFn, self, arg1, arg2, arg3) {
            if (isFn)
                handler.call(self, arg1, arg2, arg3);
            else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                    listeners[i].call(self, arg1, arg2, arg3);
            }
        }

        function emitMany(handler, isFn, self, args) {
            if (isFn)
                handler.apply(self, args);
            else {
                var len = handler.length;
                var listeners = arrayClone(handler, len);
                for (var i = 0; i < len; ++i)
                    listeners[i].apply(self, args);
            }
        }

        EventEmitter.prototype.emit = function emit(type) {
            var er, handler, len, args, i, events;
            var doError = (type === 'error');

            events = this._events;
            if (events)
                doError = (doError && events.error == null);
            else if (!doError)
                return false;

            // If there is no 'error' event listener then throw.
            if (doError) {
                if (arguments.length > 1)
                    er = arguments[1];
                if (er instanceof Error) {
                    throw er; // Unhandled 'error' event
                } else {
                    // At least give some kind of context to the user
                    var err = new Error('Unhandled "error" event. (' + er + ')');
                    err.context = er;
                    throw err;
                }
                return false;
            }

            handler = events[type];

            if (!handler)
                return false;

            var isFn = typeof handler === 'function';
            len = arguments.length;
            switch (len) {
                // fast cases
                case 1:
                    emitNone(handler, isFn, this);
                    break;
                case 2:
                    emitOne(handler, isFn, this, arguments[1]);
                    break;
                case 3:
                    emitTwo(handler, isFn, this, arguments[1], arguments[2]);
                    break;
                case 4:
                    emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
                    break;
                // slower
                default:
                    args = new Array(len - 1);
                    for (i = 1; i < len; i++)
                        args[i - 1] = arguments[i];
                    emitMany(handler, isFn, this, args);
            }

            return true;
        };

        function _addListener(target, type, listener, prepend) {
            var m;
            var events;
            var existing;

            if (typeof listener !== 'function')
                throw new TypeError('"listener" argument must be a function');

            events = target._events;
            if (!events) {
                events = target._events = objectCreate(null);
                target._eventsCount = 0;
            } else {
                // To avoid recursion in the case that type === "newListener"! Before
                // adding it to the listeners, first emit "newListener".
                if (events.newListener) {
                    target.emit('newListener', type,
                        listener.listener ? listener.listener : listener);

                    // Re-assign `events` because a newListener handler could have caused the
                    // this._events to be assigned to a new object
                    events = target._events;
                }
                existing = events[type];
            }

            if (!existing) {
                // Optimize the case of one listener. Don't need the extra array object.
                existing = events[type] = listener;
                ++target._eventsCount;
            } else {
                if (typeof existing === 'function') {
                    // Adding the second element, need to change to array.
                    existing = events[type] =
                        prepend ? [listener, existing] : [existing, listener];
                } else {
                    // If we've already got an array, just append.
                    if (prepend) {
                        existing.unshift(listener);
                    } else {
                        existing.push(listener);
                    }
                }

                // Check for listener leak
                if (!existing.warned) {
                    m = $getMaxListeners(target);
                    if (m && m > 0 && existing.length > m) {
                        existing.warned = true;
                        var w = new Error('Possible EventEmitter memory leak detected. ' +
                            existing.length + ' "' + String(type) + '" listeners ' +
                            'added. Use emitter.setMaxListeners() to ' +
                            'increase limit.');
                        w.name = 'MaxListenersExceededWarning';
                        w.emitter = target;
                        w.type = type;
                        w.count = existing.length;
                        if (typeof console === 'object' && console.warn) {
                            console.warn('%s: %s', w.name, w.message);
                        }
                    }
                }
            }

            return target;
        }

        EventEmitter.prototype.addListener = function addListener(type, listener) {
            return _addListener(this, type, listener, false);
        };

        EventEmitter.prototype.on = EventEmitter.prototype.addListener;

        EventEmitter.prototype.prependListener =
            function prependListener(type, listener) {
                return _addListener(this, type, listener, true);
            };

        function onceWrapper() {
            if (!this.fired) {
                this.target.removeListener(this.type, this.wrapFn);
                this.fired = true;
                switch (arguments.length) {
                    case 0:
                        return this.listener.call(this.target);
                    case 1:
                        return this.listener.call(this.target, arguments[0]);
                    case 2:
                        return this.listener.call(this.target, arguments[0], arguments[1]);
                    case 3:
                        return this.listener.call(this.target, arguments[0], arguments[1],
                            arguments[2]);
                    default:
                        var args = new Array(arguments.length);
                        for (var i = 0; i < args.length; ++i)
                            args[i] = arguments[i];
                        this.listener.apply(this.target, args);
                }
            }
        }

        function _onceWrap(target, type, listener) {
            var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
            var wrapped = bind.call(onceWrapper, state);
            wrapped.listener = listener;
            state.wrapFn = wrapped;
            return wrapped;
        }

        EventEmitter.prototype.once = function once(type, listener) {
            if (typeof listener !== 'function')
                throw new TypeError('"listener" argument must be a function');
            this.on(type, _onceWrap(this, type, listener));
            return this;
        };

        EventEmitter.prototype.prependOnceListener =
            function prependOnceListener(type, listener) {
                if (typeof listener !== 'function')
                    throw new TypeError('"listener" argument must be a function');
                this.prependListener(type, _onceWrap(this, type, listener));
                return this;
            };

// Emits a 'removeListener' event if and only if the listener was removed.
        EventEmitter.prototype.removeListener =
            function removeListener(type, listener) {
                var list, events, position, i, originalListener;

                if (typeof listener !== 'function')
                    throw new TypeError('"listener" argument must be a function');

                events = this._events;
                if (!events)
                    return this;

                list = events[type];
                if (!list)
                    return this;

                if (list === listener || list.listener === listener) {
                    if (--this._eventsCount === 0)
                        this._events = objectCreate(null);
                    else {
                        delete events[type];
                        if (events.removeListener)
                            this.emit('removeListener', type, list.listener || listener);
                    }
                } else if (typeof list !== 'function') {
                    position = -1;

                    for (i = list.length - 1; i >= 0; i--) {
                        if (list[i] === listener || list[i].listener === listener) {
                            originalListener = list[i].listener;
                            position = i;
                            break;
                        }
                    }

                    if (position < 0)
                        return this;

                    if (position === 0)
                        list.shift();
                    else
                        spliceOne(list, position);

                    if (list.length === 1)
                        events[type] = list[0];

                    if (events.removeListener)
                        this.emit('removeListener', type, originalListener || listener);
                }

                return this;
            };

        EventEmitter.prototype.removeAllListeners =
            function removeAllListeners(type) {
                var listeners, events, i;

                events = this._events;
                if (!events)
                    return this;

                // not listening for removeListener, no need to emit
                if (!events.removeListener) {
                    if (arguments.length === 0) {
                        this._events = objectCreate(null);
                        this._eventsCount = 0;
                    } else if (events[type]) {
                        if (--this._eventsCount === 0)
                            this._events = objectCreate(null);
                        else
                            delete events[type];
                    }
                    return this;
                }

                // emit removeListener for all listeners on all events
                if (arguments.length === 0) {
                    var keys = objectKeys(events);
                    var key;
                    for (i = 0; i < keys.length; ++i) {
                        key = keys[i];
                        if (key === 'removeListener') continue;
                        this.removeAllListeners(key);
                    }
                    this.removeAllListeners('removeListener');
                    this._events = objectCreate(null);
                    this._eventsCount = 0;
                    return this;
                }

                listeners = events[type];

                if (typeof listeners === 'function') {
                    this.removeListener(type, listeners);
                } else if (listeners) {
                    // LIFO order
                    for (i = listeners.length - 1; i >= 0; i--) {
                        this.removeListener(type, listeners[i]);
                    }
                }

                return this;
            };

        EventEmitter.prototype.listeners = function listeners(type) {
            var evlistener;
            var ret;
            var events = this._events;

            if (!events)
                ret = [];
            else {
                evlistener = events[type];
                if (!evlistener)
                    ret = [];
                else if (typeof evlistener === 'function')
                    ret = [evlistener.listener || evlistener];
                else
                    ret = unwrapListeners(evlistener);
            }

            return ret;
        };

        EventEmitter.listenerCount = function(emitter, type) {
            if (typeof emitter.listenerCount === 'function') {
                return emitter.listenerCount(type);
            } else {
                return listenerCount.call(emitter, type);
            }
        };

        EventEmitter.prototype.listenerCount = listenerCount;
        function listenerCount(type) {
            var events = this._events;

            if (events) {
                var evlistener = events[type];

                if (typeof evlistener === 'function') {
                    return 1;
                } else if (evlistener) {
                    return evlistener.length;
                }
            }

            return 0;
        }

        EventEmitter.prototype.eventNames = function eventNames() {
            return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
        };

// About 1.5x faster than the two-arg version of Array#splice().
        function spliceOne(list, index) {
            for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
                list[i] = list[k];
            list.pop();
        }

        function arrayClone(arr, n) {
            var copy = new Array(n);
            for (var i = 0; i < n; ++i)
                copy[i] = arr[i];
            return copy;
        }

        function unwrapListeners(arr) {
            var ret = new Array(arr.length);
            for (var i = 0; i < ret.length; ++i) {
                ret[i] = arr[i].listener || arr[i];
            }
            return ret;
        }

        function objectCreatePolyfill(proto) {
            var F = function() {};
            F.prototype = proto;
            return new F;
        }
        function objectKeysPolyfill(obj) {
            var keys = [];
            for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
                keys.push(k);
            }
            return k;
        }
        function functionBindPolyfill(context) {
            var fn = this;
            return function () {
                return fn.apply(context, arguments);
            };
        }

    },{}]},{},[1])(1)
});