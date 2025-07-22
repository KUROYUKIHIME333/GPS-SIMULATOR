let map;
let mobileMarker;
let initialPolylineLayer;
let traveledPolylineLayer;
let simulationInterval = null;
let currentTraveledPath = [];
let transferId = null;
let blinkInterval = null; // Ajout pour le clignotement

function decodePolyline(encodedPolyline) {
  if (typeof polyline === "undefined") {
    console.error(
      "Polyline library not loaded. Make sure you've included https://unpkg.com/@mapbox/polyline@1.1.1/src/polyline.js"
    );
    return [];
  }
  const coords = polyline.decode(encodedPolyline);
  return coords.map((coord) => ({ lat: coord[0], lng: coord[1] }));
}

function initializeMap(initialPosition) {
  if (map) {
    map.remove();
  }
  map = L.map("map").setView(initialPosition, 13);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

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

  // Marqueur du mobile : cercle bleu ciel clignotant en violet
  mobileMarker = L.circleMarker(initialPosition, {
    radius: 10,
    fillColor: "#87CEEB", // Bleu ciel
    color: "#87CEEB", // Bordure bleu ciel
    weight: 2,
    opacity: 1,
    fillOpacity: 0.8,
  }).addTo(map);

  mobileMarker.bindPopup("Début de la simulation").openPopup();

  // Fonction de clignotement
  let isViolet = false;
  blinkInterval = setInterval(() => {
    if (isViolet) {
      mobileMarker.setStyle({
        fillColor: "#006effff",
        color: "#006effff",
      });
    } else {
      mobileMarker.setStyle({
        fillColor: "#e800e8ff", // Violet
        color: "#e800e8ff", // Bordure violette
      });
    }
    isViolet = !isViolet;
  }, 500); // Clignote toutes les 500ms
}

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
        document.querySelector("#cancelSimulation").style.display = "none";
        return;
      }
      throw new Error(`Erreur API: ${response.statusText}`);
    }

    const status = await response.json();
    const currentPosition = status.currentPosition;

    mobileMarker.setLatLng([currentPosition.lat, currentPosition.lng]);
    currentTraveledPath.push(
      L.latLng(currentPosition.lat, currentPosition.lng)
    );
    traveledPolylineLayer.setLatLngs(currentTraveledPath);

    map.setView([currentPosition.lat, currentPosition.lng]);

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

    if (status.estimatedRemainingTime <= 0 && !status.isStopped) {
      stopSimulation();
      document.querySelector("#statusDisplay").textContent = "Terminée";
      mobileMarker.bindPopup("Arrivé à destination !").openPopup();
      document.querySelector("#cancelSimulation").style.display = "none";
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

function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  if (blinkInterval) {
    // Arrête le clignotement
    clearInterval(blinkInterval);
    blinkInterval = null;
    // Remet le marqueur à sa couleur initiale si la simulation est arrêtée
    if (mobileMarker) {
      mobileMarker.setStyle({
        fillColor: "#001ac2ff",
        color: "#0000e1ff",
      });
    }
  }
}

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
      window.location.href = "simulate.html";
    } else {
      const result = await response.json();
      alert(`Échec de l'annulation: ${result.message || "Erreur inconnue."}`);
    }
  } catch (error) {
    console.error("Erreur lors de l'annulation de la simulation:", error);
    alert("Impossible de contacter le serveur pour annuler la simulation.");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
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
  document.querySelector("#cancelSimulation").style.display = "inline-block";
  document
    .querySelector("#cancelSimulation")
    .addEventListener("click", cancelSimulationOnServer);

  try {
    const initialResponse = await fetch(`/transferts/${transferId}`);
    if (!initialResponse.ok) {
      throw new Error(
        "Impossible de récupérer les détails initiaux de la simulation."
      );
    }
    const initialStatus = await initialResponse.json();

    const defaultPolyline = "_p~iF~ps|U_ulLnnqC_mqNvxq`@";
    const polylineFromLocalStorage = localStorage.getItem(
      "lastSimulationPolyline"
    );
    const initialCoords = decodePolyline(
      polylineFromLocalStorage || defaultPolyline
    );

    initializeMap(initialStatus.currentPosition);

    initialPolylineLayer = L.polyline(initialCoords, {
      color: "red",
      weight: 4,
      opacity: 0.7,
    }).addTo(map);
    map.fitBounds(initialPolylineLayer.getBounds());

    currentTraveledPath.push(
      L.latLng(
        initialStatus.currentPosition.lat,
        initialStatus.currentPosition.lng
      )
    );

    simulationInterval = setInterval(updateSimulationStatus, 1000);
    updateSimulationStatus();
  } catch (error) {
    console.error("Erreur lors de l'initialisation du suivi:", error);
    alert(`Erreur d'initialisation: ${error.message}. Redirection.`);
    window.location.href = "simulate.html";
  }
});
