let map;
let mobileMarker;
let initialPolylineLayer;
let traveledPolylineLayer;
let simulationInterval = null;
let currentTraveledPath = [];
let transferId = null;

// Décode un polyline Mapbox/Google en un tableau de points {lat, lng}.
function decodePolyline(encodedPolyline) {
  // Vérifie si Polyline est défini par Leaflet ou une autre bibliothèque
  if (typeof polyline === "undefined") {
    console.error(
      "Polyline library not loaded. Make sure you've included https://unpkg.com/@mapbox/polyline@1.1.1/src/polyline.js"
    );
    return [];
  }
  const coords = polyline.decode(encodedPolyline);
  return coords.map((coord) => ({ lat: coord[0], lng: coord[1] }));
}

// Initialise la carte Leaflet
function initializeMap(initialPosition) {
  if (map) {
    map.remove(); // Supprime l'ancienne carte si elle existe
  }
  map = L.map("map").setView(initialPosition, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // Initialise les couches de polylines
  initialPolylineLayer = L.polyline([], {
    color: "red",
    weight: 4,
    opacity: 0.7,
  }).addTo(map);
  traveledPolylineLayer = L.polyline([], {
    color: "blue",
    weight: 5,
    opacity: 0.9,
  }).addTo(map);

  // Marqueur du mobile
  mobileMarker = L.marker(initialPosition, {
    icon: L.icon({
      iconUrl: "https://cdn-icons-png.flaticon.com/512/1042/1042582.png", // Icône de voiture/camion
      iconSize: [38, 38],
      iconAnchor: [19, 38],
      popupAnchor: [0, -38],
    }),
  }).addTo(map);

  mobileMarker.bindPopup("Début de la simulation").openPopup();
}

// Met à jour l'affichage sur la carte et les infos
async function updateSimulationStatus() {
  if (!transferId) return;

  try {
    const response = await fetch(`/transferts/${transferId}`);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Simulation ${transferId} terminée ou introuvable.`);
        stopSimulation();
        document.querySelector("#statusDisplay").textContent =
          "Terminée ou Introuvable";
        document.querySelector("#cancelSimulation").style.display = "none"; // Cache le bouton annuler
        return;
      }
      throw new Error(`Erreur API: ${response.statusText}`);
    }

    const status = await response.json();
    const currentPosition = status.currentPosition;

    // Mise à jour de la carte
    mobileMarker.setLatLng([currentPosition.lat, currentPosition.lng]);
    currentTraveledPath.push(
      L.latLng(currentPosition.lat, currentPosition.lng)
    );
    traveledPolylineLayer.setLatLngs(currentTraveledPath);

    // Ajuster le centre de la carte pour suivre le mobile
    map.setView([currentPosition.lat, currentPosition.lng]);

    // Mise à jour des informations textuelles
    document.querySelector("#mobileIdDisplay").textContent =
      status.mobileId || "N/A";
    document.querySelector("#simulationIdDisplay").textContent = status.id;
    document.querySelector("#currentSpeedDisplay").textContent =
      status.currentSpeed.toFixed(1);
    document.querySelector("#elapsedTimeDisplay").textContent =
      status.elapsedTime;
    document.querySelector("#remainingTimeDisplay").textContent =
      status.estimatedRemainingTime;
    document.querySelector("#statusDisplay").textContent = status.isStopped
      ? `À l'arrêt`
      : "En mouvement";
    document.querySelector("#stopDurationLeftDisplay").textContent =
      status.stopDurationLeft;
    document.querySelector("#hasReRoutedDisplay").textContent =
      status.hasReRouted ? "Oui" : "Non";

    // Si le mobile est arrivé à destination
    if (status.estimatedRemainingTime <= 0 && !status.isStopped) {
      stopSimulation();
      document.querySelector("#statusDisplay").textContent = "Terminée";
      mobileMarker.bindPopup("Arrivé à destination !").openPopup();
      document.querySelector("#cancelSimulation").style.display = "none"; // Cache le bouton annuler
    }
  } catch (error) {
    console.error(
      "Erreur lors de la récupération du statut de simulation:",
      error
    );
    document.querySelector(
      "#statusDisplay"
    ).textContent = `Erreur: ${error.message}`;
    stopSimulation();
  }
}

// Fonction pour arrêter la simulation côté client
function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
    console.log("Intervalle de mise à jour arrêté.");
  }
}

// Annuler la simulation via l'API
async function cancelSimulationOnServer() {
  if (!confirm("Êtes-vous sûr de vouloir annuler cette simulation ?")) {
    return;
  }

  if (!transferId) {
    alert("Aucune simulation en cours à annuler.");
    return;
  }

  try {
    const response = await fetch(`/transferts/${transferId}`, {
      method: "DELETE",
    });

    if (response.ok) {
      alert("Simulation annulée avec succès !");
      stopSimulation();
      window.location.href = "simulate.html"; // Retour au formulaire
    } else {
      const result = await response.json();
      alert(`Échec de l'annulation: ${result.message || "Erreur inconnue."}`);
    }
  } catch (error) {
    console.error("Erreur lors de l'annulation de la simulation:", error);
    alert("Impossible de contacter le serveur pour annuler la simulation.");
  }
}

// Au chargement de la page
document.addEventListener("DOMContentLoaded", async () => {
  // Récupère l'ID de transfert de l'URL
  const params = new URLSearchParams(window.location.search);
  transferId = params.get("transferId");

  if (!transferId) {
    alert(
      "ID de simulation manquant. Redirection vers la page de configuration."
    );
    window.location.href = "simulate.html";
    return;
  }

  document.querySelector("#simulationIdDisplay").textContent = transferId;
  document.querySelector("#cancelSimulation").style.display = "inline-block"; // Affiche le bouton annuler
  document
    .querySelector("#cancelSimulation")
    .addEventListener("click", cancelSimulationOnServer);

  // Récupère les détails initiaux pour dessiner le polyline complet
  try {
    const initialResponse = await fetch(`/transferts/${transferId}`);
    if (!initialResponse.ok) {
      throw new Error(
        "Impossible de récupérer les détails initiaux de la simulation."
      );
    }
    const initialStatus = await initialResponse.json();

    // --- Solution temporaire (Idéalement, l'API devrait exposer le polyline initial) ---
    // Pour un vrai projet, le POST /transferts devrait retourner le polyline initial
    // ou un GET /transferts/:id/polyline ferait l'affaire.
    const defaultPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@"; // Exemple de polyline si non disponible
    const polylineFromLocalStorage = localStorage.getItem(
      "lastSimulationPolyline"
    );
    const initialCoords = decodePolyline(
      polylineFromLocalStorage || defaultPolyline
    );

    // Initialiser la carte avant de dessiner les polylines
    initializeMap(initialStatus.currentPosition);

    initialPolylineLayer = L.polyline(initialCoords, {
      color: "red",
      weight: 4,
      opacity: 0.7,
    }).addTo(map);
    map.fitBounds(initialPolylineLayer.getBounds()); // Centre la carte sur le polyline initial
    // --- Fin solution temporaire ---

    currentTraveledPath.push(
      L.latLng(
        initialStatus.currentPosition.lat,
        initialStatus.currentPosition.lng
      )
    );

    // Démarrer la mise à jour périodique
    simulationInterval = setInterval(updateSimulationStatus, 1000); // Mise à jour toutes les secondes
    updateSimulationStatus(); // Première mise à jour immédiate
  } catch (error) {
    console.error("Erreur lors de l'initialisation du suivi:", error);
    alert(`Erreur d'initialisation: ${error.message}. Redirection.`);
    window.location.href = "simulate.html";
  }
});
