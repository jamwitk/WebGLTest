let map;

async function initMap() {
    const { Map } = await google.maps.importLibrary("maps");
    const { spherical } = await google.maps.importLibrary("geometry");
    const myLatlng = {
        lat: 22.542378,
        lng: 88.314204
    };

    map = new Map(document.getElementById("map"), {
        center: myLatlng,
        zoom: 17,
    });
    // const markList = [];
    // const bermudaTriangle = new google.maps.Polygon({
    //     paths: markList,
    //     strokeColor: "#FF0000",
    //     strokeOpacity: .8,
    //     strokeWeight: 4,
    //     fillColor: "#303030",
    //     fillOpacity: 3,
    //     editable: true,
    // });
    // map.addListener("click", (MouseEvent) => {
    //     // get lat/lon of click
    //
    //     const clickLat = MouseEvent.latLng.lat();
    //     const clickLon = MouseEvent.latLng.lng();
    //     console.log(clickLat + " " + clickLon);
    //     // const mark = new google.maps.Marker({
    //     //     position: new google.maps.LatLng(clickLat, clickLon),
    //     //     map,
    //     //     title: "Click to zoom",
    //     // });
    //     var sCount = markList.push({
    //         lat: clickLat,
    //         lng: clickLon
    //     });
    //    
    //     // Add a listener for the set_at  event.
    //     google.maps.event.addListener(bermudaTriangle.getPath(), 'set_at', function() {
    //         console.log("set_at");
    //         const areas = spherical.computeArea(bermudaTriangle.getPath());
    //         console.log(areas)
    //     });
    //     bermudaTriangle.setMap(map);
    //     if (sCount >= 4) {
    //         console.log("4 oldu hesapla");
    //         const areas = spherical.computeArea(bermudaTriangle.getPath());
    //         console.log(areas)
    //     }
    //
    // });
    poly = new google.maps.Polyline({
        strokeColor: '#00DB00',
        strokeOpacity: 1.0,
        strokeWeight: 3,
        fillColor: 'green',
        fillOpacity: 0.05
    });
    poly.setMap(map);

    map.addListener('click', addLatLng);
}
var poly;
var polygon;
var area = 0;
var distances = [];
function addLatLng(event) {
    var path = poly.getPath();
    if(path.length === 4){
        return;
    }
    if (path.length === 3) {
        for (let i = 0; i < path.getLength(); i++) {
            const p1 = path.getAt(i);
            const p2 = path.getAt((i + 1) % path.getLength());
            const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
            distances.push(distance);
            // write biggest distance
           
        }
        const max = Math.max(...distances);
        const min = Math.min(...distances);
        console.log(max);
        console.log(min);
    }
    if (path.length === 2) {
        var polygonOptions = { path: path, strokeColor: "#00DB00", fillColor: "green" };
        polygon = new google.maps.Polygon(polygonOptions);
        polygon.setMap(map);
        
    }

    path.push(event.latLng);
    var index = -1;

    function dragStartEvent(event) {
        const arr = path.getArray();
        index = arr.indexOf(event.latLng);

    }
    if(polygon !== undefined){
        area = google.maps.geometry.spherical.computeArea(polygon.getPath());
        console.log(area);
    }
    //find the longest line and find distance
    
    function dragEndEvent(event) {
        if (index > -1) {
            path.setAt(index, event.latLng);
            area = google.maps.geometry.spherical.computeArea(polygon.getPath());
            console.log(area);
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
initMap();