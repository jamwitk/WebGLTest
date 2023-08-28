let map;

async function initMap () {
    const {Map} = await google.maps.importLibrary ("maps");
    const {spherical} = await google.maps.importLibrary ("geometry");
    
    const myLatlng = {
        lat: 22.542378,
        lng: 88.314204
    };
    
    map = new Map (document.getElementById ("map"), {
        center: myLatlng,
        zoom: 17,
        mapTypeId: "satellite",
    });

    definePortPolygon ();

    poly = new google.maps.Polyline ({
        //gray color 
        strokeColor: '#000000',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        fillColor: 'gray',
        fillOpacity: 0.05
    });
    
    document.getElementsByClassName ("clear")[0].addEventListener ("click", clearMap);
    
    poly.setMap (map);
    map.addListener ('click', addLatLng);
}

var portPolygon;

function definePortPolygon () {
    var inside = [
        new google.maps.LatLng(22.545118388314883, 88.31677119460629),
        new google.maps.LatLng(22.545267021972453, 88.31612210002469),
        new google.maps.LatLng(22.545205091301252, 88.31585656133221),
        new google.maps.LatLng(22.54497966342341, 88.31544886556195),
        new google.maps.LatLng(22.544769098589548, 88.3148990127139),
        new google.maps.LatLng(22.544293468606007, 88.31361423459576),
        new google.maps.LatLng(22.539002717150638, 88.31191002617254),
        new google.maps.LatLng(22.538177760893998, 88.31151037702932),
        new google.maps.LatLng(22.538316492621274, 88.31328599939718),
        new google.maps.LatLng(22.539747260021606, 88.31326607157075),
        new google.maps.LatLng(22.544085667031744, 88.31576255809281)
    ]
    var polyOptins = {
        //neon orange color
        paths: [inside],
        strokeColor: '#FF6D00',
        strokeOpacity: 1,
        strokeWeight: 3,
    };
    //create a hole in the polygon
    
    portPolygon = new google.maps.Polygon (polyOptins);
    portPolygon.setMap (map);
    
    //portPolygon.setPath (everythingElse,paths);
}

var poly;
var polygon;
var area = 0;
var _path = [];

function clearMap () {
    poly.setMap (null);
    polygon.setMap (null);
    clear ();
    initMap ();
}

function addLatLng (event) {
    let path = poly.getPath ();
    // if(path.length === 4){
    //     return;
    // }
    if (path.length === 3) {
        _path = path;
    }
    if (path.length === 2) {
        var polyOptions = {
            strokeColor: '#00DB00',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: 'green',
            fillOpacity: 0.5
        };
        polygon = new google.maps.Polygon (polyOptions);
        polygon.setMap (map);
        polygon.setPath (path);

    }

    path.push (event.latLng);
    console.log (event.latLng.lat () + " " + event.latLng.lng ());
    setDataWithMessage (path)

    var index = -1;

    function dragStartEvent (event) {
        const arr = path.getArray ();
        index = arr.indexOf (event.latLng);
    }

    if (polygon !== undefined) {
        area = google.maps.geometry.spherical.computeArea (polygon.getPath ());
    }

    function dragEndEvent (event) {
        if (index > -1) {
            path.setAt (index, event.latLng);
            area = google.maps.geometry.spherical.computeArea (polygon.getPath ());
        }
    }

    var marker = new google.maps.Marker ({
        position: event.latLng,
        title: '#' + path.getLength (),
        map: map,
        draggable: true,
    });
    marker.addListener ('dragstart', dragStartEvent);
    marker.addListener ('dragend', dragEndEvent);
}

initMap ();

    
