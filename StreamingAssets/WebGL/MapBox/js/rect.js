﻿!function (e) {
    if ("object" == typeof exports && "undefined" != typeof module) module.exports = e (); else if ("function" == typeof define && define.amd) define ([], e); else {
        var t;
        t = "undefined" != typeof window ? window : "undefined" != typeof global ? global : "undefined" != typeof self ? self : this, t.DrawRectangle = e ()
    }
} (function () {
    return function () {
        function e(t, n, o) {
            function i(r, l) {
                if (!n[r]) {
                    if (!t[r]) {
                        var s = "function" == typeof require && require;
                        if (!l && s) return s (r, !0);
                        if (a) return a (r, !0);
                        var u = new Error ("Cannot find module '" + r + "'");
                        throw u.code = "MODULE_NOT_FOUND", u
                    }
                    var d = n[r] = {exports: {}};
                    t[r][0].call (d.exports, function (e) {
                        return i (t[r][1][e] || e)
                    }, d, d.exports, e, t, n, o)
                }
                return n[r].exports
            }

            for (var a = "function" == typeof require && require, r = 0; r < o.length; r++) i (o[r]);
            return i
        }

        return e
    } () ({
        1: [function (e, t, n) {
            "use strict";
            Object.defineProperty (n, "__esModule", {value: !0});
            var o = {
                enable: function (e) {
                    setTimeout (function () {
                        e.map && e.map.doubleClickZoom && e._ctx && e._ctx.store && e._ctx.store.getInitialConfigValue && e._ctx.store.getInitialConfigValue ("doubleClickZoom") && e.map.doubleClickZoom.enable ()
                    }, 0)
                }, disable: function (e) {
                    setTimeout (function () {
                        e.map && e.map.doubleClickZoom && e.map.doubleClickZoom.disable ()
                    }, 0)
                }
            }, i = {
                onSetup: function (e) {
                    var t = this.newFeature ({
                        type: "Feature",
                        properties: {},
                        geometry: {type: "Polygon", coordinates: [[]]}
                    });
                    return this.addFeature (t), this.clearSelectedFeatures (), o.disable (this), this.updateUIClasses ({mouse: "add"}), this.setActionableState ({trash: !0}), {rectangle: t}
                }, onClick: function (e, t) {
                    e.startPoint && e.startPoint[0] !== t.lngLat.lng && e.startPoint[1] !== t.lngLat.lat && (this.updateUIClasses ({mouse: "pointer"}), e.endPoint = [t.lngLat.lng, t.lngLat.lat], this.changeMode ("simple_select", {featuresId: e.rectangle.id}));
                    var n = [t.lngLat.lng, t.lngLat.lat];
                    e.startPoint = n
                }, onMouseMove: function (e, t) {
                    e.startPoint && (e.rectangle.updateCoordinate ("0.0", e.startPoint[0], e.startPoint[1]), e.rectangle.updateCoordinate ("0.1", t.lngLat.lng, e.startPoint[1]), e.rectangle.updateCoordinate ("0.2", t.lngLat.lng, t.lngLat.lat), e.rectangle.updateCoordinate ("0.3", e.startPoint[0], t.lngLat.lat), e.rectangle.updateCoordinate ("0.4", e.startPoint[0], e.startPoint[1]))
                }, onKeyUp: function (e, t) {
                    if (27 === t.keyCode) return this.changeMode ("simple_select")
                }, onStop: function (e) {
                    o.enable (this), this.updateUIClasses ({mouse: "none"}), this.activateUIButton (), void 0 !== this.getFeature (e.rectangle.id) && (e.rectangle.removeCoordinate ("0.4"), e.rectangle.isValid () ? this.map.fire ("draw.create", {features: [e.rectangle.toGeoJSON ()]}) : (this.deleteFeature ([e.rectangle.id], {silent: !0}), this.changeMode ("simple_select", {}, {silent: !0})))
                }, toDisplayFeatures: function (e, t, n) {
                    var o = t.properties.id === e.rectangle.id;
                    return t.properties.active = o ? "true" : "false", o ? e.startPoint ? n (t) : void 0 : n (t)
                }, onTrash: function (e) {
                    this.deleteFeature ([e.rectangle.id], {silent: !0}), this.changeMode ("simple_select")
                }
            };
            n.default = i
        }, {}]
    }, {}, [1]) (1)
});
