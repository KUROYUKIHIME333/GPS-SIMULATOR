const express = require("express");
const bodyParser = require("body-parser");
const polyline = require("@mapbox/polyline"); // For decoding Google Maps polylines
const axios = require("axios"); // For making HTTP POST requests
const haversine = require("haversine-distance"); // For calculating distance between two points
const path = require("path"); // For handling file paths

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// Servir la landing page de documentation sur '/'
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/public/home.html');
});

// Servir les fichiers statiques pour l'UI
app.use(express.static("public"));

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

// Fonction utilitaire pour calculer la distance de freinage (formule physique simplifiée)
function brakingDistance(speedKmh, reactionTime = 1.0, deceleration = 6.0) {
  // speedKmh: vitesse en km/h
  // reactionTime: temps de réaction en secondes (1s par défaut)
  // deceleration: décélération en m/s² (6 m/s² = freinage sec)
  const speedMs = speedKmh / 3.6;
  const reactionDist = speedMs * reactionTime;
  const brakingDist = (speedMs * speedMs) / (2 * deceleration);
  return reactionDist + brakingDist; // en mètres
}

// Fonction principale de simulation de mouvement du véhicule
async function simulateVehicleMovement(
  encodedPolyline,
  callbackUrl,
  simulationSpeedKmh = 40.0,
  stopProbability = 0.1,
  stopDurationSeconds = 30,
  startLat = null,
  startLng = null,
  reference = null,
  intervalSeconds = 5
) {
  try {
    // Décodage du polyline en liste de points {latitude, longitude}
    let pathPoints = polyline
      .decode(encodedPolyline)
      .map((p) => ({ latitude: p[0], longitude: p[1] }));

    // Si un point de départ est fourni, on le force en tête de l'itinéraire
    if (
      startLat !== null &&
      startLng !== null &&
      !isNaN(startLat) &&
      !isNaN(startLng)
    ) {
      pathPoints[0] = {
        latitude: parseFloat(startLat),
        longitude: parseFloat(startLng),
      };
    }

    if (!pathPoints || pathPoints.length < 2) {
      console.error("Erreur: Polyline invalide ou trop courte.");
      return;
    }

    let sequenceId = 0;
    const speedMps = (simulationSpeedKmh * 1000) / 3600;
    let currentPointIndex = 0;
    let currentSegmentFraction = 0.0;
    let stopped = false;
    let stopIntervalsLeft = 0;
    let approachingStop = false;
    let braking = false;
    let brakingStartIdx = null;
    let brakingDistanceM = 0;
    let brakingProgress = 0;
    let currentSpeedKmh = simulationSpeedKmh;

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
      const distancePerIntervalM = (currentSpeedKmh * 1000 / 3600) * intervalSeconds;
      const fractionPerInterval = segmentDistanceM > 0 ? distancePerIntervalM / segmentDistanceM : 1.0;

      // Gestion des arrêts
      if (!stopped && currentSegmentFraction === 0.0 && stopProbability > 0 && Math.random() < stopProbability) {
        // On va s'arrêter, calculer la distance de freinage
        braking = true;
        brakingDistanceM = brakingDistance(simulationSpeedKmh);
        brakingStartIdx = currentPointIndex;
        brakingProgress = 0;
        approachingStop = true;
        console.log(`Préparation à l'arrêt : freinage sur ${brakingDistanceM.toFixed(1)}m.`);
      }

      // Si on est en phase de freinage
      if (braking) {
        // On réduit la vitesse progressivement jusqu'à l'arrêt
        const remainingDist = segmentDistanceM * (1 - currentSegmentFraction);
        if (remainingDist <= brakingDistanceM) {
          // Décélération linéaire
          const minSpeed = 2; // km/h, vitesse minimale avant arrêt
          currentSpeedKmh = Math.max(minSpeed, currentSpeedKmh - (simulationSpeedKmh / (brakingDistanceM / distancePerIntervalM)));
          if (currentSpeedKmh <= minSpeed + 0.1) {
            braking = false;
            stopped = true;
            stopIntervalsLeft = Math.ceil(stopDurationSeconds / intervalSeconds);
            currentSpeedKmh = simulationSpeedKmh; // On remet la vitesse pour la suite
            console.log("Arrêt complet atteint, arrêt simulé.");
          }
        }
      }

      let currentLocation;
      if (stopped && stopIntervalsLeft > 0) {
        currentLocation = point1;
        stopIntervalsLeft--;
        if (stopIntervalsLeft === 0) {
          stopped = false;
          approachingStop = false;
          braking = false;
          currentSpeedKmh = simulationSpeedKmh;
          console.log("Reprise du mouvement.");
        }
      } else {
        // Simulation de ralentissement aléatoire (hors freinage)
        let slowFactor = 1.0;
        if (!braking && Math.random() < 0.2) {
          slowFactor = randomDelay(0.3, 0.8);
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
      if (callbackUrl) {
        // Envoi des données GPS simulées à l'URL de rappel
        try {
          await axios.post(callbackUrl, gpsData);
          console.log(`Données envoyées à ${callbackUrl}: ${JSON.stringify(gpsData)}`);
        } catch (error) {
          console.error(`Erreur lors de l'envoi des données à ${callbackUrl}: ${error.message}`);
        }
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
    start_lat = null,
    start_lng = null,
    reference = null,
    interval_seconds = 5
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
    stop_duration_seconds,
    start_lat,
    start_lng,
    reference,
    interval_seconds
  );

  res.status(200).json({ message: "Simulation démarrée en arrière-plan." });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Serveur Express en écoute sur le port ${PORT}`);
  console.log(`Accédez à http://localhost:${PORT}`);
});
