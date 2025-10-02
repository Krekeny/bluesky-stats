async function loadData() {
  try {
    const res = await fetch("data/stats.json");
    if (!res.ok) {
      throw new Error(`HTTP error! status: ${res.status}`);
    }
    const data = await res.json();

    const dailyData = Array.isArray(data) ? data : data.daily_data || [];

    return dailyData
      .filter((d) => d.total_users && d.total_users > 0)
      .map((d) => ({
        date: d.date,
        total_users: d.total_users,
      }))
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  } catch (error) {
    console.error("Error loading data:", error);
    return [];
  }
}

function calculateDailyDifferences(data) {
  return data.map((d, i) => {
    if (i === 0) return { date: d.date, difference: 0 };
    return {
      date: d.date,
      difference: d.total_users - data[i - 1].total_users,
    };
  });
}

function calculateMonthlyStats(data) {
  // Group data by month
  const monthlyData = {};

  data.forEach((d) => {
    const date = new Date(d.date);
    const monthKey = `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}`;

    if (!monthlyData[monthKey]) {
      monthlyData[monthKey] = {
        month: monthKey,
        startUsers: d.total_users,
        endUsers: d.total_users,
        dates: [],
      };
    }

    monthlyData[monthKey].endUsers = d.total_users;
    monthlyData[monthKey].dates.push(d.date);
  });

  // Convert to array and sort by month
  const monthlyArray = Object.values(monthlyData).sort((a, b) =>
    a.month.localeCompare(b.month)
  );

  // Calculate month-to-month growth
  return monthlyArray.map((month, index) => {
    const prevMonth = index > 0 ? monthlyArray[index - 1] : null;
    const growth = prevMonth ? month.endUsers - prevMonth.endUsers : 0;
    const growthPercentage = prevMonth
      ? (growth / prevMonth.endUsers) * 100
      : 0;

    return {
      ...month,
      growth,
      growthPercentage,
      monthLabel: new Date(month.month + "-01").toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      }),
    };
  });
}

function renderChart(ctx, labels, data, label, color, isDailyGrowth = false) {
  if (!ctx || !labels.length || !data.length) {
    console.error("Invalid data for chart rendering");
    return;
  }

  const chartOptions = {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label,
          data,
          fill: true,
          borderColor: color,
          backgroundColor: color + "33",
        },
      ],
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function (value) {
              return value.toLocaleString();
            },
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              return `${
                context.dataset.label
              }: ${context.raw.toLocaleString()}`;
            },
          },
        },
      },
    },
  };

  // Add zoom functionality for daily growth chart
  if (isDailyGrowth) {
    chartOptions.options.plugins.zoom = {
      zoom: {
        wheel: {
          enabled: true,
        },
        mode: "x",
      },
    };

    // Set initial zoom to show last 30 days
    const totalDays = labels.length;
    const defaultDays = Math.min(30, totalDays);
    const startIndex = Math.max(0, totalDays - defaultDays);

    chartOptions.options.scales.x.min = labels[startIndex];
    chartOptions.options.scales.x.max = labels[totalDays - 1];
  }

  return new Chart(ctx, chartOptions);
}

function renderMonthlyChart(ctx, monthlyData) {
  if (!ctx || !monthlyData.length) {
    console.error("Invalid data for monthly chart rendering");
    return;
  }

  const labels = monthlyData.map((m) => m.monthLabel);
  const endUsers = monthlyData.map((m) => m.endUsers);
  const growth = monthlyData.map((m) => m.growth);

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Total Users (End of Month)",
          data: endUsers,
          backgroundColor: "#6366f1",
        },
        {
          label: "Monthly Growth",
          data: growth,
          backgroundColor: "#10b981",
        },
      ],
    },
    options: {
      responsive: true,
      interaction: {
        mode: "index",
        intersect: false,
      },
      scales: {
        y: {
          type: "linear",
          display: true,
          position: "left",
          title: {
            display: true,
            text: "Users",
          },
          beginAtZero: true,
          ticks: {
            callback: function (value) {
              return value.toLocaleString();
            },
          },
        },
        x: {
          ticks: {
            maxRotation: 45,
            minRotation: 45,
          },
        },
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              if (context.datasetIndex === 0) {
                return `Total Users: ${context.raw.toLocaleString()}`;
              } else {
                const monthData = monthlyData[context.dataIndex];
                return [
                  `Monthly Growth: ${context.raw.toLocaleString()}`,
                  `Growth %: ${monthData.growthPercentage.toFixed(2)}%`,
                ];
              }
            },
          },
        },
      },
    },
  });
}

