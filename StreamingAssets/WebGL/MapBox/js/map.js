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
    //draw a polygon
    draw = new MapboxDraw ({
        displayControlsDefault: false,
        controls: {
            polygon: true,
            trash: true,
        },
    });
    map.addControl (draw);
    map.addControl( new mapboxgl.NavigationControl() );
    map.addControl( new mapboxgl.FullscreenControl() );
    map.addControl( new mapboxgl.ScaleControl() );
    map.on('draw.create', function (feature) {
        setDataWithMessage(draw.getAll().features[0].geometry.coordinates[0]);
    });
    map.on ('draw.update', function (feature) {
        setDataWithMessage(draw.getAll().features[0].geometry.coordinates[0]);
        console.log (feature);
    });
    map.on ('draw.delete', function (feature) {
        setDataWithMessage(draw.getAll().features[0].geometry.coordinates[0]);
        console.log (feature);
    });


    function updateArea () {
        console.log (draw.getAll ());
        pathPoints = draw.getAll ()
        const area = turf.area (draw.getAll ());
        console.log ('area ' + area);
        for (let i = 0; i < pathPoints.features[ 0 ].geometry.coordinates[0].length; i++) {
            const element = pathPoints.features[ 0 ].geometry.coordinates[ 0 ][ i ];
            const p1 = turf.point (element);
            const p2 = turf.point (pathPoints.features[ 0 ].geometry.coordinates[ 0 ][ (i + 1) % pathPoints.features[ 0 ].geometry.coordinates[ 0 ].length ]);
            const distance = turf.distance (p1, p2);
            console.log ('distance ' + (distance * 1000));
        }

    }

    map.on ('load', function () {
        createDefaultStroke();
    });

    function createDefaultStroke () {
        map.addSource ('maine', {
            'type': 'geojson',
            'data': {
                'type': 'Feature',
                'geometry': {
                    'type': 'Polygon',
                    'coordinates': [
                        [[88.31677119460629, 22.545118388314883],
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
}



init ()