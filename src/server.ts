// src/server.ts
import express, { Request, Response, NextFunction } from 'express';
import config from './config/config';
import transfertRoutes from './routes/transfertRoutes';
import path from 'path'; // Ajoute cette ligne pour gérer les chemins de fichiers
import dotenv from 'dotenv';


const app = express();
const PORT = config.port;
dotenv.config();
app.use(express.json());

// Servir les fichiers statiques depuis le dossier 'public'
// Cela permet d'accéder à index.html, simulate.html, css/, js/, assets/ directement via l'URL
app.use(express.static(path.join(__dirname, '../public'))); // __dirname pointe vers 'dist', donc '../public' est correct

// Toutes les routes liées aux transferts seront préfixées par '/transferts'
app.use('/transferts', transfertRoutes);

// Gérer les routes spécifiques pour les pages HTML (si tu veux des chemins clairs)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/simulate', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/simulate.html'));
});

app.get('/track', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/track.html'));
});


// Gestion des erreurs 404 - Si aucune route ne correspond
app.use((req: Request, res: Response, next: NextFunction) => {
    res.status(404).sendFile(path.join(__dirname, '../public/404.html')); // Optionnel: page 404 personnalisée
});

// Gestionnaire d'erreurs global pour les erreurs non capturées
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error(err.stack);
    res.status(500).send('Quelque chose s\'est mal passé !');
});

app.listen(PORT, () => {
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accédez à http://localhost:${PORT}`);
});