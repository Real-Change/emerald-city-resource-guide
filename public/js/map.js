//~ import L from 'leaflet';
//~ import { GeoSearchControl, OpenStreetMapProvider } from 'leaflet-geosearch';

$(document).ready(function(){
    
    const L = require('leaflet');
    const provider = new OpenStreetMapProvider();
    
    function initMap(container){
        let myMap = L.map(container).setView([47.620422, -122.349358], 13);
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', 
            {
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                maxZoom: 18,
                id: 'mapbox/streets-v11',
                tileSize: 512,
                zoomOffset: -1,
                accessToken: 'pk.eyJ1IjoidmVyZGhhcm8iLCJhIjoiY2tnNXRzaHE3MHh2ODJxcnVobWNoZjBnaiJ9.lIuTPk6WEWRNbpxLxxXZIA'
            }).addTo(myMap);
        let marker = L.marker([47.620422, -122.349358]).addTo(myMap);
    }
    
    $('.organization-item').each(function(){
        
        //capture local mapLink (JQ object) and mapDiv (non-JQ object)
        // (Leaflet needs a non-JQ object)
        const mapDiv = this.getElementsByClassName('mapDiv')[0],
                $mapLink = $('.mapLink', this);
        
        //prevents errors from re-initializing the same map
        let mapExist = false,
            address;
        
        $(mapDiv).css({
            'height': '20vw',
            'width': '30vw',
            'border': '1px solid black',
            'display': 'none'
        });
        
        if ($(':nth-child(6)', this).text().startsWith('Address')){
            console.log('Address found!');
            address = $(':nth-child(6)', this).next().text();
            console.log('Address is ' + address);
        }
        
        $mapLink.click(function(){
            $(mapDiv).toggle('slow');
            
            //map div must be fully visible to draw into it
            $(mapDiv).promise().done(function(){
                if (!mapExist){
                    initMap(mapDiv);
                    mapExist = true;
                }
            });
        });

    });
});
