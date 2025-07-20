import axios from 'axios';
import config from '../config/config';
import { decodePolyline } from './polylineUtils';
import { Point } from './geoUtils';

const ORS_API_BASE_URL = 'https://api.openrouteservice.org/v2/directions/driving-car';
// const MAPBOX_API_BASE_URL = 'https://api.mapbox.com/directions/v5/mapbox/driving';

export async function getRouteFromAPI(startPoint: Point, endPoint: Point): Promise<Point[]> {
    try {
        // --- Configuration pour OpenRouteService ---
        const coordinates = `${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}`;
        const url = `${ORS_API_BASE_URL}?api_key=${config.orsApiKey}&start=${coordinates.split(';')[0]}&end=${coordinates.split(';')[1]}`;

        // --- Configuration pour Mapbox (décommentez si vous utilisez Mapbox) ---
        // const url = `${MAPBOX_API_BASE_URL}/${startPoint.lng},${startPoint.lat};${endPoint.lng},${endPoint.lat}?geometries=polyline&access_token=${config.mapboxApiKey}`;

        const response: any = await axios.get(url);

        // --- Traitement de la réponse pour OpenRouteService ---
        const encodedPolyline: string = response?.data?.routes[0].geometry;
        return decodePolyline(encodedPolyline);

        // --- Traitement de la réponse pour Mapbox (décommentez si vous utilisez Mapbox) ---
        // const encodedPolyline: string = response.data.routes[0].geometry;
        // return decodePolyline(encodedPolyline);

    } catch (error) {
        console.error('Erreur lors de la récupération de l\'itinéraire depuis l\'API:', (error as Error).message);
        throw new Error('Impossible de récupérer l\'itinéraire depuis l\'API. Vérifiez votre clé API et les points de départ/arrivée.');
    }
}