// Global variables
const search = document.getElementById("search");
let jsonData = null; // To store the JSON data after loading the Excel file
let sortOrder = "asc";

let currentPage = 1; // Which page is currently displayed
const pageSize = 15; // How many cards per page
let filteredDrones = []; // The final array after search + filters

const filters = {
  makes: new Set(),
  countries: new Set(),
  types: new Set(),
  blues: new Set(),
  prices: [
    { label: "$0 - $5,000", min: 0, max: 5000 },
    { label: "$5,000 - $10,000", min: 5000, max: 10000 },
    { label: "$10,000 - $30,000", min: 10000, max: 30000 },
    { label: "$30,000 - $60,000", min: 30000, max: 60000 },
    { label: "$60,000 - $100,000", min: 60000, max: 100000 },
    { label: "$100,000+", min: 100000, max: Infinity }
  ]
};

// Function to read the Excel file and convert it to JSON
async function loadExcelFile() {
  try {
    console.log("Loading Data...");
    const response = await fetch(
      "data.xlsx"
    );
    const arrayBuffer = await response.arrayBuffer();

    // Parse the Excel file using SheetJS
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert the Excel sheet to JSON
    jsonData = XLSX.utils.sheet_to_json(sheet);

    // Initialize the app with data
    createFilters(jsonData);
    console.log(jsonData);

    updateCards();
    addFilterListeners();
  } catch (error) {
    console.error("Error loading Excel file:", error);
  }
}

// Function to create filters dynamically
function createFilters(data) {
  data.forEach((row) => {
    if (row.Make) filters.makes.add(row.Make);
    if (row["Made In"]) filters.countries.add(row["Made In"]);
    if (row.Type) filters.types.add(row.Type);
    if (row.Blue) filters.blues.add(row.Blue);
  });

  createFilterSection("makeFilters", filters.makes, "make-checkbox", "Brands");
  createFilterSection("countryFilters",filters.countries, "country-checkbox","Countries");
  createFilterSection("typeFilters", filters.types, "type-checkbox", "Types");
  createFilterSection("blueFilters", filters.blues, "blue-checkbox", "Blue List");
  createPriceFilterSection("priceFilters",filters.prices,"price-checkbox","Prices");
  
}

