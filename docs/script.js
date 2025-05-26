async function loadData() {
  const res = await fetch("data/stats.json");
  const data = await res.json();
  return data
    .filter((d) => d.total_users && d.total_users > 0)
    .map((d) => ({
      date: d.date,
      total_users: d.total_users,
    }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));
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
          beginAtZero: false,
        },
      },
    },
  });
}

loadData().then((data) => {
  const labels = data.map((d) => d.date);
  const totals = data.map((d) => d.total_users);

  renderChart(
    document.getElementById("userChart").getContext("2d"),
    labels,
    totals,
    "Total Users",
    "#6366f1"
  );
});
