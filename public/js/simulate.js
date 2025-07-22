document.addEventListener("DOMContentLoaded", () => {
  const simForm = document.querySelector("#simForm");
  const submitButton = document.querySelector("#submitButton");
  const buttonText = document.querySelector("#buttonText");
  const loadingSpinner = document.querySelector("#loadingSpinner");
  const statusDiv = document.querySelector("#status");

  simForm.addEventListener("submit", async (event) => {
    event.preventDefault(); // Empêche le rechargement de la page

    // Afficher l'indicateur de chargement
    buttonText.style.display = "none";
    loadingSpinner.style.display = "inline-block";
    submitButton.disabled = true;
    statusDiv.className = "status loading";
    statusDiv.innerHTML =
      '<i class="fas fa-hourglass-half"></i> <span>Démarrage de la simulation...</span>';

    const mobileId = document.querySelector("#mobileId").value;
    const polyline = document.querySelector("#polyline").value;
    const vitesseMoyenne = parseFloat(
      document.querySelector("#vitesseMoyenne").value
    );
    const probabiliteArret = parseFloat(
      document.querySelector("#probabiliteArret").value
    );
    const tempsTotalArret = parseInt(
      document.querySelector("#tempsTotalArret").value,
      10
    );
    const reRouteStrategy = document.querySelector("#reRouteStrategy").value;

    // Préparer les données pour l'API
    const data = {
      mobileId,
      polyline,
      vitesseMoyenne,
      probabiliteArret,
      tempsTotalArret,
      reRouteStrategy:
        reRouteStrategy === "random" ? undefined : reRouteStrategy, // Envoyer undefined si 'random' est sélectionné
    };

    try {
      const response = await fetch("/transferts", {
        // Endpoint de l'API
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        statusDiv.className = "status success";
        statusDiv.innerHTML = `<i class="fas fa-check-circle"></i> <span>Simulation démarrée avec succès ! ID: ${result.id}</span>`;

        // Stocke le polyline pour la page de suivi (solution temporaire)
        localStorage.setItem("lastSimulationPolyline", polyline);

        // Rediriger vers la page de suivi avec l'ID de simulation
        setTimeout(() => {
          window.location.href = `track.html?transferId=${result.id}`;
        }, 1500); // Délai pour que l'utilisateur voie le message de succès
      } else {
        statusDiv.className = "status error";
        statusDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>Erreur: ${
          result.message || "Une erreur inconnue est survenue."
        }</span>`;
      }
    } catch (error) {
      console.error("Erreur lors de l'envoi de la simulation:", error);
      statusDiv.className = "status error";
      statusDiv.innerHTML = `<i class="fas fa-exclamation-circle"></i> <span>Erreur de connexion au serveur.</span>`;
    } finally {
      // Cacher l'indicateur de chargement
      buttonText.style.display = "inline-block";
      loadingSpinner.style.display = "none";
      submitButton.disabled = false;
    }
  });

  // Gestion des tooltips (si tu veux des popups stylisés, sinon le title natif suffit)
  document.querySelectorAll(".tooltip-icon").forEach((icon) => {
    icon.addEventListener("mouseover", (e) => {
      const tooltipText = e.target.title;
      if (tooltipText) {
        // Tu pourrais créer une div de tooltip ici au lieu d'utiliser le title natif
      }
    });
  });
});