function renderMonthlyTable(monthlyData) {
  const tableContainer = document.getElementById("monthlyTable");
  if (!tableContainer || !monthlyData.length) return;

  const table = document.createElement("table");
  table.className = "w-full border-collapse border border-gray-300 mt-4";

  const thead = document.createElement("thead");
  thead.innerHTML = `
    <tr class="bg-gray-100">
      <th class="border border-gray-300 px-4 py-2 text-left">Month</th>
      <th class="border border-gray-300 px-4 py-2 text-right">End Users</th>
      <th class="border border-gray-300 px-4 py-2 text-right">Monthly Growth</th>
      <th class="border border-gray-300 px-4 py-2 text-right">Growth %</th>
    </tr>
  `;

  const tbody = document.createElement("tbody");
  monthlyData.forEach((month) => {
    const row = document.createElement("tr");
    row.className = "hover:bg-gray-50";
    row.innerHTML = `
      <td class="border border-gray-300 px-4 py-2">${month.monthLabel}</td>
      <td class="border border-gray-300 px-4 py-2 text-right">${month.endUsers.toLocaleString()}</td>
      <td class="border border-gray-300 px-4 py-2 text-right ${
        month.growth >= 0 ? "text-green-600" : "text-red-600"
      }">${month.growth >= 0 ? "+" : ""}${month.growth.toLocaleString()}</td>
      <td class="border border-gray-300 px-4 py-2 text-right ${
        month.growthPercentage >= 0 ? "text-green-600" : "text-red-600"
      }">${
      month.growthPercentage >= 0 ? "+" : ""
    }${month.growthPercentage.toFixed(2)}%</td>
    `;
    tbody.appendChild(row);
  });

  table.appendChild(thead);
  table.appendChild(tbody);
  tableContainer.appendChild(table);
}

function updateOverview(data) {
  if (!data || data.length === 0) return;

  const currentUsers = data[data.length - 1].total_users;
  const lastEntryDate = data[data.length - 1].date;
  const dataStartDate = data[0].date;

  // Format last update timestamp from the most recent data entry
  const lastUpdateDate = new Date(lastEntryDate);
  const year = lastUpdateDate.getFullYear();
  const month = lastUpdateDate.toLocaleString("en-US", { month: "short" });
  const day = lastUpdateDate.getDate();
  const hours = lastUpdateDate.getHours();
  const minutes = lastUpdateDate.getMinutes().toString().padStart(2, "0");
  const seconds = lastUpdateDate.getSeconds().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;

  const currentTimestamp = `${month} ${day}, ${year}, ${displayHours}:${minutes}:${seconds} ${ampm}`;

  // Format dates
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Update DOM elements
  const currentUsersElement = document.getElementById("currentUsers");
  const currentTimestampElement = document.getElementById("currentTimestamp");
  const dataStartDateElement = document.getElementById("dataStartDate");
  const lastEntryDateElement = document.getElementById("lastEntryDate");

  if (currentUsersElement)
    currentUsersElement.textContent = currentUsers.toLocaleString();
  if (currentTimestampElement)
    currentTimestampElement.textContent = currentTimestamp;
  if (dataStartDateElement)
    dataStartDateElement.textContent = formatDate(dataStartDate);
  if (lastEntryDateElement)
    lastEntryDateElement.textContent = formatDate(lastEntryDate);
}

// Global variable to store the daily growth chart instance
let dailyGrowthChart = null;
let allLabels = [];

function updateDailyGrowthTitle(chart) {
  if (!chart || !allLabels.length) return;

  const titleElement = document.getElementById("dailyGrowthTitle");
  if (!titleElement) return;

  const xScale = chart.scales.x;

  // Get the current visible range from the scale
  const minValue = xScale.min;
  const maxValue = xScale.max;

  let startDate, endDate;

  if (minValue !== undefined && maxValue !== undefined) {
    // Find the actual visible data points based on the scale bounds
    const visibleStartIndex = Math.max(0, Math.floor(minValue));
    const visibleEndIndex = Math.min(allLabels.length - 1, Math.ceil(maxValue));

    startDate = allLabels[visibleStartIndex];
    endDate = allLabels[visibleEndIndex];
  } else {
    // If no specific bounds, show the full range
    startDate = allLabels[0];
    endDate = allLabels[allLabels.length - 1];
  }

  // Format dates
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const startFormatted = formatDate(startDate);
  const endFormatted = formatDate(endDate);

  titleElement.textContent = `Daily User Growth (${startFormatted} - ${endFormatted})`;
}

