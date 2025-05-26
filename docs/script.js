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

loadData().then((data) => {
  if (data.length === 0) {
    console.error("No data available to display");
    return;
  }

  const labels = data.map((d) => d.date);
  const totals = data.map((d) => d.total_users);

  const chartElement = document.getElementById("userChart");
  if (!chartElement) {
    console.error("Chart element not found");
    return;
  }

  renderChart(
    chartElement.getContext("2d"),
    labels,
    totals,
    "Total Users",
    "#6366f1"
  );
});
