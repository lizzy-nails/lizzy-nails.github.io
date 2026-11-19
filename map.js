/* Карта «Где я»: Leaflet + подложка OpenStreetMap, перекрашенная под сайт в style.css (.map .leaflet-tile-pane) */
(function () {
  'use strict';
  const el = document.getElementById('map');
  if (!el || !window.L) return; // CDN не загрузился — остаются адрес и ссылка на маршрут
  const HOME = [56.19417, 43.88998]; // Новинки, Инженерный пр-д, 1 к1
  const map = L.map(el, {
    scrollWheelZoom: false,       // не перехватывать прокрутку страницы
    dragging: !L.Browser.mobile,  // на телефоне палец листает страницу, карта — кнопками ±
    tap: false,
    attributionControl: true,
  });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  }).addTo(map);
  // весь Приокский район, метка — дом
  map.fitBounds([[56.19, 43.88], [56.285, 43.99]]);
  L.marker(HOME, {
    icon: L.divIcon({ className: 'pin', html: '<b>я тут ✦</b>', iconSize: [0, 0], iconAnchor: [0, 10] }),
    keyboard: false, title: 'Инженерный проезд, 1 к1',
  }).addTo(map);
})();
