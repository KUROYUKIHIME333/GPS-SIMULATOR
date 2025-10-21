import { v4 as uuidv4 } from 'uuid';
import { getRouteFromAPI } from '../utils/apiClient';
import { getDistance, interpolatePosition, Point } from '../utils/geoUtils'; // Importe l'interface Point

// Définition des interfaces pour les données d'un transfert
export type ReRouteStrategy = 'start' | 'middle' | 'end' | 'random';

interface ReRouteWindow {
	min: number;
	max: number;
}

interface Transfert {
	id: string;
	mobileId: string;
	initialPolyline: Point[];
	currentPolyline: Point[];
	vitesseMoyenne: number; // km/h
	probabiliteArret: number; // entre 0 et 1
	tempsTotalArret: number; // secondes
	initialDuration: number; // secondes
	totalRouteDistance: number; // mètres
	startTime: number; // Date.now()
	elapsedTime: number; // secondes
	currentPosition: Point;
	currentSpeed: number; // km/h
	distanceTraveledFromStart: number; // mètres
	currentStopDuration: number; // secondes, temps restant de l'arrêt actuel
	isStopped: boolean;
	remainingStopTimes: number[]; // secondes
	remainingTimeForNextStopCheck: number; // secondes
	intervalId: NodeJS.Timeout | null; // Type pour les id d'intervalle dans Node.js, d'après Alphonse ou John, je ne me rapelle plus qui
	reRouteAttempts: number;
	reRouteStrategy: ReRouteStrategy;
	reRouteWindow: ReRouteWindow;
	hasReRouted: boolean;
}

class TransfertManager {
	private transfers: { [key: string]: Transfert } = {}; // Index signature pour le type de l'objet

	private simulationInterval: number = 1000; // Update frequency in ms
	private reRouteChance: number = 0.01; // Rerouting probability

	// Duration in second of the route based on distance and average speed.
	private _calculateDuration(polyline: Point[], vitesseMoyenne: number): number {
		let totalDistance = 0;
		for (let i = 0; i < polyline.length - 1; i++) {
			totalDistance += getDistance(polyline[i], polyline[i + 1]);
		}
		const vitesseMoyenne_mps = (vitesseMoyenne * 1000) / 3600;
		return totalDistance / vitesseMoyenne_mps;
	}

	// To distribute stop times according to stop probabilities
	private _distributeStopTimes(totalStopDuration: number, probabiliteArret: number): number[] {
		if (probabiliteArret === 0 || totalStopDuration === 0) return [];
		const maxStops = Math.floor(totalStopDuration / 60);
		const numberOfStops = Math.max(1, Math.floor(maxStops * probabiliteArret));
		let remainingDuration = totalStopDuration;
		const stopDurations: number[] = [];

		for (let i = 0; i < numberOfStops; i++) {
			if (remainingDuration <= 0) break;
			const stopTime = Math.random() * (remainingDuration / (numberOfStops - i));
			stopDurations.push(stopTime);
			remainingDuration -= stopTime;
		}
		return stopDurations.sort(() => 0.5 - Math.random());
	}

	// Time intervalls when a road change is allowed.
	private _getReRouteWindow(strategy: ReRouteStrategy, initialDuration: number): ReRouteWindow {
		const windowSize = initialDuration * 0.2;
		switch (strategy) {
			case 'start':
				return { min: 0, max: windowSize };
			case 'middle':
				return { min: initialDuration * 0.4 - windowSize / 2, max: initialDuration * 0.6 + windowSize / 2 };
			case 'end':
				return { min: initialDuration - windowSize, max: initialDuration };
			case 'random':
			default:
				return { min: initialDuration * 0.1, max: initialDuration * 0.9 };
		}
	}

