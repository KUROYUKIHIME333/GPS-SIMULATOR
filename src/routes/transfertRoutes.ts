import express, { Request, Response } from 'express';
import transfertManager, { ReRouteStrategy, TransfertStatus } from '../managers/transfertManager'; // Importe les types nécessaires
import { decodePolyline } from '../utils/polylineUtils';
import { Point } from '../utils/geoUtils';

const router = express.Router();

// Interface pour le corps de la requête POST /transferts
interface CreateTransfertRequestBody {
    polyline: string | Point[];
    vitesseMoyenne: number;
    probabiliteArret: number;
    tempsTotalArret: number;
    mobileId: string;
    reRouteStrategy?: ReRouteStrategy;
}

// Route POST pour démarrer un nouveau transfert.
router.post('/', async (req: Request<{}, {}, CreateTransfertRequestBody>, res: Response) => {
    const { polyline, vitesseMoyenne, probabiliteArret, tempsTotalArret, mobileId, reRouteStrategy = 'random' } = req.body;

    // Validation des champs obligatoires
    if (!polyline || !vitesseMoyenne || typeof probabiliteArret === 'undefined' || typeof tempsTotalArret === 'undefined' || !mobileId) {
        return res.status(400).json({ message: 'Tous les champs obligatoires (polyline, vitesseMoyenne, probabiliteArret, tempsTotalArret, mobileId) sont requis.' });
    }

    // Validation de la stratégie de reroutage
    if (!['start', 'middle', 'end', 'random'].includes(reRouteStrategy)) {
        return res.status(400).json({ message: 'reRouteStrategy doit être "start", "middle", "end" ou "random".' });
    }

    let decodedPolyline: Point[];
    // Gère les deux formats d'entrée pour le polyline : string encodée ou tableau de points {lat, lng}.
    if (typeof polyline === 'string') {
        try {
            decodedPolyline = decodePolyline(polyline);
        } catch (error) {
            return res.status(400).json({ message: 'Polyline encodé invalide.' });
        }
    } else if (Array.isArray(polyline)) {
        if (!polyline.every(p => typeof p.lat === 'number' && typeof p.lng === 'number')) {
            return res.status(400).json({ message: 'Le tableau de points doit contenir des objets { lat, lng } valides.' });
        }
        decodedPolyline = polyline;
    } else {
        // Fallback pour le type si la validation initiale est contournée
        return res.status(400).json({ message: 'Le champ polyline doit être une string encodée ou un tableau de points.' });
    }

    try {
        const { id, initialDuration } = await transfertManager.startTransfert(
            mobileId,
            decodedPolyline,
            vitesseMoyenne,
            probabiliteArret,
            tempsTotalArret,
            reRouteStrategy
        );
        res.status(201).json({ id, dureeInitiale: initialDuration, mobileId });
    } catch (error) {
        console.error('Erreur lors du démarrage du transfert:', (error as Error).message);
        res.status(500).json({ message: 'Erreur interne du serveur lors du démarrage du transfert.', error: (error as Error).message });
    }
});

// Route GET pour récupérer l'état d'un transfert par son ID.
router.get('/:id', (req: Request<{id: string}>, res: Response<TransfertStatus | { message: string }>) => {
    const { id } = req.params;
    const status = transfertManager.getTransfertStatus(id);

    if (!status) {
        return res.status(404).json({ message: 'Transfert non trouvé.' });
    }
    res.json(status);
});

// Route DELETE pour annuler un transfert par son ID.
router.delete('/:id', (req: Request<{id: string}>, res: Response<{ message: string }>) => {
    const { id } = req.params;
    const success = transfertManager.cancelTransfert(id);

    if (!success) {
        return res.status(404).json({ message: 'Transfert non trouvé.' });
    }
    res.json({ message: `Transfert ${id} annulé.` });
});

export default router;