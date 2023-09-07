let draw;

function init () {
    mapboxgl.accessToken = 'pk.eyJ1IjoiY21lb2RldiIsImEiOiJjbGxwNDN2bHMwMmU0M3FwZXJkNWNrYTFwIn0.ZcjQqSU2qF7xR38xEvnoUA';
    //Harita oluşturma
    const map = new mapboxgl.Map ({
        container: 'map', // container ID
        //style: 'mapbox://styles/mapbox/streets-v12', // style URL
        style: 'mapbox://styles/mapbox/satellite-v9', // style URL
        center: [88.314204, 22.542378], // starting position [lng, lat]
        zoom: 17, // starting zoom
    });
    draw = new MapboxDraw ({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true,
        },
    });
    
    //Harita kontrolleri
    map.addControl (draw);
    map.addControl( new mapboxgl.NavigationControl() );
    map.addControl( new mapboxgl.FullscreenControl() );
    map.addControl( new mapboxgl.ScaleControl() );
    map.addControl( new UnityControl());
    map.addControl( new CalculateControl());
    
    //Harita çizim olayları
    map.on('draw.create', function (feature) {
        //check if the [0,0] coordinate is inside the polygon
        
        //find the coordinates of the 5 meter from the point
        const rowDistance = 2.35;
        const columnDistance = 2.59;
        
        let distances= [];
        for (let i = 0; i < feature.features[0].geometry.coordinates[0].length-1; i++) {
            let pointOne = turf.point(feature.features[0].geometry.coordinates[0][i]);
            let pointTwo = turf.point(feature.features[0].geometry.coordinates[0][(i + 1) % feature.features[0].geometry.coordinates[0].length]);
            let distance = turf.distance(pointOne, pointTwo);
            distances.push(distance*1000);
        }
        let max = Math.max(...distances); // column
        let min = Math.min(...distances); // row
        console.log("Max: "+max+" Min: "+min);
        console.log("Feature: "+feature.features[0].geometry.coordinates);
        let maxRow = Math.floor(min / rowDistance);
        let maxColumn = Math.floor(max / columnDistance);
        
        
        //2D array
        let grid = [];
        
        
        for (let i = 0; i <= maxRow; i++) {
            let rowBearing = turf.bearing(turf.point(feature.features[0].geometry.coordinates[0][0]), turf.point(feature.features[0].geometry.coordinates[0][3]));
            let rowDestination = turf.destination(turf.point(feature.features[0].geometry.coordinates[0][0]), rowDistance * i, rowBearing, {units: 'meters'});
            var rowMarker = new mapboxgl.Marker({
                color: "#FF6D00",
                draggable: false
            });
            rowMarker.setLngLat(rowDestination.geometry.coordinates);
            rowMarker.addTo(map);
            
            //push the row the grid [i][j]
            grid.push([]);
            
            for (let j = 0; j <= maxColumn; j++) {
                //create a destination point from the row and column by distance 2,35 and 2,59
                let bearing = turf.bearing(turf.point(feature.features[0].geometry.coordinates[0][0]), turf.point(feature.features[0].geometry.coordinates[0][1]));
                let destination = turf.destination(rowDestination.geometry.coordinates, columnDistance * j, bearing, {units: 'meters'});
                //create a marker
                var marker = new mapboxgl.Marker({
                    color: "#FF6D00",
                    draggable: false
                });
                marker.setLngLat(destination.geometry.coordinates);
                marker.addTo(map);
                //push the column to the grid [i][j]
                grid[i].push(destination.geometry.coordinates);
            }
            
        }
        for (let i = 0; i < grid.length; i++) {
            for(let j = 0; j < grid[i].length; j++){
                console.log(i+"."+j+"."+grid[i][j]);
            }
        }
        
            
        setDataWithMessage(draw.getAll().features[0].geometry.coordinates[0]);
    });
    map.on ('draw.update', function (feature) {
        setDataWithMessage(draw.getAll().features[0].geometry.coordinates[0]);
    });
    map.on ('draw.delete', function (feature) {
        setDataWithMessage(draw.getAll().features[0].geometry.coordinates[0]);
    });
    
    
    // Liman sınırlarının çizilmesi
    map.on ('load', function () {
        createDefaultStroke(map);
        //add terrain 
        map.addSource ('mapbox-dem', {
            'type': 'raster-dem',
            'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
            'tileSize': 512,
            'maxzoom': 14
        });
        //add the DEM source as a terrain layer with exaggerated height
        map.setTerrain ({
            'source': 'mapbox-dem',
            'exaggeration': 1
        });
        //add a sky layer that will show when the map is highly pitched
        map.addLayer ({
            'id': 'sky',
            'type': 'sky',
            'paint': {
                'sky-type': 'atmosphere',
                'sky-atmosphere-sun': [0.0, 0.0],
                'sky-atmosphere-sun-intensity': 15
            }
        });
    });
    map.once('idle', function () {
        const elevation = Math.floor(
// Do not use terrain exaggeration to get actual meter values
            map.queryTerrainElevation([88.314204, 22.542378], { exaggerated: false })
        );
        //document.getElementsByClassName("mapboxgl-calc-ctrl")[0].onclick = calculateAlongPath();
        console.log(elevation+" is the elevation");
    });
    //createGrid(map);
    
}
function createGrid (map) {
    var points = turf.randomPoint(30, {bbox: [22.542378, 40,  88.314204,22.542378]});

// add a random property to each point
    turf.featureEach(points, function(point) {
        point.properties.elevation = Math.random() * 10;
    });
    var options = {gridType: 'points', property: 'elevation', units: 'kilometres'};
    var grid = turf.interpolate(points, 500, options);
    let k = 0;
    for(let i = 0; i < grid.features.length; i++){
        //creat a marker
        var marker = new mapboxgl.Marker({
            color: "#FF6D00",
            draggable: false
        });
        console.log("Created "+grid.features[i].geometry.coordinates)
        //set the marker to the center of the grid
        marker.setLngLat(grid.features[i].geometry.coordinates);
        //add the marker to the map
        marker.addTo(map);
        k++;
        }
    console.log("Created "+k+" markers")
    
}

function createDefaultStroke (map) {
    map.addSource ('maine', {
        'type': 'geojson',
        'data': {
            'type': 'Feature',
            'geometry': {
                'type': 'Polygon',
                'coordinates': [
                    [
                        [88.31677119460629, 22.545118388314883],
                        [88.31612210002469, 22.545267021972453],
                        [88.31585656133221, 22.545205091301252],
                        [88.31544886556195, 22.54497966342341],
                        [88.3148990127139, 22.544769098589548],
                        [88.31361423459576, 22.544293468606007],
                        [88.31191002617254, 22.539002717150638],
                        [88.31151037702932, 22.538177760893998],
                        [88.31328599939718, 22.538316492621274],
                        [88.31326607157075, 22.539747260021606],
                        [88.31576255809281, 22.544085667031744],
                        [88.31677119460629, 22.545118388314883]]
                ]
            }
        }
    });
    map.addLayer ({
        'id': 'outline',
        'type': 'line',
        'source': 'maine',
        'layout': {},
        'paint': {
            'line-color': '#FF6D00',
            'line-width': 3
        }
    });
}


init ()