function setupChartControls(chart, labels) {
  const zoomInBtn = document.getElementById("zoomIn");
  const zoomOutBtn = document.getElementById("zoomOut");
  const resetZoomBtn = document.getElementById("resetZoom");
  const showLast30DaysBtn = document.getElementById("showLast30Days");
  const showAllDataBtn = document.getElementById("showAllData");

  // Store labels globally for title updates
  allLabels = labels;

  // Add event listener for chart updates
  chart.options.onResize = function () {
    updateDailyGrowthTitle(chart);
  };

  // Listen for zoom/pan events
  chart.canvas.addEventListener("wheel", () => {
    setTimeout(() => updateDailyGrowthTitle(chart), 100);
  });

  chart.canvas.addEventListener("mousedown", () => {
    const handleMouseUp = () => {
      setTimeout(() => updateDailyGrowthTitle(chart), 100);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mouseup", handleMouseUp);
  });

  if (zoomInBtn) {
    zoomInBtn.addEventListener("click", () => {
      chart.zoom(1.1);
      setTimeout(() => updateDailyGrowthTitle(chart), 100);
    });
  }

  if (zoomOutBtn) {
    zoomOutBtn.addEventListener("click", () => {
      chart.zoom(0.9);
      setTimeout(() => updateDailyGrowthTitle(chart), 100);
    });
  }

  if (resetZoomBtn) {
    resetZoomBtn.addEventListener("click", () => {
      chart.resetZoom();
      setTimeout(() => updateDailyGrowthTitle(chart), 100);
    });
  }

  if (showLast30DaysBtn) {
    showLast30DaysBtn.addEventListener("click", () => {
      const totalDays = labels.length;
      const defaultDays = Math.min(30, totalDays);
      const startIndex = Math.max(0, totalDays - defaultDays);

      chart.options.scales.x.min = labels[startIndex];
      chart.options.scales.x.max = labels[totalDays - 1];
      chart.update();
      setTimeout(() => updateDailyGrowthTitle(chart), 100);
    });
  }

  if (showAllDataBtn) {
    showAllDataBtn.addEventListener("click", () => {
      chart.options.scales.x.min = undefined;
      chart.options.scales.x.max = undefined;
      chart.update();
      setTimeout(() => updateDailyGrowthTitle(chart), 100);
    });
  }

  // Initial title update
  setTimeout(() => updateDailyGrowthTitle(chart), 100);
}

loadData().then((data) => {
  if (data.length === 0) {
    console.error("No data available to display");
    return;
  }

  // Update overview section
  updateOverview(data);

  const labels = data.map((d) => d.date);
  const totals = data.map((d) => d.total_users);
  const dailyDifferences = calculateDailyDifferences(data);
  const monthlyData = calculateMonthlyStats(data);

  const totalUsersChartElement = document.getElementById("userChart");
  const dailyGrowthChartElement = document.getElementById("dailyGrowthChart");
  const monthlyChartElement = document.getElementById("monthlyChart");

  if (!totalUsersChartElement || !dailyGrowthChartElement) {
    console.error("Chart elements not found");
    return;
  }

  // Render total users chart
  renderChart(
    totalUsersChartElement.getContext("2d"),
    labels,
    totals,
    "Total Users",
    "#6366f1"
  );

  // Render daily growth chart with zoom functionality
  dailyGrowthChart = renderChart(
    dailyGrowthChartElement.getContext("2d"),
    labels,
    dailyDifferences.map((d) => d.difference),
    "Daily Growth",
    "#10b981",
    true // Enable zoom functionality
  );

  // Setup chart controls
  setupChartControls(dailyGrowthChart, labels);

  // Render monthly chart if element exists
  if (monthlyChartElement) {
    renderMonthlyChart(monthlyChartElement.getContext("2d"), monthlyData);
  }

  // Render monthly table
  renderMonthlyTable(monthlyData);
});
