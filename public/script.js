const form = document.getElementById('simForm');
const statusDiv = document.getElementById('status');
const submitButton = document.getElementById('submitButton');
const buttonText = document.getElementById('buttonText');
const loadingSpinner = document.getElementById('loadingSpinner');
const themeToggleButton = document.getElementById('themeToggleButton');
const themeIcon = document.getElementById('themeIcon');
const body = document.body;

function applyTheme(theme) {
    if (theme === 'dark') {
        body.classList.add('dark-mode');
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
        themeToggleButton.setAttribute('aria-label', 'Basculer vers le mode clair');
    } else {
        body.classList.remove('dark-mode');
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
        themeToggleButton.setAttribute('aria-label', 'Basculer vers le mode sombre');
    }
}
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        applyTheme(savedTheme);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
    } else {
        applyTheme('light');
    }
});
themeToggleButton.addEventListener('click', () => {
    const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    localStorage.setItem('theme', newTheme);
});
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    statusDiv.className = 'status loading';
    statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Simulation en cours...</span>';
    submitButton.disabled = true;
    buttonText.style.display = 'none';
    loadingSpinner.style.display = 'inline-block';
    const callbackUrl = document.getElementById('callback').value.trim();
    const data = {
        encoded_polyline: document.getElementById('polyline').value.trim(),
        simulation_speed_kmh: parseFloat(document.getElementById('speed').value),
        stop_probability: parseFloat(document.getElementById('stopProb').value),
        stop_duration_seconds: parseInt(document.getElementById('stopDur').value, 10)
    };
    if (callbackUrl) {
        data.callback_url = callbackUrl;
    }
    try {
        if (callbackUrl) {
            // Mode API : envoi au backend
            const resp = await fetch('/simulate_route', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await resp.json();
            if (resp.ok) {
                statusDiv.className = 'status success';
                statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> <span>Simulation lancée avec succès : ${result.message}</span>`;
            } else {
                statusDiv.className = 'status error';
                statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>Erreur : ${result.error || 'Une erreur inconnue est survenue.'}</span>`;
            }
        } else {
            // Mode local : juste visualisation
            statusDiv.className = 'status success';
            statusDiv.innerHTML = `<i class="fas fa-map-marked-alt"></i> <span>Simulation locale : visualisation du trajet sans envoi d'API.</span>`;
            // Redirige vers la page de suivi avec le polyline en paramètre (optionnel)
            setTimeout(() => {
                window.location.href = `itineraireProgress.html?polyline=${encodeURIComponent(data.encoded_polyline)}`;
            }, 1200);
        }
    } catch (err) {
        statusDiv.className = 'status error';
        statusDiv.innerHTML = `<i class="fas fa-times-circle"></i> <span>Erreur de connexion au serveur : ${err.message}. Veuillez vérifier votre connexion ou l'URL du serveur.</span>`;
    } finally {
        submitButton.disabled = false;
        buttonText.style.display = 'inline-block';
        loadingSpinner.style.display = 'none';
    }
});
