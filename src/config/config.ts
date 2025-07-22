import dotenv from 'dotenv';
dotenv.config();

interface AppConfig {
    port: number;
    orsApiKey: string;
    mapboxApiKey?: string; // Optionnel
}

const config: AppConfig = {
    port: parseInt(process.env.PORT || '3000', 10), // Convertit en nombre, avec un défaut
    orsApiKey: process.env.ORS_API_KEY || '', // Assure qu'une chaîne est toujours présente
    mapboxApiKey: process.env.MAPBOX_API_KEY
};

// Vérification simple pour s'assurer que les clés API essentielles sont présentes
if (!config.orsApiKey) {
    console.warn("ORS_API_KEY n'est pas définie dans le fichier .env. L'API OpenRouteService pourrait ne pas fonctionner.");
}

export default config;