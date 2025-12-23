// main.js - Versión corregida
document.addEventListener("DOMContentLoaded", function () {
  const searchInput = document.querySelector(".search-input");
  const searchButton = document.querySelector(".btn-search-action");
  const searchCategory = document.querySelector(".search-category");

  function performSearch() {
    const searchTerm = searchInput.value.trim();
    const field = searchCategory ? searchCategory.value : "all";

    if (!searchTerm) {
      window.location.href = "/registers";
      return;
    }

    // Ahora usamos la ruta correcta que renderiza la vista
    const url = `/registers/search?q=${encodeURIComponent(searchTerm)}&field=${field}`;

    console.log("Navegando a:", url);
    window.location.href = url;
  }

  if (searchButton) {
    searchButton.addEventListener("click", performSearch);
  }

  if (searchInput) {
    searchInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        performSearch();
      }
    });
  }

  // Cargar valores de URL si existen
  const urlParams = new URLSearchParams(window.location.search);
  const searchTermFromUrl = urlParams.get("q");
  const searchFieldFromUrl = urlParams.get("field");

  if (searchTermFromUrl && searchInput) {
    searchInput.value = decodeURIComponent(searchTermFromUrl);
  }

  if (searchFieldFromUrl && searchCategory) {
    searchCategory.value = searchFieldFromUrl;
  }
});
