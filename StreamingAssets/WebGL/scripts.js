var path = [];
var distances = [];
var area = 0;
var message = "";

function clear () {
    path = [];
    distances = [];
    area = 0;
    message = "";
}
function onButtonClick () {
    if (path.length === 4) {
        for (let i = 0; i < path.getLength(); i++) {
            const p1 = path.getAt(i);
            const p2 = path.getAt((i + 1) % path.getLength());
            const distance = google.maps.geometry.spherical.computeDistanceBetween(p1, p2);
            distances.push(distance);
        }
        area = google.maps.geometry.spherical.computeArea(path);
        // write biggest distance
        const max = Math.max(...distances);
        const min = Math.min(...distances);
        const message = area + "-" + max + "-" + min +
            "-" + path.getAt(0).lat() + " " + path.getAt(0).lng() +
            "-" + path.getAt(1).lat() + " " + path.getAt(1).lng() +
            "-" + path.getAt(2).lat() + " " + path.getAt(2).lng() +
            "-" + path.getAt(3).lat() + " " + path.getAt(3).lng();
        
        console.log("Message sent to Unity: " + message);
        
        parent.unityWebView.sendMessage('VirtualYardManager', 'SetData', message);
    }
}

function setDataWithMessage (m_path) {
    path = m_path;
}