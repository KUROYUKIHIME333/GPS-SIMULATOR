export interface Point {
    lat: number;
    lng: number;
}

export function getDistance(p1: Point, p2: Point): number {
    const R = 6371e3; // Rayon de la Terre en mètres
    const φ1 = p1.lat * Math.PI / 180;
    const φ2 = p2.lat * Math.PI / 180;
    const Δφ = (p2.lat - p1.lat) * Math.PI / 180;
    const Δλ = (p2.lng - p1.lng) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

export function interpolatePosition(polyline: Point[], distanceTraveled: number): Point {
    let currentDistance = 0;
    for (let i = 0; i < polyline.length - 1; i++) {
        const segmentStart = polyline[i];
        const segmentEnd = polyline[i + 1];
        const segmentLength = getDistance(segmentStart, segmentEnd);

        if (currentDistance + segmentLength >= distanceTraveled) {
            const remainingDistanceInSegment = distanceTraveled - currentDistance;
            if (segmentLength === 0) return segmentStart;
            const ratio = remainingDistanceInSegment / segmentLength;
            const lat = segmentStart.lat + (segmentEnd.lat - segmentStart.lat) * ratio;
            const lng = segmentStart.lng + (segmentEnd.lng - segmentStart.lng) * ratio;
            return { lat, lng };
        }
        currentDistance += segmentLength;
    }
    return polyline[polyline.length - 1];
}