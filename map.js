/* Карта «Где я»: Leaflet + подложка OpenStreetMap, перекрашенная под сайт в style.css (.map .leaflet-tile-pane) */
(function () {
  'use strict';
  const el = document.getElementById('map');
  if (!el || !window.L) return; // CDN не загрузился — остаются адрес и ссылка на маршрут
  const HOME = [56.19435, 43.89063]; // Новинки, Инженерный пр-д, 1
  const map = L.map(el, {
    scrollWheelZoom: false,       // не перехватывать прокрутку страницы
    attributionControl: true,
  });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  // Приокский район и дом; на узком экране центр ближе к дому, чтобы метка не уехала за край
  map.setView(el.clientWidth < 600 ? [56.212, 43.905] : [56.226, 43.935], 12);
  L.marker(HOME, {
    icon: L.divIcon({ className: 'pin', html: '<b>я тут ✦</b>', iconSize: [0, 0], iconAnchor: [0, 10] }),
    keyboard: false, title: 'Инженерный проезд, 1',
  }).addTo(map);
})();
