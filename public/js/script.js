const form = document.getElementById('simForm');
const statusDiv = document.getElementById('status');
const submitButton = document.getElementById('submitButton');
const buttonText = document.getElementById('buttonText');
const loadingSpinner = document.getElementById('loadingSpinner');
const themeToggleButton = document.getElementById('themeToggleButton');
const themeIcon = document.getElementById('themeIcon');
const body = document.body;

/**
 * Applique le thème spécifié (dark ou light) au corps du document.
 * Met à jour l'icône du bouton de thème et l'attribut aria-label.
 * @param {string} theme - Le thème à appliquer ('dark' ou 'light').
 */
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
	// Toujours rendre l'icône visible
	themeIcon.style.display = 'inline';
}

// Appliquer le thème au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
	const savedTheme = localStorage.getItem('theme');
	if (savedTheme) {
		applyTheme(savedTheme);
	} else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
		applyTheme('dark');
	} else {
		applyTheme('light');
	}
	// Initialiser le statut d'information
	statusDiv.className = 'status initial';
	statusDiv.innerHTML = '<i class="fas fa-info-circle"></i> <span>Entrez les détails de la simulation et cliquez sur "Lancer la simulation".</span>';

	// Correction accessibilité : le bouton doit toujours être focusable
	themeToggleButton.tabIndex = 0;
});

// Écouteur d'événement pour le bouton de bascule de thème
themeToggleButton.addEventListener('click', () => {
	const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
	const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
	applyTheme(newTheme);
	localStorage.setItem('theme', newTheme); // Sauvegarde la préférence de l'utilisateur
});

// Accessibilité : activer le bouton avec Entrée ou Espace
// (important pour un bouton simple icône)
themeToggleButton.addEventListener('keydown', (e) => {
	if (e.key === 'Enter' || e.key === ' ') {
		e.preventDefault();
		themeToggleButton.click();
	}
});

// Écouteur d'événement pour la soumission du formulaire
form.addEventListener('submit', async (e) => {
	e.preventDefault(); // Empêche le rechargement de la page

	// Afficher l'état de chargement
	statusDiv.className = 'status loading';
	statusDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> <span>Simulation en cours...</span>';
	submitButton.disabled = true; // Désactive le bouton pendant le chargement
	buttonText.style.display = 'none';
	loadingSpinner.style.display = 'inline-block';

	// Récupérer les valeurs des champs du formulaire
	const callbackUrl = document.getElementById('callback').value.trim();
	const startLat = document.getElementById('startLat').value.trim();
	const startLng = document.getElementById('startLng').value.trim();
	const reference = document.getElementById('reference').value.trim();
	const interval = document.getElementById('interval').value.trim();

	// Préparer les données pour l'envoi
	const data = {
		encoded_polyline: document.getElementById('polyline').value.trim(),
		simulation_speed_kmh: parseFloat(document.getElementById('speed').value),
		stop_probability: parseFloat(document.getElementById('stopProb').value),
		stop_duration_seconds: parseInt(document.getElementById('stopDur').value, 10),
	};

	// Ajouter les champs optionnels si renseignés
	if (callbackUrl) {
		data.callback_url = callbackUrl;
	}
	if (startLat && startLng) {
		data.start_lat = parseFloat(startLat);
		data.start_lng = parseFloat(startLng);
	}
	if (reference) {
		data.reference = reference;
	}
	if (interval) {
		data.interval_seconds = parseInt(interval, 10);
	}

	try {
		if (callbackUrl) {
			// Mode API : Envoi des données au backend
			const resp = await fetch('/simulate_route', {
				// Assurez-vous que '/simulate_route' est la bonne URL de votre API
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(data),
			});

			const result = await resp.json();

			if (resp.ok) {
				statusDiv.className = 'status success';
				statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> <span>Simulation lancée avec succès : ${result.message || 'La simulation a démarré.'}</span>`;
			} else {
				statusDiv.className = 'status error';
				statusDiv.innerHTML = `<i class="fas fa-exclamation-triangle"></i> <span>Erreur : ${result.error || "Une erreur inconnue est survenue lors de l'appel API."}</span>`;
			}
		} else {
			// Mode local : Redirection pour visualisation sans appel API
			statusDiv.className = 'status success';
			statusDiv.innerHTML = `<i class="fas fa-map-marked-alt"></i> <span>Simulation locale : Redirection vers la visualisation du trajet...</span>`;

			// Construire l'URL de redirection
			let url = `itineraireProgress.html?polyline=${encodeURIComponent(data.encoded_polyline)}`;
			if (startLat && startLng) {
				url += `&startLat=${encodeURIComponent(startLat)}&startLng=${encodeURIComponent(startLng)}`;
			}

			// Rediriger après un court délai pour que l'utilisateur voie le message
			setTimeout(() => {
				window.location.href = url;
			}, 1200);
		}
	} catch (err) {
		// Gérer les erreurs de connexion ou autres exceptions
		statusDiv.className = 'status error';
		statusDiv.innerHTML = `<i class="fas fa-times-circle"></i> <span>Erreur de connexion : ${err.message}. Veuillez vérifier votre connexion ou l'URL du serveur.</span>`;
	} finally {
		// Réinitialiser l'état du bouton après l'opération (succès ou échec)
		submitButton.disabled = false;
		buttonText.style.display = 'inline-block';
		loadingSpinner.style.display = 'none';
	}
});
