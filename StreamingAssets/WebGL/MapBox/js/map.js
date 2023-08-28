let pathPoints = [];
let draw;

function init () {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY21lb2RldiIsImEiOiJjbGxwNDN2bHMwMmU0M3FwZXJkNWNrYTFwIn0.ZcjQqSU2qF7xR38xEvnoUA';
    const map = new mapboxgl.Map ({
        container: 'map', // container ID
        style: 'mapbox://styles/mapbox/satellite-v9', // style URL
        center: [88.314204, 22.542378], // starting position [lng, lat]
        zoom: 17, // starting zoom
    });

    var modess = MapboxDraw.modes;
    modess.draw_rectangle = DrawRectangle.default;
    //draw a polygon
    draw = new MapboxDraw ({
        displayControlsDefault: false,
        draggable: false,
        controls: {
            polygon: true,
            trash: true,
            line_string: true
        },
        modes : modess
        
    });
    map.addControl (draw);
    draw.changeMode ('draw_rectangle');
    map.on('draw.create', function (feature) {
        //create a button to rotate the polygon
        var button = document.createElement('button');
        button.id = 'rotate';
        button.textContent = 'Rotate';
        button.style.cssText = 'position:absolute;top:10px;left:10px;z-index:10;';
        document.body.appendChild(button);
        //rotate the polygon when the button is hovered by mouse position
        button.onmouseover = function () {
            var poly = turf.polygon(feature.features[0].geometry.coordinates);
            
            // rotate the polygon clockwise by mouse position
            
            var rotatedPoly = turf.transformRotate(poly, (deegre+90));
            console.log(rotatedPoly);
            draw.deleteAll();
            draw.add(rotatedPoly);
        };
        
        
        button.onclick = function () {
            
            var poly = turf.polygon(feature.features[0].geometry.coordinates);
            var rotatedPoly = turf.transformRotate(poly, 90);
            console.log(rotatedPoly);
            draw.deleteAll();
            draw.add(rotatedPoly);

        };
    });
    map.on('draw.update', function (feature) {
        console.log (feature);
    });
    map.on('draw.delete', function (feature) {
        console.log (feature);
    });
    map.on('draw.selectionchange', function (feature) {
        console.log (feature);
    });
    // map.on ('draw.create', updateArea);
    // map.on ('draw.delete', updateArea);
    // map.on ('draw.update', updateArea);

    function updateArea () {
        console.log (draw.getAll ());
        pathPoints = draw.getAll ()
        const area = turf.area (draw.getAll ());
        console.log ('area ' + area);
        for (let i = 0; i < pathPoints.features[0].geometry.coordinates[0].length; i++) {
            const element = pathPoints.features[0].geometry.coordinates[0][i];
            const p1 = turf.point (element);
            const p2 = turf.point (pathPoints.features[0].geometry.coordinates[0][(i + 1) % pathPoints.features[0].geometry.coordinates[0].length]);
            const distance = turf.distance (p1, p2);
            console.log ('distance ' + (distance * 1000));
        }

    }

    map.on ('load', function () {

    });


    const ll = new mapboxgl.LngLat (88.314204, 22.542378);
    // ll.toBounds(100).toArray(); // = [[-73.97501862141328, 40.77351016847229], [-73.97478137858673,
    // 40.77368983152771]] for (let i = 0; i < ll.toBounds(100).toArray().length; i++) { var x =
    // ll.toBounds(2.35).toArray()[i] new mapboxgl.Marker({ color: "#FFFFFF", draggable: true
    // }).setLngLat(x).addTo(map); }

    var randomPoints = turf.randomPoint (100, {bbox: [50, 30, 70, 50]});

    // turf.featureEach(randomPoints, function(point) {
    //     point.properties.solRad = Math.random() * 50;
    // });
    // var options = {gridType: 'points', property: 'solRad', units: 'kilometers'};
    // var grid = turf.interpolate(randomPoints, 100, options);
    // console.log(grid);
    // for (let i = 0; i < grid.features.length; i++) {
    //     const element = grid.features[i];
    //     new mapboxgl.Marker({
    //         color: "#FFFFFF",
    //         draggable: true
    //     }).setLngLat(element.geometry.coordinates).addTo(map);
    // }
}
let deegre = 90;

init ()