	// To start the simulation of one vehicle
	public async startTransfert(
		mobileId: string,
		polyline: Point[],
		vitesseMoyenne: number,
		probabiliteArret: number,
		tempsTotalArret: number,
		reRouteStrategy: ReRouteStrategy
	): Promise<{ id: string; initialDuration: number }> {
		const id = uuidv4();
		const initialDuration = this._calculateDuration(polyline, vitesseMoyenne);
		const totalRouteDistance = this._calculateDuration(polyline, 1) * ((vitesseMoyenne * 1000) / 3600);

		const transfert: Transfert = {
			id,
			mobileId,
			initialPolyline: polyline,
			currentPolyline: polyline,
			vitesseMoyenne,
			probabiliteArret,
			tempsTotalArret,
			initialDuration,
			totalRouteDistance,
			startTime: Date.now(),
			elapsedTime: 0,
			currentPosition: polyline[0],
			currentSpeed: vitesseMoyenne,
			distanceTraveledFromStart: 0,
			currentStopDuration: 0,
			isStopped: false,
			remainingStopTimes: this._distributeStopTimes(tempsTotalArret, probabiliteArret),
			remainingTimeForNextStopCheck: (Math.random() * initialDuration * 1000) / this.simulationInterval,
			intervalId: null,
			reRouteAttempts: 0,
			reRouteStrategy,
			reRouteWindow: this._getReRouteWindow(reRouteStrategy, initialDuration),
			hasReRouted: false,
		};

		this.transfers[id] = transfert;
		transfert.intervalId = setInterval(() => this._simulateTransfert(id), this.simulationInterval);
		return { id, initialDuration };
	}

	// The loop when a mobile (vehicle) state is updated
	private async _simulateTransfert(id: string): Promise<void> {
		const transfert = this.transfers[id];
		if (!transfert) return;

		const now = Date.now();
		const prevElapsedTime = transfert.elapsedTime;
		transfert.elapsedTime = (now - transfert.startTime) / 1000;
		const deltaTime = transfert.elapsedTime - prevElapsedTime;

		if (transfert.distanceTraveledFromStart >= transfert.totalRouteDistance && !transfert.isStopped) {
			transfert.currentPosition = transfert.currentPolyline[transfert.currentPolyline.length - 1];
			transfert.currentSpeed = 0;
			if (transfert.intervalId) {
				clearInterval(transfert.intervalId);
			}
			console.log(`Transfert ${id} terminé.`);
			delete this.transfers[id];
			return;
		}

		// Simulated stop
		if (transfert.isStopped) {
			transfert.currentStopDuration -= deltaTime;
			if (transfert.currentStopDuration <= 0) {
				transfert.isStopped = false;
				transfert.currentSpeed = transfert.vitesseMoyenne;
				console.log(`Transfert ${id} a redémarré.`);
			}
		} else {
			transfert.remainingTimeForNextStopCheck -= deltaTime;
			if (transfert.remainingTimeForNextStopCheck <= 0) {
				if (Math.random() < transfert.probabiliteArret && transfert.remainingStopTimes.length > 0) {
					transfert.isStopped = true;
					transfert.currentStopDuration = transfert.remainingStopTimes.shift() || 0;
					transfert.currentSpeed = 0;
					console.log(`Transfert ${id} s'est arrêté pour ${transfert.currentStopDuration.toFixed(2)} secondes.`);
				}
				transfert.remainingTimeForNextStopCheck = Math.random() * (transfert.initialDuration - transfert.elapsedTime) * 0.5;
			}

			if (!transfert.isStopped) {
				const distancePerSecond = (transfert.vitesseMoyenne * 1000) / 3600;
				const distanceTraveledInThisInterval = distancePerSecond * deltaTime;
				transfert.distanceTraveledFromStart += distanceTraveledInThisInterval;

				transfert.currentPosition = interpolatePosition(transfert.currentPolyline, transfert.distanceTraveledFromStart);

				// Simulated road changes
				const { min, max } = transfert.reRouteWindow;

				if (!transfert.hasReRouted && transfert.elapsedTime >= min && transfert.elapsedTime <= max && Math.random() < this.reRouteChance && transfert.reRouteAttempts < 1) {
					console.log(`Tentative de changement d'itinéraire forcé (${transfert.reRouteStrategy}) pour le transfert ${id}...`);
					try {
						const finalPoint = transfert.initialPolyline[transfert.initialPolyline.length - 1];
						const newRoute = await getRouteFromAPI(transfert.currentPosition, finalPoint);
						if (newRoute && newRoute.length > 1) {
							let newDistanceTraveledOnNewRoute = 0;
							let minDist = Infinity;
							let closestPointIndex = -1;

							for (let i = 0; i < newRoute.length; i++) {
								const dist = getDistance(newRoute[i], transfert.currentPosition);
								if (dist < minDist) {
									minDist = dist;
									closestPointIndex = i;
								}
							}

							if (closestPointIndex !== -1) {
								for (let i = 0; i < closestPointIndex; i++) {
									newDistanceTraveledOnNewRoute += getDistance(newRoute[i], newRoute[i + 1]);
								}
								newDistanceTraveledOnNewRoute += getDistance(newRoute[closestPointIndex], transfert.currentPosition);
							}

							transfert.currentPolyline = newRoute;
							transfert.distanceTraveledFromStart = newDistanceTraveledOnNewRoute;
							transfert.reRouteAttempts++;
							transfert.hasReRouted = true;
							console.log(`Itinéraire mis à jour pour le transfert ${id}.`);

							transfert.totalRouteDistance = this._calculateDuration(transfert.currentPolyline, 1) * ((transfert.vitesseMoyenne * 1000) / 3600);
							const remainingDistanceTotal = transfert.totalRouteDistance - transfert.distanceTraveledFromStart;
							const estimatedRemainingTimeOnNewRoute = remainingDistanceTotal / distancePerSecond;
							transfert.initialDuration = transfert.elapsedTime + estimatedRemainingTimeOnNewRoute;
						}
					} catch (error) {
						console.error(`Échec du changement d'itinéraire pour ${id}:`, (error as Error).message);
					}
				}
			}
		}
	}

