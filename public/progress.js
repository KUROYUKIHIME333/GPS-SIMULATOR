// progress.js - Affichage de l'itinéraire prévu et du suivi mobile sur Leaflet
// Pour démo : à adapter pour recevoir les vrais points en temps réel via WebSocket ou polling

// --- CONFIGURATION DYNAMIQUE ---
function getQueryParam(name) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

const urlPolyline = getQueryParam('polyline');
const startLat = parseFloat(getQueryParam('startLat'));
const startLng = parseFloat(getQueryParam('startLng'));

const encodedPolyline = urlPolyline || "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
let decoded = polyline.decode(encodedPolyline);
let plannedLatLngs = decoded.map(([lat, lng]) => [lat, lng]);

// Si un point de départ est fourni, on l'insère en tête de l'itinéraire, sinon on garde le polyline d'origine
if (!isNaN(startLat) && !isNaN(startLng)) {
  plannedLatLngs = [[startLat, startLng], ...plannedLatLngs.slice(1)];
}

// --- INIT MAP ---
const map = L.map("map", { zoomControl: false }).setView(plannedLatLngs[0], 14);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "© OpenStreetMap",
}).addTo(map);

// --- ITINERAIRE PREVU ---
const plannedLine = L.polyline(plannedLatLngs, {
  color: "#7B00D4",
  weight: 5,
  opacity: 0.7,
}).addTo(map);
map.fitBounds(plannedLine.getBounds());

// --- SUIVI MOBILE ---
let followedPoints = [plannedLatLngs[0]];
let followedLine = L.polyline(followedPoints, {
  color: "#4CAF50",
  weight: 4,
  dashArray: "8 8",
  opacity: 0.9,
}).addTo(map);
let marker = L.circleMarker(followedPoints[0], {
  radius: 10,
  color: "#D32F2F",
  fillColor: "#fff",
  fillOpacity: 1,
  weight: 3,
}).addTo(map);

// --- DEMO : Animation du suivi (à remplacer par du live) ---
let demoIdx = 0;
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
