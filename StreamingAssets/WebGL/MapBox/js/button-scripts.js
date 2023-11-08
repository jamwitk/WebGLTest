﻿var path = [];
var distances = [];
var area = 0;
var message = "";
function onButtonClick(){
    if(path.length <= 0 || path.length !== 5)
        return;
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
    message = area + "-" + max + "-" + min +"-";
    
    for (let i = 0; i < path.length; i++) {
        const element = path[i];
        message += element[1] + " " + element[0] + "-"; 
    }
    console.log("Message sent to Unity: " + message);
    Unity.call(message);
}
function setDataWithMessage(m_path){
    path = m_path;
}
// class CalculateControl
// {
//     onAdd(map){
//         this._map = map;
//         this._container = document.createElement('div');
//         this._container.className = 'mapboxgl-ctrl-group mapboxgl-ctrl';
//         let customButton = document.createElement('button');
//         customButton.className = 'mapboxgl-calc-ctrl';
//         //add description to button
//         customButton.title = 'Calculate';
//         this._container.appendChild(customButton);
//         return this._container;
//     }   
//     onRemove(){
//         this._container.parentNode.removeChild(this._container);
//         this._map = undefined;
//     }
// }
class UnityControl{
    onAdd(map){
        this._map = map;
        this._container = document.createElement('div');
        this._container.className = 'mapboxgl-ctrl-group mapboxgl-ctrl';
        let customButton = document.createElement('button');
        customButton.onclick = onButtonClick;
        createIconFromBase64(customButton);
        customButton.title = 'Send to Unity';
        this._container.appendChild(customButton);
        
        return this._container;
    }
    onRemove(){
        this._container.parentNode.removeChild(this._container);
        this._map = undefined;
    }
}
function createIconFromBase64(container){
    let base64String = "data:image/png;base64,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";
    var image = new Image();
    image.src = base64String;
    image.height = 25;
    image.width = 25;
    container.appendChild(image);
}