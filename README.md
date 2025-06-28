# GPS Simulator

Ce projet est un simulateur de trajectoire GPS avec une interface web moderne et une API backend permettant de simuler l'envoi de positions GPS à une URL de callback.

Accès en ligne : [https://gps-simulator.onrender.com/](https://gps-simulator.onrender.com/)

## Fonctionnalités principales
- Génération et simulation de parcours GPS à partir d'un polyline encodé (format Google Maps)
- Simulation de vitesse, arrêts aléatoires, durée d'arrêt personnalisable
- Envoi des positions GPS simulées à une API externe (callback)
- Interface web avec changement de thème (clair/sombre)

## Installation

1. **Cloner le dépôt ou copier les fichiers**
2. Installer les dépendances Node.js :
   ```sh
   npm install
   ```
3. Lancer le serveur :
   ```sh
   node index.js
   ```
4. Accéder à l'interface web :
   - Ouvrir [http://localhost:3000](http://localhost:3000) ou le chemin renseigné en fonction du port disponible dans votre navigateur
   - Ou utilisez la version hébergée : [https://gps-simulator.onrender.com/](https://gps-simulator.onrender.com/)

## Utilisation de l'interface web

- Remplissez le formulaire avec un polyline, la vitesse, la probabilité et la durée d'arrêt.
- (Optionnel) Renseignez une URL de callback pour recevoir les positions GPS simulées.
- Cliquez sur "Lancer la simulation".
- Le bouton en haut à gauche permet de changer le thème (clair/sombre).

## Utilisation de l'API `/simulate_route`

### Endpoint
```
POST /simulate_route
Content-Type: application/json
```

### Corps de la requête (JSON)
| Champ                  | Type     | Obligatoire | Description                                                                 |
|------------------------|----------|-------------|-----------------------------------------------------------------------------|
| encoded_polyline       | string   | Oui         | Polyline encodé du trajet (format Google Maps)                              |
| callback_url           | string   | Oui         | URL à laquelle les positions GPS seront envoyées (POST JSON)                |
| simulation_speed_kmh   | number   | Non         | Vitesse moyenne en km/h (défaut: 40)                                        |
| stop_probability       | number   | Non         | Probabilité d'arrêt à chaque segment (0-1, défaut: 0.1)                     |
| stop_duration_seconds  | number   | Non         | Durée d'arrêt en secondes (défaut: 30)                                      |
| start_lat              | number   | Non         | Latitude de départ (sinon premier point du polyline)                        |
| start_lng              | number   | Non         | Longitude de départ (sinon premier point du polyline)                       |
| reference              | string   | Non         | Code ou identifiant à renvoyer dans chaque callback                         |

### Exemple de requête
```json
{
  "encoded_polyline": "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
  "callback_url": "https://votre-api.com/gps",
  "simulation_speed_kmh": 50,
  "stop_probability": 0.2,
  "stop_duration_seconds": 60,
  "reference": "vehicule-42"
}
```

### Réponse
- **200 OK** :
  ```json
  { "message": "Simulation démarrée en arrière-plan." }
  ```
- **400 Bad Request** :
  ```json
  { "error": "encoded_polyline est requis." }
  ```

### Fonctionnement
- Le serveur simule un déplacement le long du polyline.
- À chaque "tick" (toutes les 5 secondes), il envoie une position GPS à `callback_url` sous forme JSON :
  ```json
  {
    "latitude": 48.8566,
    "longitude": 2.3522,
    "timestamp": "2025-06-28T12:34:56.789Z",
    "sequence_id": 1,
    "reference": "vehicule-42"
  }
  ```
- La simulation gère les arrêts, les ralentissements et la reprise automatique.

## Dépendances principales
- express
- body-parser
- @mapbox/polyline
- axios
- haversine-distance

## À propos du développeur

Ce projet a été développé par **RAMAZANI SUMAILI Daniel**.

- Ingénieur-technicien en maintenance industrielle et développeur web
- Passionné par les sciences, la technologie et l'innovation
- Toujours prêt à explorer, apprendre et partager

**Contact :**
- Email : [danielramazanisumaili@gmail.com](mailto:danielramazanisumaili@gmail.com)
- Téléphone : [+243815086116](tel:+243815086116)
- [Site web](https://daniel-ramazani.onrender.com/)
- [LinkedIn](https://www.linkedin.com/in/daniel-hermann-ramazani-521786232/)
- [GitHub](https://github.com/KUROYUKIHIME333)

---

Pour toute question ou amélioration, ouvrez une issue ou contactez le développeur.
