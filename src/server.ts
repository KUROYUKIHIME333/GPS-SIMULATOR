import express, { Request, Response, NextFunction } from 'express';
import config from './config/config';
import transfertRoutes from './routes/transfertRoutes';

const app = express();
const PORT = config.port;

app.use(express.json());

// Toutes les routes liées aux transferts seront préfixées par '/transferts'
app.use('/transferts', transfertRoutes);

// Gestion des erreurs 404 - Si aucune route ne correspond
app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).json({ message: 'Route non trouvée.' });
});

// Gestionnaire d'erreurs global pour les erreurs non capturées
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack); // Log l'erreur complète pour le débogage
    res.status(500).send('Quelque chose s\'est mal passé !');
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez à http://localhost:${PORT}`);
});