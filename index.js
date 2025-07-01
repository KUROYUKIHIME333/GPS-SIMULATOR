const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const polyline = require("@mapbox/polyline"); // For decoding polylines
const axios = require("axios"); // For making HTTP requests
const haversine = require("haversine-distance"); // For calculating distance between two points
const path = require("path"); // For handling file paths

const app = express();
const PORT = process.env.PORT || 3000;

// Allow all origins requests (CORS)
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Middleware to parse JSON request bodies
app.use(bodyParser.json());

// To serve static files (like CSS, JS, images) from the 'public' directory
app.use(express.static("public"));

// To serve the landing page ('/')
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/home.html");
});

// Function to interpolate points along a segment
function interpolatePoint(point1, point2, fraction) {
  const lat = point1.latitude + fraction * (point2.latitude - point1.latitude);
  const lon =
    point1.longitude + fraction * (point2.longitude - point1.longitude);
  return { latitude: lat, longitude: lon };
}

// Function to generate a random delay between min and max seconds
function randomDelay(min, max) {
  return Math.random() * (max - min) + min;
}

// Function to calculate braking distance
// Formula: d = v² / (2 * a) + v * t
function brakingDistance(speedKmh, reactionTime = 1.0, deceleration = 6.0) {
  const speedMs = speedKmh / 3.6;
  const reactionDist = speedMs * reactionTime;
  const brakingDist = (speedMs * speedMs) / (2 * deceleration);
  return reactionDist + brakingDist; // in meters
}

// Function to simulate vehicle movement along the polyline
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
    // To decode the polyline into an array of points
    let pathPoints = polyline
      .decode(encodedPolyline)
      .map((p) => ({ latitude: p[0], longitude: p[1] }));

    // If a strart point is given, set it as the first point
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
      const distancePerIntervalM =
        ((currentSpeedKmh * 1000) / 3600) * intervalSeconds;
      const fractionPerInterval =
        segmentDistanceM > 0 ? distancePerIntervalM / segmentDistanceM : 1.0;

      // Stop conditions
      if (
        !stopped &&
        currentSegmentFraction === 0.0 &&
        stopProbability > 0 &&
        Math.random() < stopProbability
      ) {
        // When Stopping, to calculate braking distance
        braking = true;
        brakingDistanceM = brakingDistance(simulationSpeedKmh);
        brakingStartIdx = currentPointIndex;
        brakingProgress = 0;
        approachingStop = true;
        console.log(
          `Préparation à l'arrêt : freinage sur ${brakingDistanceM.toFixed(
            1
          )}m.`
        );
      }

      // If we are braking
      if (braking) {
        // To decrease speed till stop
        const remainingDist = segmentDistanceM * (1 - currentSegmentFraction);
        if (remainingDist <= brakingDistanceM) {
          // linearly decrease speed
          const minSpeed = 2; // minimal speed before stopping (2 km/h)
          currentSpeedKmh = Math.max(
            minSpeed,
            currentSpeedKmh -
              simulationSpeedKmh / (brakingDistanceM / distancePerIntervalM)
          );
          if (currentSpeedKmh <= minSpeed + 0.1) {
            braking = false;
            stopped = true;
            stopIntervalsLeft = Math.ceil(
              stopDurationSeconds / intervalSeconds
            );
            currentSpeedKmh = simulationSpeedKmh; // resetting speed after stoping
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
        // Random braking simulation
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
          currentLocation = interpolatePoint(
            point1,
            point2,
            currentSegmentFraction
          );
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
        // To send the data to the callback URL
        try {
          await axios.post(callbackUrl, gpsData);
          console.log(
            `Données envoyées à ${callbackUrl}: ${JSON.stringify(gpsData)}`
          );
        } catch (error) {
          console.error(
            `Erreur lors de l'envoi des données à ${callbackUrl}: ${error.message}`
          );
        }
      }
    }, intervalSeconds * 1000);
  } catch (e) {
    console.error(`Erreur inattendue pendant la simulation: ${e.message}`);
  }
}

// Endpoint to start the simulation
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
    interval_seconds = 5,
  } = req.body;

  if (!encoded_polyline) {
    return res.status(400).json({ error: "encoded_polyline est requis." });
  }
  if (!callback_url) {
    return res.status(400).json({ error: "callback_url est requis." });
  }

  // To begin simulation in the background
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
