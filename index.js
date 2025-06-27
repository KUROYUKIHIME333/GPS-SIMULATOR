// Import necessary modules
const express = require("express");
const bodyParser = require("body-parser");
const polyline = require("@mapbox/polyline"); // For decoding Google Maps polylines
const axios = require("axios"); // For making HTTP POST requests
const haversine = require("haversine-distance"); // For calculating distance between two points

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// Servir les fichiers statiques pour l'UI
app.use(express.static('public'));

// Haversine distance calculation (using a library for simplicity and accuracy)
// The haversine-distance library expects points as { latitude: lat, longitude: lon }

// Function to interpolate points along a segment
function interpolatePoint(point1, point2, fraction) {
  const lat = point1.latitude + fraction * (point2.latitude - point1.latitude);
  const lon =
    point1.longitude + fraction * (point2.longitude - point1.longitude);
  return { latitude: lat, longitude: lon };
}

// Fonction utilitaire pour générer un délai aléatoire (ralentissement)
function randomDelay(min, max) {
  return Math.random() * (max - min) + min;
}

// Fonction principale de simulation de mouvement du véhicule
async function simulateVehicleMovement(
  encodedPolyline,
  callbackUrl,
  simulationSpeedKmh = 40.0,
  stopProbability = 0.1,
  stopDurationSeconds = 30
) {
  try {
    // Décodage du polyline en liste de points {latitude, longitude}
    const pathPoints = polyline
      .decode(encodedPolyline)
      .map((p) => ({ latitude: p[0], longitude: p[1] }));

    if (!pathPoints || pathPoints.length < 2) {
      console.error("Erreur: Polyline invalide ou trop courte.");
      return;
    }

    const intervalSeconds = 5; // Envoi toutes les 5 secondes
    let sequenceId = 0;
    const speedMps = (simulationSpeedKmh * 1000) / 3600;
    let currentPointIndex = 0;
    let currentSegmentFraction = 0.0;
    let stopped = false;
    let stopIntervalsLeft = 0;

    console.log(`Simulation démarrée pour ${pathPoints.length} points.`);

    const simulationInterval = setInterval(async () => {
      if (currentPointIndex >= pathPoints.length - 1) {
        console.log("Simulation terminée.");
        clearInterval(simulationInterval);
        return;
      }

      const point1 = pathPoints[currentPointIndex];
      const point2 = pathPoints[currentPointIndex + 1];
      const segmentDistanceM = haversine(point1, point2);
      const segmentTimeSeconds = segmentDistanceM / speedMps;
      const distancePerIntervalM = speedMps * intervalSeconds;
      const fractionPerInterval = segmentDistanceM > 0 ? distancePerIntervalM / segmentDistanceM : 1.0;

      // Gestion des arrêts
      if (!stopped && currentSegmentFraction === 0.0 && stopProbability > 0 && Math.random() < stopProbability) {
        stopped = true;
        stopIntervalsLeft = Math.ceil(stopDurationSeconds / intervalSeconds);
        console.log(`Arrêt simulé de ${stopIntervalsLeft * intervalSeconds}s au point (${point1.latitude.toFixed(4)}, ${point1.longitude.toFixed(4)})`);
      }

      let currentLocation;
      if (stopped && stopIntervalsLeft > 0) {
        // Pendant l'arrêt, on répète la même position
        currentLocation = point1;
        stopIntervalsLeft--;
        if (stopIntervalsLeft === 0) {
          stopped = false;
          console.log("Reprise du mouvement.");
        }
      } else {
        // Simulation de ralentissement aléatoire
        let slowFactor = 1.0;
        if (Math.random() < 0.2) { // 20% de chance de ralentir
          slowFactor = randomDelay(0.3, 0.8); // Ralentissement entre 30% et 80% de la vitesse
        }
        currentSegmentFraction += fractionPerInterval * slowFactor;
        if (currentSegmentFraction >= 1.0) {
          currentPointIndex++;
          currentSegmentFraction = 0.0;
          currentLocation = point2;
        } else {
          currentLocation = interpolatePoint(point1, point2, currentSegmentFraction);
        }
      }

      sequenceId++;
      const currentTime = new Date().toISOString();
      const gpsData = {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        timestamp: currentTime,
        sequence_id: sequenceId,
      };
      try {
        await axios.post(callbackUrl, gpsData);
        console.log(
          `Envoyé: ${gpsData.latitude.toFixed(4)}, ${gpsData.longitude.toFixed(4)} (Seq: ${sequenceId})`
        );
      } catch (e) {
        console.error(`Erreur d'envoi des données GPS à ${callbackUrl}: ${e.message}`);
      }
    }, intervalSeconds * 1000);
  } catch (e) {
    console.error(`Erreur inattendue pendant la simulation: ${e.message}`);
  }
}

// API endpoint to start the GPS simulation
app.post("/simulate_route", (req, res) => {
  const {
    encoded_polyline,
    callback_url,
    simulation_speed_kmh = 40.0,
    stop_probability = 0.1,
    stop_duration_seconds = 30,
  } = req.body;

  if (!encoded_polyline) {
    return res.status(400).json({ error: "encoded_polyline est requis." });
  }
  if (!callback_url) {
    return res.status(400).json({ error: "callback_url est requis." });
  }

  // Lancer la simulation en arrière-plan
  simulateVehicleMovement(
    encoded_polyline,
    callback_url,
    simulation_speed_kmh,
    stop_probability,
    stop_duration_seconds
  );

  res.status(200).json({ message: "Simulation démarrée en arrière-plan." });
});

// Basic route for checking if the API is running
app.get("/", (req, res) => {
  res.send(
    "API de simulation GPS Express. Envoyez une requête POST à /simulate_route pour commencer."
  );
});

// Start the server
app.listen(PORT, () => {
  console.log(`Serveur Express en écoute sur le port ${PORT}`);
  console.log(`Accédez à http://localhost:${PORT}`);
});
