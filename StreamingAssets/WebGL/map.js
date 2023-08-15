let map;

async function initMap() {
    const { Map } = await google.maps.importLibrary("maps");
    const { spherical } = await google.maps.importLibrary("geometry");
    const {LatLngAltitude} = await google.maps.importLibrary("core")
    const myLatlng = {
        lat: 22.542378,
        lng: 88.314204
    };

    map = new Map(document.getElementById("map"), {
        center: myLatlng,
        zoom: 17,
        mapTypeId: "terrain",
    });
   
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
        // enable button
        console.log(path.getAt(0).lat()+" "+path.getAt(0).lng()+" "+path.getAt(0));
    }
    if (path.length === 2) {
        var polygonOptions = { path: path, strokeColor: "#00DB00", fillColor: "green" };
        polygon = new google.maps.Polygon(polygonOptions);
        polygon.setMap(map);
    }
    //how to use LatLngAltitudeLiteral to get altitude
    //
    
    path.push(event.latLng);
    var index = -1;
    function dragStartEvent(event) {
        const arr = path.getArray();
        index = arr.indexOf({lat: event.LatLngAltitude.lat,lng: event.LatLngAltitude.lng});
    }
    if(polygon !== undefined){
        area = google.maps.geometry.spherical.computeArea(polygon.getPath());
        console.log(area);
    }
    //find the longest line and find distance
    function createVirtualYard(){
        for (let i = 0; i < path.getLength(); i++) {
            const p1 = path.getAt(i);
            const p2 = path.getAt((i + 1) % path.getLength());
            const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
            distances.push(distance);
            // write biggest distance
        }
        const max = Math.max(...distances);
        const min = Math.min(...distances);
        const message = area+"-"+max+"-"+min+
            "-"+path.getAt(0).lat()+" "+path.getAt(0).lng()+
            "-"+path.getAt(1).lat()+" "+path.getAt(1).lng()+
            "-"+path.getAt(2).lat()+" "+path.getAt(2).lng()+
            "-"+path.getAt(3).lat()+" "+path.getAt(3).lng()
        unityInstance.SendMessage('VirtualYardManager','SetData',message);    
    }
    function dragEndEvent(event) {
        if (index > -1) {
            path.setAt(index, event.latLng);
            area = google.maps.geometry.spherical.computeArea(polygon.getPath());
            console.log(area);
        }
    }
    var marker = new google.maps.Marker({
        position: { lat: event.latLng.lat(), lng: event.latLng.lng()},
        title: '#' + path.getLength(),
        map: map,
        draggable: true,
    });
    marker.addListener('dragstart', dragStartEvent);
    marker.addListener('dragend', dragEndEvent);
}
initMap();