function createFilterSection(
  containerId,
  filterSet,
  filterClass,
  sectionTitle
) {
  const container = document.getElementById(containerId);
  container.innerHTML = ""; // Clear existing content

  // Add a header
  const header = document.createElement("h3");
  header.textContent = sectionTitle;
  container.appendChild(header);

  // Convert the filter set to a sorted array
  const filtersArray = Array.from(filterSet).sort();

  // Create a container for the filter checkboxes
  const filterContainer = document.createElement("div");
  filterContainer.classList.add("filter-options");
  container.appendChild(filterContainer);

  // We only want to show up to 5 by default
  const limit = 8;

  // Create labels for each filter option
  filtersArray.forEach((value, index) => {
    const label = document.createElement("label");
    label.innerHTML = `<input type="checkbox" class="${filterClass}" value="${value}"> ${value}`;

    // If the index is 5 or higher, hide it initially
    if (index >= limit) {
      label.style.display = "none";
      label.classList.add("hidden-filter");
    } else {
      label.classList.add("visible-filter");
    }

    filterContainer.appendChild(label);
  });

  // Only add a "Show More" button if there are more than 5 items
  if (filtersArray.length > limit) {
    const showMoreBtn = document.createElement("button");
    showMoreBtn.textContent = "Show More";
    showMoreBtn.classList.add("show-more-button");
    container.appendChild(showMoreBtn);

    // Toggle the visibility of hidden items when clicked
    showMoreBtn.addEventListener("click", () => {
      const hiddenLabels = filterContainer.querySelectorAll(".hidden-filter");
      const isExpanded = showMoreBtn.textContent === "Show Less";

      hiddenLabels.forEach((label) => {
        label.style.display = isExpanded ? "none" : "block";
      });

      showMoreBtn.textContent = isExpanded ? "Show More" : "Show Less";
    });
  }

  // *** Add a "Clear All" button for this section ***
  const clearAllButton = document.createElement("button");
  clearAllButton.textContent = "Clear All";
  clearAllButton.classList.add("clear-all-button");
  container.appendChild(clearAllButton);

  // On click, uncheck all checkboxes for this section and update
  clearAllButton.addEventListener("click", () => {
    // Uncheck all checkboxes of the specified filterClass in this container
    const checkboxes = filterContainer.querySelectorAll(
      `input[type="checkbox"].${filterClass}:checked`
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    // Re-run the filtering logic to refresh cards
    updateCards();
  });
}

function createPriceFilterSection(
  containerId,
  priceRanges,
  filterClass,
  sectionTitle
) {
  const container = document.getElementById(containerId);
  container.innerHTML = ""; // Clear existing content

  // Add a header
  const header = document.createElement("h3");
  header.textContent = sectionTitle;
  container.appendChild(header);

  // Add checkboxes for each price range
  priceRanges.forEach((range) => {
    const label = document.createElement("label");
    label.innerHTML = `
            <input type="checkbox" class="${filterClass}" 
                   data-min="${range.min}" data-max="${range.max}" 
                   value="${range.label}"> ${range.label}`;
    container.appendChild(label);
  });

  // Add a checkbox for "Price Unknown"
  const unknownLabel = document.createElement("label");
  unknownLabel.innerHTML = `
    <input type="checkbox" class="${filterClass}" data-unknown="true" value="Price Unknown">
    Price Unknown
  `;
  container.appendChild(unknownLabel);

  // *** Add a "Clear All" button here as well ***
  const clearAllButton = document.createElement("button");
  clearAllButton.textContent = "Clear All";
  clearAllButton.classList.add("clear-all-button");
  container.appendChild(clearAllButton);

  clearAllButton.addEventListener("click", () => {
    const checkboxes = container.querySelectorAll(
      `input[type="checkbox"].${filterClass}:checked`
    );
    checkboxes.forEach((checkbox) => {
      checkbox.checked = false;
    });
    updateCards();
  });
}

function getFilteredData() {
  // 1. Gather filters
  const selectedMakes = getSelectedFilters("make-checkbox");
  const selectedCountries = getSelectedFilters("country-checkbox");
  const selectedTypes = getSelectedFilters("type-checkbox");
  const selectedBlues = getSelectedFilters("blue-checkbox");

  // Price filters (with unknown handling)
  const selectedPrices = Array.from(
    document.querySelectorAll(".price-checkbox:checked")
  );
  const includeUnknown = selectedPrices.some(
    (checkbox) => checkbox.dataset.unknown === "true"
  );
  const priceRanges = selectedPrices
    .filter((checkbox) => !checkbox.dataset.unknown)
    .map((checkbox) => ({
      min: parseFloat(checkbox.dataset.min),
      max: parseFloat(checkbox.dataset.max)
    }));

  // 2. Gather search text
  const searchValue = search.value.toLowerCase();

  // 3. Filter the data
  const filteredData = jsonData.filter((row) => {
    // -- Brand, Country, Type Filters --
    const makeMatch =
      selectedMakes.length === 0 || selectedMakes.includes(row.Make);

    const countryMatch =
      selectedCountries.length === 0 ||
      selectedCountries.includes(row["Made In"]);

    const typeMatch =
      selectedTypes.length === 0 || selectedTypes.includes(row.Type);
    
    const blueMatch = selectedBlues.length === 0 || selectedBlues.includes(row.Blue); // Match Blue filter

    // Price logic
    const priceVal = parseFloat(row.Price);

    const matchesPriceRanges = priceRanges.some(
      (range) => priceVal >= range.min && priceVal < range.max
    );
    const matchesPriceUnknown = includeUnknown && isNaN(priceVal); // Check for NaN

    const priceMatch = includeUnknown
      ? priceRanges.length === 0
        ? matchesPriceUnknown // Only "Price Unknown" selected
        : matchesPriceRanges // Numeric ranges also selected
      : priceRanges.length === 0
      ? true // No filters selected, match all
      : matchesPriceRanges; // Only numeric ranges

    // -- Search Filter (Matches if any relevant field contains searchValue) --
    // For example, searching Make, Model, or Country:
    const rowMake = row.Make?.toLowerCase() || "";
    const rowModel = row.Model?.toLowerCase() || "";
    const rowCountry = row["Made In"]?.toLowerCase() || "";
    const matchesSearch =
      !searchValue ||
      rowMake.includes(searchValue) ||
      rowModel.includes(searchValue) ||
      rowCountry.includes(searchValue);

    // Combine all conditions
    return (
      makeMatch && countryMatch && typeMatch && priceMatch && matchesSearch && blueMatch
    );
  });

  return filteredData;
}

// Function to load drone data into cards
function loadDroneData(data) {
  const container = document.getElementById("droneTable");
  container.innerHTML = ""; // Clear existing content

  data.forEach((row) => {
    const card = document.createElement("div");
    card.className = "drone-card";
    
    

    let specs = Object.entries(row)
      .filter(([key]) => key !== "848") // Exclude the '848' key
      .filter(([key]) => key !== "Price") // Exclude the 'Price' key
      .filter(([key]) => key !== "Blue") // Exclude the 'Blue' key
      .filter(([key]) => key !== "Image") // Exclude the 'Image' key
      .filter(([key]) => key !== "Link") // Exclude the 'Link' key
      .filter(([key]) => key !== "Model") // Exclude the 'Model' key
      .filter(([key]) => key !== "Make") // Exclude the 'Make' key
      .filter(([key]) => key !== "Made In") // Exclude the 'Made In' key
      .map(
        ([key, value]) => `<p><strong>${key}:</strong> ${value || "N/A"}</p>`
      )
      .join("");
    
    if (row.Blue) {
      specs+='<p><strong>BLUE (DOD Approved)</strong></p>'
    }

    // Add the Link field explicitly if it exists
    if (row.Link) {
      specs += `<p><a href="${row.Link}" target="_blank" rel="noopener noreferrer">Link</a></p>`;
    }

    card.innerHTML = `
            <div class="card-header">
                <h3>${row.Make} ${row.Model}</h3>
            </div>
            <div class="image-container">
                <img src="${row.Image}" 
                     onerror="this.src='/dronetable/images/placeholder.jpg';" 
                     alt="${row.Make} ${row.Model}" />
            </div>
            <div class="card-body">
              <ul>
                <li><strong>Country of Origin:</strong> ${
                  row["Made In"] || "N/A"
                }</li>
                <li><strong>Type:</strong> ${row.Type || "N/A"}</li>
              </ul>
            </div>
            <div class="card-footer">
                <button type="button" class="toggle-dropdown"><strong>Show Specs</strong></button>
                <p style="float:right;">${
                  typeof row.Price === "number" &&
                  !isNaN(row.Price) &&
                  row.Price !== 0
                    ? new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD"
                      }).format(row.Price)
                    : "Pricing Unknown"
                }</p>
            </div>
            <div class="card-dropdown">
                ${specs}
            </div>
        `;

    // Add event listener for dropdown toggle
    const toggleButton = card.querySelector(".toggle-dropdown");
    const dropdown = card.querySelector(".card-dropdown");

    toggleButton.addEventListener("click", () => {
      dropdown.classList.toggle("open");
      toggleButton.innerHTML = dropdown.classList.contains("open")
        ? "<strong>Hide Specs</strong>"
        : "<strong>Show Specs</strong>";
    });

    container.appendChild(card);
  });
}

// Helper function to get selected filters
function getSelectedFilters(filterClass) {
  return Array.from(document.querySelectorAll(`.${filterClass}:checked`)).map(
    (checkbox) => checkbox.value
  );
}

// Function to filter and update cards
function updateCards() {
  // 1. Get the new filtered array
  filteredDrones = getFilteredData();

  // 2. Reset to page 1 whenever filters change
  currentPage = 1;

  // 3. Render the current page
  renderCurrentPage();
}

function renderCurrentPage() {
  // If there's no filteredDrones array yet, do nothing
  if (!filteredDrones.length) {
    loadDroneData([]); // Or handle the "no results" case
    renderPaginationControls();
    return;
  }

  // Calculate the index range
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  // Slice the array for the current page
  const pageData = filteredDrones.slice(startIndex, endIndex);

  // Render only those items
  loadDroneData(pageData);

  // Render the pagination buttons (Prev/Next, page numbers, etc.)
  renderPaginationControls();
}

function renderPaginationControls() {
  const paginationContainer = document.getElementById("paginationControls");
  paginationContainer.innerHTML = ""; // Clear old controls

  if (!filteredDrones.length) return;

  // Total number of pages
  const totalPages = Math.ceil(filteredDrones.length / pageSize);

  // Previous button
  const prevBtn = document.createElement("button");
  prevBtn.textContent = "Previous";
  prevBtn.disabled = currentPage === 1; // Disable on first page
  prevBtn.addEventListener("click", () => {
    if (currentPage > 1) {
      currentPage--;
      renderCurrentPage();
    }
  });
  paginationContainer.appendChild(prevBtn);

  // Page info
  const pageInfo = document.createElement("span");
  pageInfo.style.margin = "0 10px";
  pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
  paginationContainer.appendChild(pageInfo);

  // Next button
  const nextBtn = document.createElement("button");
  nextBtn.textContent = "Next";
  nextBtn.disabled = currentPage === totalPages; // Disable on last page
  nextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderCurrentPage();
    }
  });
  paginationContainer.appendChild(nextBtn);
}

// Add filter listeners
function addFilterListeners() {
  document.querySelectorAll('input[type="checkbox"]').forEach((checkbox) => {
    checkbox.addEventListener("change", updateCards);
  });
}

// Initialize the app
document.addEventListener("DOMContentLoaded", () => {
  loadExcelFile();
});

search.addEventListener("input", () => {
  updateCards(); // Re-run the combined filtering (including search)
});

document.getElementById("sortPriceBtn").addEventListener("click", (e) => {
  //filteredDrones = getFilteredData();

  filteredDrones.sort((a, b) => {
    const priceA = parseFloat(a.Price) || 0;
    const priceB = parseFloat(b.Price) || 0;
    return sortOrder === "asc" ? priceA - priceB : priceB - priceA;
  });

  // Toggle the order for next click
  sortOrder = sortOrder === "asc" ? "desc" : "asc";

  // Update button text
  e.target.textContent =
    sortOrder === "asc"
      ? "Sort by Price (Low to High)"
      : "Sort by Price (High to Low)";

  currentPage = 1; // Reset to page 1 after sort
  renderCurrentPage();
});