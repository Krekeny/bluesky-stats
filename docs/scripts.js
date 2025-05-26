async function loadData() {
  const res = await fetch("data/stats.json");
  const data = await res.json();
  return data.daily_data.map((d) => ({
    date: d.date,
    new_users: d.num_posters,
  }));
}

function groupByMonth(data) {
  const result = {};
  data.forEach(({ date, new_users }) => {
    const month = date.slice(0, 7);
    result[month] = (result[month] || 0) + new_users;
  });
  return Object.entries(result);
}

function renderChart(ctx, labels, data, label, color) {
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
          beginAtZero: true,
        },
      },
    },
  });
}

loadData().then((data) => {
  const dailyLabels = data.map((d) => d.date);
  const dailyNewUsers = data.map((d) => d.new_users);
  renderChart(
    document.getElementById("dailyChart").getContext("2d"),
    dailyLabels,
    dailyNewUsers,
    "Tägliche aktive Poster",
    "#3b82f6"
  );

  const monthly = groupByMonth(data);
  const monthlyLabels = monthly.map(([m]) => m);
  const monthlyCounts = monthly.map(([_, v]) => v);
  renderChart(
    document.getElementById("monthlyChart").getContext("2d"),
    monthlyLabels,
    monthlyCounts,
    "Monatlicher Zuwachs aktiver Poster",
    "#10b981"
  );
});
