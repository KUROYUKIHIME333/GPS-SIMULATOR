// progress.js - Affichage de l'itinéraire prévu et du suivi mobile sur Leaflet
// Pour démo : à adapter pour recevoir les vrais points en temps réel via WebSocket ou polling

// --- CONFIGURATION DEMO ---
// Polyline encodée d'un itinéraire exemple (Paris)
const encodedPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"; // à remplacer dynamiquement
// Points suivis (exemple, à remplacer par du live)
let followedPoints = [
  [48.8566, 2.3522],
  [48.857, 2.353],
  [48.858, 2.354],
];

// --- INIT MAP ---
const map = L.map("map", { zoomControl: false }).setView([48.8566, 2.3522], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

// --- ITINERAIRE PREVU ---
const decoded = polyline.decode(encodedPolyline);
const plannedLatLngs = decoded.map(([lat, lng]) => [lat, lng]);
const plannedLine = L.polyline(plannedLatLngs, {
  color: "#7B00D4",
  weight: 5,
  opacity: 0.7,
}).addTo(map);
map.fitBounds(plannedLine.getBounds());

// --- SUIVI MOBILE ---
let followedLine = L.polyline(followedPoints, {
  color: "#4CAF50",
  weight: 4,
  dashArray: "8 8",
  opacity: 0.9,
}).addTo(map);
let marker = L.circleMarker(followedPoints[followedPoints.length - 1], {
  radius: 10,
  color: "#D32F2F",
  fillColor: "#fff",
  fillOpacity: 1,
  weight: 3,
}).addTo(map);

// --- DEMO : Animation du suivi (à remplacer par du live) ---
let demoIdx = followedPoints.length - 1;
setInterval(() => {
  if (demoIdx < plannedLatLngs.length - 1) {
    demoIdx++;
    followedPoints.push(plannedLatLngs[demoIdx]);
    followedLine.setLatLngs(followedPoints);
    marker.setLatLng(plannedLatLngs[demoIdx]);
  }
}, 2000);

// --- Mode sombre/clair ---
const modeBtn = document.getElementById("toggleModeBtn");
let dark = false;
modeBtn.addEventListener("click", () => {
  dark = !dark;
  document.body.classList.toggle("dark-mode", dark);
  modeBtn.innerHTML = dark
    ? '<i class="fas fa-sun"></i> Mode clair'
    : '<i class="fas fa-moon"></i> Mode sombre';
  map._container.style.filter = dark ? "invert(0.92) hue-rotate(180deg)" : "";
});
