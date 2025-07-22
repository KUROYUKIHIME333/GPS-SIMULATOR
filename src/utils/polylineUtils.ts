import Polyline from '@mapbox/polyline';
import { Point } from './geoUtils'; // Importe l'interface Point

export function decodePolyline(encodedPolyline: string): Point[] {
    return Polyline.decode(encodedPolyline).map(coord => ({ lat: coord[0], lng: coord[1] }));
}