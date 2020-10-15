$(document).ready(function(){
    $('.organization-item').each(function(){
        if ($(':nth-child(6)', this).text().startsWith('Address')){
            console.log('Address found!');
        }
        let mapDiv = document.createElement('div');
        $(mapDiv).css({
            'height': '20vw',
            'width': '30vw',
            'border': '1px solid black'
        });
        $(this).append(mapDiv);
        let mymap = L.map(mapDiv).setView([47.620422, -122.349358], 13);
        L.tileLayer('https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}', 
            {
                attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
                maxZoom: 18,
                id: 'mapbox/streets-v11',
                tileSize: 512,
                zoomOffset: -1,
                accessToken: 'pk.eyJ1IjoidmVyZGhhcm8iLCJhIjoiY2tnNXRzaHE3MHh2ODJxcnVobWNoZjBnaiJ9.lIuTPk6WEWRNbpxLxxXZIA'
            }).addTo(mymap);
        let marker = L.marker([47.620422, -122.349358]).addTo(mymap);
    });
});
