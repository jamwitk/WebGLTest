var path = [];
var distances = [];
var area = 0;
var message = "";
function onButtonClick(){
    for (let i = 0; i < path.length; i++) {
        const p1 = path[i];
        const p2 = path[(i + 1) % path.length];
        const distance = turf.distance(p1, p2);
        distances.push(distance);
    }
    area = turf.area(turf.polygon([path]));
    // write biggest distance
    const max = Math.max(...distances);
    const min = Math.min(...distances);
    let message = area + "-" + max + "-" + min +"-";
    
    for (let i = 0; i < path.length; i++) {
        const element = path[i];
        message += element[1] + " " + element[0] + "-";
    }
    console.log("Message sent to Unity: " + message);
    window.Unity.call(message);
}
function setDataWithMessage(m_path){
    path = m_path;
}