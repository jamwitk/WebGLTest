let map;
async function initMap() {
    const { Map } = await google.maps.importLibrary("maps");
    const myLatlng = {
        lat: 22.542378,
        lng: 88.314204
    };
    map = new Map(document.getElementById("map"), {
        center: myLatlng,
        zoom: 17,
        mapTypeId: "satellite",
    });
    const borderPath = [
        {lat: 22.545118388314883, lng: 88.31677119460629},
        {lat: 22.545267021972453, lng: 88.31612210002469},
        {lat: 22.545205091301252, lng: 88.31585656133221},
        {lat: 22.54497966342341,  lng: 88.31544886556195},
        {lat: 22.544769098589548, lng: 88.3148990127139},
        {lat: 22.544293468606007, lng: 88.31361423459576},
        {lat: 22.539002717150638, lng: 88.31191002617254},
        {lat: 22.538177760893998, lng: 88.31151037702932},
        {lat: 22.538316492621274, lng: 88.31328599939718},
        {lat: 22.539747260021606, lng: 88.31326607157075},
        {lat: 22.544085667031744, lng: 88.31576255809281},
        {lat: 22.545118388314883, lng: 88.31677119460629}
    ];
    
    poly = new google.maps.Polyline({
        strokeColor: '#00DB00',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        fillColor: 'green',
        fillOpacity: 0
    });
    
    border = new google.maps.Polygon({
        paths : borderPath,
        strokeColor: '#FF6D00',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        fillColor: 'green',
        fillOpacity: 0.05
    });
    //border.setMap(map);
    document.getElementsByClassName("clear")[0].addEventListener("click", clearMap);

    poly.setMap(map);
    map.addListener('click', addLatLng);
}


let border;
var poly;
var polygon;
var area = 0;
var _path = [];
function clearMap() {
    poly.setMap(null);
    polygon.setMap(null);
    clear();
    initMap();
}
function addLatLng(event) {
    let path = poly.getPath();
    if (path.length === 4) {
        drawCells();
        return;
    }
    if (path.length === 3) {
        _path = path;
    }
    if (path.length === 2) {
        let polyOptions = {
            strokeColor: '#00DB00',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: 'green',
            fillOpacity: 0.5
        };
        polygon = new google.maps.Polygon(polyOptions);
        polygon.setMap(map);
        polygon.setPath(path);
    }

    path.push(event.latLng);
    setDataWithMessage(path)

    var index = -1;
    function dragStartEvent(event) {
        const arr = path.getArray();
        index = arr.indexOf(event.latLng);
    }
    if (polygon !== undefined) {
        area = google.maps.geometry.spherical.computeArea(polygon.getPath());
    }
    function dragEndEvent(event) {
        if (index > -1) {
            path.setAt(index, event.latLng);
            area = google.maps.geometry.spherical.computeArea(polygon.getPath());
        }
    }
    var marker = new google.maps.Marker({
        position: event.latLng,
        title: '#' + path.getLength(),
        map: map,
        draggable: true,
    });
    marker.addListener('dragstart', dragStartEvent);
    marker.addListener('dragend', dragEndEvent);
}

function drawCells(){
    
    const rowDistance = 2.35;
    const columnDistance = 2.59;

    let distances= [];
    let maxDistance = 0;
    let minDistance = 100;
    let maxDistanceIndex = 0;
    let minDistanceIndex = 0;
    path.push(path.getAt(0));
    
    for (let i = 0; i < path.getLength() - 1; i++) {
        const p1 = path.getAt(i);
        const index = (i + 1) % path.getLength();
        const p2 = path.getAt(index);
        const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
        console.log("Distance: " + distance);
        if(distance > maxDistance){
            maxDistance = distance;
            if(i === 0 && index === 1 || i === 2 && index === 3){
                maxDistanceIndex = 1;
            }
            if(i === 1 && index === 2 || i === 3 && index === 4){
                maxDistanceIndex = 3;
            }
        }
        else if(distance < minDistance){
            minDistance = distance;
            if(i === 0 && index === 1 || i === 2 && index === 3){
                minDistanceIndex = 1;
            }
            if(i === 1 && index === 2 || i === 3 && index === 4){
                minDistanceIndex = 3;
            }
        }

        distances.push(distance);
    }
    const max = maxDistance;
    const min = minDistance;
    let maxRow = Math.floor(min / rowDistance) - 1;
    let maxColumn = Math.floor(max / columnDistance) - 1;

    let grid = [];

    let columnBearing = google.maps.geometry.spherical.computeHeading(path.getAt(0), path.getAt(maxDistanceIndex));
    let rowBearing = google.maps.geometry.spherical.computeHeading(path.getAt(0), path.getAt(minDistanceIndex));

    let diff = rowBearing - columnBearing;

    if(rowBearing - columnBearing > 0) {
        let left = Math.abs (diff - 90);
        let right = Math.abs (diff - 270);

        if (rowBearing - columnBearing > 270) {
            rowBearing += 270 - diff;
        } else if (rowBearing - columnBearing > 90 && left > right) {
            rowBearing += 270 - diff;
        } else if (rowBearing - columnBearing > 90 && left < right) {
            rowBearing += 90 - diff;
        } else if (rowBearing - columnBearing > 90) {
            rowBearing += 90 - diff;
        }
    }
    else if(rowBearing - columnBearing < 0) {
        let left = Math.abs (90 + diff);
        let right = Math.abs (270 + diff);
        if (rowBearing - columnBearing < 90 && left < right) {
            rowBearing -= 90 + (rowBearing - columnBearing);
        } else if (rowBearing - columnBearing < 90 && left > right) {
            rowBearing -= 270 + (rowBearing - columnBearing);
        } else if (rowBearing - columnBearing < 270 && left < right) {
            rowBearing -= 90 + (rowBearing - columnBearing);
        } else if (rowBearing - columnBearing < 270) {
            rowBearing -= 270 + (rowBearing - columnBearing);
        }
    }

    for(let i = 0; i <= maxRow; i++) {
        let rowDestination = google.maps.geometry.spherical.computeOffset (path.getAt (0), rowDistance * i, rowBearing);
        grid.push ([]);

        for (let j = 0; j <= maxColumn; j++) {
            let columnDestination = google.maps.geometry.spherical.computeOffset (rowDestination, columnDistance * j, columnBearing);
            grid[ i ].push (columnDestination);
        }
    }
    let groups = [];
    for (let i = 0; i < grid.length - 1; i++) {
        for (let j = 0; j < grid[ i ].length - 1; j++) {
            let group = [];
            group.push (grid[ i ][ j ]);
            group.push (grid[ i ][ j + 1 ]);
            group.push (grid[ i + 1 ][ j + 1 ]);
            group.push (grid[ i + 1 ][ j ]);
            group.push (grid[ i ][ j ]);
            groups.push (group);
        }
    }
    for(let i = 0; i < groups.length; i++) {
        let line = [];
        let group = groups[ i ];
        for (let j = 0; j < group.length; j++) {
            line.push (group[ j ]);
        }
        let polyOptions = {
            path: line,
            strokeColor: '#00DB00',
            strokeOpacity: 1.0,
            strokeWeight: 3,
            fillColor: 'green',
            fillOpacity: 0.5
        };
        let pygon = new google.maps.Polygon (polyOptions);
        pygon.setMap(map);
    }

}
initMap();

