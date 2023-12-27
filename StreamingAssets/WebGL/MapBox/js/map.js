let draw;
let m_feature;
let layerCount = 0;
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

    //Harita çizim olayları
    map.on('draw.create', function (feature) {
        m_feature = feature;
        createGrid(map, m_feature);
    });
    map.on ('draw.update', function (feature) {
        m_feature = feature;
        setDataWithMessage(draw.getAll().features[0].geometry.coordinates[0]);
    });
    map.on ('draw.delete', function (feature) {
        m_feature = feature;
        //remove all layers and sources
        for(let i = 0; i < layerCount; i++)
        {
            map.removeLayer('polygon'+i);
            map.removeLayer('line'+i);
            map.removeSource('polygon'+i);
        }
        removeDataWithMessage();
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
            'exaggeration': 0
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

//     map.once('idle', function () {
//         const elevation = Math.floor(
// // Do not use terrain exaggeration to get actual meter values
//             map.queryTerrainElevation([88.314204, 22.542378], { exaggerated: false })
//         );
//         //document.getElementsByClassName("mapboxgl-calc-ctrl")[0].onclick = calculateAlongPath();
//         console.log(elevation+" is the elevation");
//     });
    //createGrid(map);

}
function createGrid (map, feature) {

    //remove last coordinates from the feature in draw
    // console.log("Before: "+feature.features[0].geometry.coordinates[0].length)
    // feature.features[0].geometry.coordinates[0].pop();
    // console.log("After: "+feature.features[0].geometry.coordinates[0].length)
    // draw.deleteAll();
    // draw.add(feature.features[0]);

    const rowDistance = 2.35;
    const columnDistance = 2.59;

    let distances= [];
    let maxDistance = 0;
    let minDistance = 100;
    let maxDistanceIndex = 0;
    let minDistanceIndex = 0;

    for (let i = 0; i < feature.features[0].geometry.coordinates[0].length - 1; i++) {
        let pointOne = turf.point(feature.features[0].geometry.coordinates[0][i]);
        let secondPoint = (i + 1) % feature.features[0].geometry.coordinates[0].length;
        let pointTwo = turf.point(feature.features[0].geometry.coordinates[0][secondPoint]);
        let distance = turf.distance(pointOne, pointTwo);
        if(distance > maxDistance)
        {
            maxDistance = distance;
            if(i === 0 && secondPoint === 1 || i === 2 && secondPoint === 3)
                maxDistanceIndex = 1;
            if(i === 1 && secondPoint === 2 || i === 3 && secondPoint === 4)
                maxDistanceIndex = 3;

        }
        if(distance <= minDistance)
        {
            minDistance = distance;
            if(i === 0 && secondPoint === 1 || i === 2 && secondPoint === 3)
                minDistanceIndex = 1;
            if(i === 1 && secondPoint === 2 || i === 3 && secondPoint === 4)
                minDistanceIndex = 3;
        }

        distances.push(distance*1000);
    }
    //console.log("Max Distance Index: "+maxDistanceIndex+" Min Distance Index: "+minDistanceIndex);
    let max = maxDistance * 1000; //Math.max(...distances); // column
    let min =  minDistance * 1000; //Math.min(...distances); // row
    let maxRow = Math.floor(min / rowDistance);
    let maxColumn = Math.floor(max / columnDistance);
    
    setRowWithMessage(maxRow, maxColumn);
    
    //2D array
    let grid = [];


    let columnBearing = turf.bearing(turf.point(feature.features[0].geometry.coordinates[0][0]), turf.point(feature.features[0].geometry.coordinates[0][maxDistanceIndex]));
    let rowBearing = turf.bearing(turf.point(feature.features[0].geometry.coordinates[0][0]), turf.point(feature.features[0].geometry.coordinates[0][minDistanceIndex]));
    //make sure the difference between column and row bearing is 90 degrees or 270 degrees


    let difference = rowBearing - columnBearing;


    if(rowBearing - columnBearing > 0){
        let left = Math.abs(difference - 90);
        let right = Math.abs(difference - 270);

        if(rowBearing - columnBearing > 270){
            rowBearing += 270 - (rowBearing - columnBearing);
        }
        else if(rowBearing - columnBearing > 90 && left > right){
            rowBearing += 270 - (rowBearing - columnBearing);
        }
        else if(rowBearing - columnBearing > 90 && left < right){
            rowBearing += 90 - (rowBearing - columnBearing);
        }
        else if(rowBearing - columnBearing > 90){
            rowBearing += 90 - (rowBearing - columnBearing);
        }
    }
    else if(rowBearing - columnBearing < 0) {
        let left = Math.abs(90 + difference );
        let right = Math.abs(270 + difference);

        if (rowBearing - columnBearing < 90 && left < right)
        {
            rowBearing -= 90 +(rowBearing - columnBearing);
        }
        else if(rowBearing - columnBearing < 90 && left > right)
        {
            rowBearing -= 270 + (rowBearing - columnBearing);
        }
        else if (rowBearing - columnBearing < 270 && left < right)
        {
            rowBearing -= 90 + (rowBearing - columnBearing);
        }
        else if (rowBearing - columnBearing < 270)
        {
            rowBearing -= 270 + (rowBearing - columnBearing);
        }
    }






    for (let i = 0; i <= maxRow; i++) {
        let rowDestination = turf.destination(turf.point(feature.features[0].geometry.coordinates[0][0]), rowDistance * i, rowBearing, {units: 'meters'});
        grid.push([]);

        for (let j = 0; j <= maxColumn; j++) {

            let destination = turf.destination(rowDestination.geometry.coordinates, columnDistance * j, columnBearing, {units: 'meters'});
            grid[i].push(destination.geometry.coordinates);
        }

    }
    let groups = [];
    for (let i = 0; i < grid.length - 1; i++) {
        for(let j = 0; j < grid[i].length - 1; j++){
            let group = [];
            group.push(grid[i][j]);
            group.push(grid[i][j+1]);
            group.push(grid[i+1][j+1]);
            group.push(grid[i+1][j]);
            group.push(grid[i][j]);
            groups.push(group);
        }
    }
    for(let i = 0; i < groups.length; i++)
    {
        let line = [];
        let group = groups[i];
        for (let j = 0; j < group.length; j++) {
            line.push (group[j]);
        }

        line.push (line[0]);
        var polygon = turf.polygon ([line]);

        map.addSource ('polygon'+i, {
            'type': 'geojson',
            'data':
                {
                    'type': 'Feature',
                    'geometry': {
                        'type': 'Polygon',
                        'coordinates': [polygon.geometry.coordinates[0]]
                    }
                }
        });
        map.addLayer ({
            'id': 'polygon'+i,
            'type': 'fill',
            'source': 'polygon'+i,
            'layout': {
            },
            'paint': {
                'fill-color': '#FF6DDD',
                'fill-opacity': 0.5
            },

        });
        map.addLayer ({
            'id': 'line'+i,
            'type': 'line',
            'source': 'polygon'+i,
            'layout': {
            },
            'paint': {
                'line-color': '#FF6D00',
                'line-width': 3
            }
        });


        layerCount++;
    }

    setDataWithMessage(feature.features[0].geometry.coordinates[0]);
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