	// Actual state of a transfert/itineraire
	public getTransfertStatus(id: string): TransfertStatus | null {
		const transfert = this.transfers[id];
		if (!transfert) {
			return null;
		}

		const initialTravelTime = transfert.initialDuration;
		const totalElapsedTime = transfert.elapsedTime;
		const currentSpeed = transfert.currentSpeed;
		const currentPosition = transfert.currentPosition;

		let remainingDistanceOnCurrentRoute = 0;
		let closestPointIndex = -1;
		let minDist = Infinity;
		for (let i = 0; i < transfert.currentPolyline.length; i++) {
			const dist = getDistance(transfert.currentPolyline[i], currentPosition);
			if (dist < minDist) {
				minDist = dist;
				closestPointIndex = i;
			}
		}

		if (closestPointIndex !== -1) {
			remainingDistanceOnCurrentRoute = getDistance(currentPosition, transfert.currentPolyline[closestPointIndex]);
			for (let i = closestPointIndex; i < transfert.currentPolyline.length - 1; i++) {
				remainingDistanceOnCurrentRoute += getDistance(transfert.currentPolyline[i], transfert.currentPolyline[i + 1]);
			}
		} else {
			remainingDistanceOnCurrentRoute = Math.max(0, transfert.totalRouteDistance - transfert.distanceTraveledFromStart);
		}

		const distancePerSecond = (transfert.vitesseMoyenne * 1000) / 3600;
		const estimatedRemainingTime =
			currentSpeed > 0 && distancePerSecond > 0 && remainingDistanceOnCurrentRoute > 0 ? remainingDistanceOnCurrentRoute / distancePerSecond : Math.max(0, initialTravelTime - totalElapsedTime);

		return {
			id: transfert.id,
			mobileId: transfert.mobileId,
			currentPosition,
			currentSpeed,
			elapsedTime: Math.floor(totalElapsedTime),
			estimatedRemainingTime: Math.max(0, Math.floor(estimatedRemainingTime + (transfert.isStopped ? transfert.currentStopDuration : 0))),
			initialDuration: Math.floor(initialTravelTime),
			isStopped: transfert.isStopped,
			stopDurationLeft: Math.max(0, Math.floor(transfert.currentStopDuration)),
			reRouteStrategy: transfert.reRouteStrategy,
			hasReRouted: transfert.hasReRouted,
		};
	}

	// To cancel an actual simulation
	public cancelTransfert(id: string): boolean {
		if (this.transfers[id]) {
			if (this.transfers[id].intervalId) {
				clearInterval(this.transfers[id].intervalId);
			}
			delete this.transfers[id];
			console.log(`Transfert ${id} a été annulé.`);
			return true;
		}
		return false;
	}
}

// Interface pour le statut retourné par getTransfertStatus
export interface TransfertStatus {
	id: string;
	mobileId: string;
	currentPosition: Point;
	currentSpeed: number;
	elapsedTime: number;
	estimatedRemainingTime: number;
	initialDuration: number;
	isStopped: boolean;
	stopDurationLeft: number;
	reRouteStrategy: ReRouteStrategy;
	hasReRouted: boolean;
}

export default new TransfertManager();
