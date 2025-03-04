// Heatmap visualization for entry frequency
class EntryHeatmap {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      throw new Error(`Container element with ID "${containerId}" not found`);
    }

    // Default options
    this.options = {
      cellSize: 15,
      cellMargin: 3,
      weeksToShow: 52, // Show one year by default
      colorRange: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
      tooltipEnabled: true,
      startOnMonday: false,
      ...options,
    };

    this.data = [];
    this.maxCount = 0;
    this.today = new Date();

    // Initialize the heatmap
    this.init();
  }

  // Initialize the heatmap structure
  init() {
    // Clear the container
    this.container.innerHTML = "";
    this.container.classList.add("heatmap-container");

    // Create header for the heatmap
    const header = document.createElement("div");
    header.className = "heatmap-header";
    header.innerHTML = "<h3>Your Recording Consistency</h3>";
    this.container.appendChild(header);

    // Create the heatmap element
    this.heatmapEl = document.createElement("div");
    this.heatmapEl.className = "heatmap";
    this.container.appendChild(this.heatmapEl);

    // Create the legend
    this.createLegend();
  }

  // Create the color legend
  createLegend() {
    const legend = document.createElement("div");
    legend.className = "heatmap-legend";

    const legendLabel = document.createElement("span");
    legendLabel.className = "legend-label";
    legendLabel.textContent = "Less";
    legend.appendChild(legendLabel);

    // Add color boxes
    this.options.colorRange.forEach((color) => {
      const colorBox = document.createElement("span");
      colorBox.className = "color-box";
      colorBox.style.backgroundColor = color;
      legend.appendChild(colorBox);
    });

    const legendLabelMore = document.createElement("span");
    legendLabelMore.className = "legend-label";
    legendLabelMore.textContent = "More";
    legend.appendChild(legendLabelMore);

    this.container.appendChild(legend);
  }

  // Set the data for the heatmap
  setData(entries) {
    // Process entries into a date-based map
    const dateMap = new Map();

    entries.forEach((entry) => {
      const date = entry.date; // Assuming date is in YYYY-MM-DD format
      if (dateMap.has(date)) {
        dateMap.set(date, dateMap.get(date) + 1);
      } else {
        dateMap.set(date, 1);
      }
    });

    // Convert to array of objects
    this.data = Array.from(dateMap, ([date, count]) => ({ date, count }));

    // Find the maximum count for color scaling
    this.maxCount = Math.max(4, ...dateMap.values()); // At least 4 for color range

    // Render the heatmap
    this.render();
  }

  // Render the heatmap
  render() {
    // Clear the heatmap
    this.heatmapEl.innerHTML = "";

    // Calculate the start date (weeksToShow weeks ago)
    const endDate = new Date(this.today);
    const startDate = new Date(this.today);
    startDate.setDate(startDate.getDate() - this.options.weeksToShow * 7);

    // Create a map of dates with counts
    const dateCountMap = new Map();
    this.data.forEach((item) => {
      dateCountMap.set(item.date, item.count);
    });

    // Create the month labels
    const monthLabels = document.createElement("div");
    monthLabels.className = "month-labels";

    // Add a placeholder for the day labels column
    const placeholder = document.createElement("span");
    placeholder.className = "month-label placeholder";
    monthLabels.appendChild(placeholder);

    // Generate month labels
    const months = [];
    let currentMonth = new Date(startDate);
    currentMonth.setDate(1); // Start at the 1st of the month

    while (currentMonth <= endDate) {
      const monthName = currentMonth.toLocaleString("default", {
        month: "short",
      });
      const monthYear = `${monthName} ${currentMonth.getFullYear()}`;

      if (!months.includes(monthYear)) {
        months.push(monthYear);

        const monthLabel = document.createElement("span");
        monthLabel.className = "month-label";
        monthLabel.textContent = monthName;
        monthLabels.appendChild(monthLabel);
      }

      // Move to next month
      currentMonth.setMonth(currentMonth.getMonth() + 1);
    }

    this.heatmapEl.appendChild(monthLabels);

    // Create the grid container
    const gridContainer = document.createElement("div");
    gridContainer.className = "heatmap-grid-container";

    // Create day labels (Sun-Sat or Mon-Sun)
    const dayLabels = document.createElement("div");
    dayLabels.className = "day-labels";

    const days = this.options.startOnMonday
      ? ["Mon", "", "Wed", "", "Fri", ""]
      : ["", "Mon", "", "Wed", "", "Fri", ""];

    days.forEach((day) => {
      const dayLabel = document.createElement("div");
      dayLabel.className = "day-label";
      dayLabel.textContent = day;
      dayLabels.appendChild(dayLabel);
    });

    gridContainer.appendChild(dayLabels);

    // Create the grid
    const grid = document.createElement("div");
    grid.className = "heatmap-grid";

    // Calculate the first day to display (align with week)
    let currentDate = new Date(startDate);
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const firstDayOfWeek = this.options.startOnMonday ? 1 : 0;

    // Adjust to start on the correct day of the week
    if (dayOfWeek !== firstDayOfWeek) {
      const daysToSubtract = (dayOfWeek - firstDayOfWeek + 7) % 7;
      currentDate.setDate(currentDate.getDate() - daysToSubtract);
    }

    // Generate cells for each day
    while (currentDate <= endDate) {
      const dateStr = this.formatDate(currentDate);
      const count = dateCountMap.get(dateStr) || 0;
      const colorIndex = this.getColorIndex(count);

      const cell = document.createElement("div");
      cell.className = "heatmap-cell";
      cell.style.width = `${this.options.cellSize}px`;
      cell.style.height = `${this.options.cellSize}px`;
      cell.style.margin = `${this.options.cellMargin}px`;
      cell.style.backgroundColor = this.options.colorRange[colorIndex];

      // Add data attributes for tooltip
      cell.dataset.date = dateStr;
      cell.dataset.count = count;

      // Add tooltip if enabled
      if (this.options.tooltipEnabled) {
        cell.title = `${dateStr}: ${count} ${
          count === 1 ? "entry" : "entries"
        }`;
      }

      grid.appendChild(cell);

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    gridContainer.appendChild(grid);
    this.heatmapEl.appendChild(gridContainer);
  }

  // Format date as YYYY-MM-DD
  formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // Get color index based on count (0-4)
  getColorIndex(count) {
    if (count === 0) return 0;

    // Calculate the index based on the count relative to maxCount
    const normalizedCount = count / this.maxCount;
    const index = Math.min(
      Math.floor(normalizedCount * (this.options.colorRange.length - 1)) + 1,
      this.options.colorRange.length - 1
    );

    return index;
  }

  // Update the heatmap with new data
  update(entries) {
    this.setData(entries);
  }
}

// Export the heatmap class
window.EntryHeatmap = EntryHeatmap;
