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

function renderChart(ctx, labels, data, label, color) {
  if (!ctx || !labels.length || !data.length) {
    console.error("Invalid data for chart rendering");
    return;
  }

  new Chart(ctx, {
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
  });
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

  // Render daily growth chart
  renderChart(
    dailyGrowthChartElement.getContext("2d"),
    labels,
    dailyDifferences.map((d) => d.difference),
    "Daily Growth",
    "#10b981"
  );

  // Render monthly chart if element exists
  if (monthlyChartElement) {
    renderMonthlyChart(monthlyChartElement.getContext("2d"), monthlyData);
  }

  // Render monthly table
  renderMonthlyTable(monthlyData);
});
