/* ═══════════════════════════════════════════════════════════
   Bluesky Statistics — script.js
   Preserves all existing data-fetching & loading logic.
   Only presentation, layout, chart rendering, and derived
   calculations are changed.
═══════════════════════════════════════════════════════════ */

/* ─── Design tokens (mirrors styles.css, used for Chart.js) ─── */
const T = {
  border:      '#e5e5e7',
  borderLight: '#efefef',
  textPrimary: '#1a1a1a',
  textSecondary: '#7a7a7e',
  textMuted:   '#a3a3a8',
  accent:      '#b4a7f5',
  accentLight: '#d8d0fb',
  accentBlue:  '#a8d4f5',
  green:       '#5cb585',
  greenBg:     '#e2f5ec',
  bg:          '#f5f5f6',
  card:        '#ffffff',
  mono:        "'DM Mono', monospace",
};

/* ─── Number formatters ─── */
const fmtFull = (n) => new Intl.NumberFormat('en-US').format(Math.round(n));

function fmtAbbr(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(Math.round(n));
}

/* ─── Date formatter for axis labels ─── */
function fmtAxisDate(dateStr, days) {
  const d = new Date(dateStr);
  // days=0 means "All" — treat like a long range
  if (days > 0 && days <= 90) {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

/* ══════════════════════════════════════════════════════════
   DATA LOADING — unchanged from original implementation
══════════════════════════════════════════════════════════ */
async function loadData() {
  try {
    const res = await fetch('data/stats.json');
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
    console.error('Error loading data:', error);
    return [];
  }
}

/* ══════════════════════════════════════════════════════════
   DERIVED CALCULATIONS
   Only total_users per day exists; everything else derived.
══════════════════════════════════════════════════════════ */

/**
 * Adds a `daily` field = total_users[i] - total_users[i-1].
 * First entry gets daily = 0.
 */
function enrichWithDaily(data) {
  const filled = [];
  for (let i = 0; i < data.length; i++) {
    const d = data[i];
    if (i > 0) {
      const prev = data[i - 1];
      let nextDate = new Date(prev.date + 'T00:00:00Z');
      nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      const currDate = new Date(d.date + 'T00:00:00Z');
      
      while (nextDate < currDate) {
        filled.push({
          date: nextDate.toISOString().split('T')[0],
          total_users: prev.total_users,
          isFilled: true
        });
        nextDate.setUTCDate(nextDate.getUTCDate() + 1);
      }
    }
    filled.push(d);
  }

  const enriched = [];
  for (let i = 0; i < filled.length; i++) {
    const d = filled[i];
    const prev = i > 0 ? filled[i - 1] : null;
    const rawDaily = prev ? d.total_users - prev.total_users : 0;
    enriched.push({ ...d, daily: rawDaily, rangeLabel: null, isEstimate: false });
  }

  // Normalize: Find gaps and spread growth
  for (let i = 0; i < enriched.length; i++) {
    if (enriched[i].daily > 0) {
      let j = i - 1;
      // Look back for a period of stagnant/missing data
      while (j >= 0 && (enriched[j].isFilled || (j > 0 && enriched[j].total_users === enriched[j-1].total_users))) {
        j--;
      }
      
      const gapLength = i - (j + 1);
      if (gapLength > 0) {
        // We have a gap of 'gapLength' days plus the current day 'i'
        const totalGrowth = enriched[i].daily;
        const avgGrowth = totalGrowth / (gapLength + 1);
        const dStart = new Date(enriched[j + 1].date);
        const dEnd   = new Date(enriched[i].date);
        const range = `${dStart.toLocaleDateString('en-US', {month:'short', day:'numeric'})} – ${dEnd.toLocaleDateString('en-US', {month:'short', day:'numeric'})}`;
        
        for (let k = j + 1; k <= i; k++) {
          enriched[k].daily = avgGrowth;
          enriched[k].isEstimate = true;
          enriched[k].rangeLabel = range;
        }
      }
    }
  }

  return enriched;
}

/**
 * Groups enriched daily data into monthly buckets.
 * Returns array sorted ascending.
 */
function buildMonthly(enriched) {
  const map = {};
  enriched.forEach((d) => {
    const key = d.date.slice(0, 7); // "YYYY-MM"
    if (!map[key]) {
      map[key] = {
        month: key,
        growth: 0,
        days: 0,
        startUsers: d.total_users - d.daily,
        endUsers: 0,
      };
    }
    map[key].growth += d.daily;
    map[key].endUsers = d.total_users;
    map[key].days++;
  });

  return Object.values(map)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((m) => {
      const pct = m.startUsers > 0 ? (m.growth / m.startUsers) * 100 : 0;
      const avgDaily = m.days > 0 ? m.growth / m.days : 0;
      const d = new Date(m.month + '-02'); // avoid timezone edge
      return {
        ...m,
        pct,
        avgDaily,
        label: d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        shortLabel: d.toLocaleDateString('en-US', { month: 'short' }),
        shortLabelWithYear: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      };
    });
}

/* ══════════════════════════════════════════════════════════
   CHART TOOLTIP PLUGIN (shared)
══════════════════════════════════════════════════════════ */
const tooltipPlugin = {
  enabled: true,
  backgroundColor: '#fff',
  borderColor: T.border,
  borderWidth: 1,
  cornerRadius: 12,
  padding: { top: 10, right: 14, bottom: 10, left: 14 },
  titleFont: { family: T.mono, size: 10 },
  titleColor: T.textMuted,
  bodyFont: { family: T.mono, size: 12 },
  bodyColor: T.textPrimary,
  callbacks: {
    label(ctx) {
      return ' ' + fmtFull(ctx.parsed.y);
    },
  },
  boxShadow: '0 4px 20px rgba(0,0,0,0.06)',
};

/* ══════════════════════════════════════════════════════════
   CHART HELPERS
══════════════════════════════════════════════════════════ */

/** Shared grid + axis config */
function baseScales(yFormatter) {
  return {
    x: {
      grid: { display: false },
      border: { display: false },
      ticks: {
        font: { family: T.mono, size: 10 },
        color: T.textMuted,
        maxTicksLimit: 8,
        maxRotation: 0,
      },
    },
    y: {
      grid: {
        color: T.borderLight,
        lineWidth: 1,
        borderDash: [4, 4],  // dashed horizontal grid lines (Chart.js 4)
      },
      border: { display: false },
      ticks: {
        font: { family: T.mono, size: 10 },
        color: T.textMuted,
        maxTicksLimit: 6,
        callback: yFormatter || fmtAbbr,
      },
    },
  };
}

/* ══════════════════════════════════════════════════════════
   CHART INSTANCES (module-level so we can destroy/recreate)
══════════════════════════════════════════════════════════ */
let dailyChartInstance = null;

/* ══════════════════════════════════════════════════════════
   RENDER: KPI CARDS
══════════════════════════════════════════════════════════ */
function renderKPIs(enriched) {
  const n = enriched.length;
  if (n === 0) return;

  const latest = enriched[n - 1];
  const prev1  = n >= 2 ? enriched[n - 2] : null;
  const prev7  = n >= 8 ? enriched[n - 8] : null;
  const prev30 = n >= 31 ? enriched[n - 31] : null;

  /* ── Card 1: Total users ── */
  const el = (id) => document.getElementById(id);

  el('kpiTotalUsers').textContent = fmtFull(latest.total_users);

  // Sparkline — last 14 days of daily growth
  const last14 = enriched.slice(-14);
  const maxDaily = Math.max(...last14.map((d) => d.daily), 1);
  const sparkEl = el('sparkline');
  sparkEl.innerHTML = '';
  last14.forEach((d, i) => {
    const bar = document.createElement('div');
    bar.className = 'spark-bar';
    const pct = Math.max(4, (d.daily / maxDaily) * 100);
    bar.style.height = pct + '%';
    bar.style.background = i === last14.length - 1 ? T.accent : T.accentLight;
    sparkEl.appendChild(bar);
  });

  /* ── Card 2: 30d growth ── */
  if (prev30) {
    const abs30 = latest.total_users - prev30.total_users;
    const pct30 = ((abs30 / prev30.total_users) * 100).toFixed(1);
    el('kpi30dPct').textContent = pct30 + '%';
    el('kpi30dAbs').textContent = '↑ ' + fmtAbbr(abs30);
  } else {
    el('kpi30dPct').textContent = '—';
  }

  /* ── Card 3: Avg daily 7d ── */
  if (prev7) {
    const avg7 = Math.round((latest.total_users - prev7.total_users) / 7);
    el('kpiAvg7d').textContent = fmtFull(avg7);
    el('kpiAvg7dSub').textContent = fmtAbbr(avg7) + ' / day';
  } else {
    el('kpiAvg7d').textContent = '—';
  }

  /* ── Card 4: New today ── */
  el('kpiNewToday').textContent = fmtFull(latest.daily);
  if (prev1) {
    const diff = latest.daily - prev1.daily;
    const arrow = diff >= 0 ? '↑' : '↓';
    const sub = el('kpiNewTodaySub');
    sub.textContent = arrow + ' ' + fmtFull(Math.abs(diff)) + ' vs yesterday';
    sub.style.color = diff >= 0 ? T.green : '#e07070';
  }
}

/* ══════════════════════════════════════════════════════════
   RENDER: DAILY CHART  (with range selector)
══════════════════════════════════════════════════════════ */
function renderDailyChart(enriched, days) {
  const slice = days === 0 ? enriched : enriched.slice(-days);

  // Improved sampling: preserve peaks within buckets to ensure outliers (spikes) are visible
  const MAX_BARS = 300;
  let sampled;
  if (slice.length <= MAX_BARS) {
    sampled = slice;
  } else {
    const step = slice.length / MAX_BARS;
    sampled = [];
    for (let i = 0; i < MAX_BARS; i++) {
      const bucket = slice.slice(Math.floor(i * step), Math.floor((i + 1) * step));
      if (bucket.length > 0) {
        // Find the entry with the highest 'daily' value in this bucket
        const peak = bucket.reduce((m, d) => (d.daily > m.daily ? d : m), bucket[0]);
        sampled.push(peak);
      }
    }
  }

  const labels = sampled.map((d) => d.date);
  const values = sampled.map((d) => d.daily);

  const ctx = document.getElementById('dailyChart');
  if (!ctx) return;

  if (dailyChartInstance) {
    dailyChartInstance.destroy();
    dailyChartInstance = null;
  }

  // Lavender gradient fill
  const cctx = ctx.getContext('2d');
  const grad = cctx.createLinearGradient(0, 0, 0, 280);
  grad.addColorStop(0, T.accent + 'e6');    // 90% opacity top
  grad.addColorStop(1, T.accent + '59');    // 35% opacity bottom

  dailyChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'New Users',
        data: values,
        backgroundColor: sampled.map(d => d.isEstimate ? T.accentLight : T.accent),
        borderRadius: 4,
        borderSkipped: false,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 300 },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipPlugin,
          callbacks: {
            title(items) {
              const d = sampled[items[0].dataIndex];
              return d.rangeLabel || items[0].label;
            },
            label(ctx) {
              const d = sampled[ctx.dataIndex];
              const val = fmtFull(ctx.parsed.y);
              return d.isEstimate 
                ? ` ~${val} new users (Avg. during outage)` 
                : ` ${val} new users`;
            },
          },
        },
      },
      scales: {
        ...baseScales(),
        x: {
          ...baseScales().x,
          ticks: {
            ...baseScales().x.ticks,
            callback(val, i) {
              // Show fewer labels for dense ranges
              const interval = Math.max(1, Math.floor(sampled.length / 7));
              return i % interval === 0 ? fmtAxisDate(labels[i], days) : '';
            },
          },
        },
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   RENDER: MONTHLY GROWTH BAR CHART
══════════════════════════════════════════════════════════ */
function renderMonthlyGrowthChart(monthly) {
  const ctx = document.getElementById('monthlyGrowthChart');
  if (!ctx) return;

  const slice = monthly.slice(-18);

  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: slice.map((m) => m.shortLabel),
      datasets: [{
        label: 'New Users',
        data: slice.map((m) => m.growth),
        backgroundColor: T.accentBlue,
        borderRadius: { topLeft: 3, topRight: 3, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: 'bottom',
        barPercentage: 0.75,
        categoryPercentage: 1.0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipPlugin,
          callbacks: {
            title(items) { return slice[items[0]?.dataIndex]?.label || ''; },
            label(ctx) { return ' ' + fmtFull(ctx.parsed.y) + ' new users'; },
          },
        },
      },
      scales: baseScales(),
    },
  });
}

/* ══════════════════════════════════════════════════════════
   RENDER: GROWTH RATE LINE CHART
══════════════════════════════════════════════════════════ */
function renderGrowthRateChart(monthly) {
  const ctx = document.getElementById('growthRateChart');
  if (!ctx) return;

  const slice = monthly.slice(-18);

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: slice.map((m) => m.shortLabel),
      datasets: [{
        label: 'Growth %',
        data: slice.map((m) => parseFloat(m.pct.toFixed(2))),
        borderColor: T.textPrimary,
        borderWidth: 1.5,
        fill: false,
        tension: 0.25,
        pointRadius: 2.5,
        pointBackgroundColor: T.card,
        pointBorderColor: T.textPrimary,
        pointBorderWidth: 1.5,
        pointHoverRadius: 4.5,
        pointHoverBackgroundColor: T.card,
        pointHoverBorderColor: T.textPrimary,
        pointHoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tooltipPlugin,
          callbacks: {
            title(items) { return slice[items[0]?.dataIndex]?.label || ''; },
            label(ctx) { return ' ' + ctx.parsed.y.toFixed(2) + '%'; },
          },
        },
      },
      scales: {
        ...baseScales((v) => v.toFixed(1) + '%'),
      },
    },
  });
}

/* ══════════════════════════════════════════════════════════
   RENDER: KEY MILESTONES
══════════════════════════════════════════════════════════ */
function renderMilestones(enriched) {
  const MILESTONES = [
    { month: '2024-02', name: 'Public Launch' },
    { month: '2024-09', name: 'Brazil X Ban' },
    { month: '2024-11', name: 'US Election Exodus' },
    { month: '2025-01', name: 'Federation Opens' },
  ];

  const grid = document.getElementById('milestonesGrid');
  const section = document.getElementById('milestonesSection');
  if (!grid || !section) return;

  const dataStart = enriched[0].date;
  const dataEnd   = enriched[enriched.length - 1].date;

  const found = [];
  MILESTONES.forEach((ms) => {
    // Only show milestones whose month falls within the loaded dataset range
    const msStart = ms.month + '-01';
    const msEnd   = ms.month + '-31';
    if (msEnd < dataStart || msStart > dataEnd) return; // outside dataset — skip

    const match = enriched.find((d) => d.date.startsWith(ms.month));
    if (match) found.push({ ...ms, data: match });
  });

  if (found.length === 0) {
    section.style.display = 'none';
    return;
  }

  grid.innerHTML = found.map((ms, i) => `
    <div class="milestone-col">
      <div class="milestone-date mono">
        ${new Date(ms.data.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
      </div>
      <div class="milestone-name">${ms.name}</div>
      <div class="milestone-total">${fmtAbbr(ms.data.total_users)}</div>
    </div>
  `).join('');
}

/* ══════════════════════════════════════════════════════════
   RENDER: MONTHLY TABLE WITH PAGINATION
══════════════════════════════════════════════════════════ */
const PER_PAGE = 12;
let currentPage = 0;
let tableData = [];

function renderTablePage() {
  const tbody = document.getElementById('monthlyTableBody');
  if (!tbody) return;

  const desc = [...tableData].reverse();
  const pages = Math.ceil(desc.length / PER_PAGE);
  const visible = desc.slice(currentPage * PER_PAGE, (currentPage + 1) * PER_PAGE);

  tbody.innerHTML = visible.map((m) => {
    const pillClass = m.pct > 5 ? 'growth-pill growth-pill--high' : 'growth-pill growth-pill--low';
    return `
      <tr>
        <td>${m.label}</td>
        <td>${fmtFull(m.endUsers)}</td>
        <td class="td-green">+${fmtFull(m.growth)}</td>
        <td>${fmtFull(Math.round(m.avgDaily))}</td>
        <td><span class="${pillClass}">${m.pct.toFixed(2)}%</span></td>
      </tr>`;
  }).join('');

  // Pagination controls
  const paginationEl = document.getElementById('pagination');
  if (!paginationEl) return;

  if (pages <= 1) {
    paginationEl.style.display = 'none';
    return;
  }
  paginationEl.style.display = 'flex';
  paginationEl.innerHTML = `
    <button class="page-btn" id="prevPage" ${currentPage === 0 ? 'disabled' : ''}>← Prev</button>
    <span class="page-info">${currentPage + 1} / ${pages}</span>
    <button class="page-btn" id="nextPage" ${currentPage >= pages - 1 ? 'disabled' : ''}>Next →</button>
  `;

  document.getElementById('prevPage')?.addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; renderTablePage(); }
  });
  document.getElementById('nextPage')?.addEventListener('click', () => {
    if (currentPage < pages - 1) { currentPage++; renderTablePage(); }
  });
}

/* ══════════════════════════════════════════════════════════
   RANGE SELECTOR
══════════════════════════════════════════════════════════ */
function setupRangeSelector(enriched) {
  const buttons = document.querySelectorAll('.range-btn');
  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      buttons.forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const days = parseInt(btn.dataset.days, 10);
      renderDailyChart(enriched, days);
    });
  });
}

/* ══════════════════════════════════════════════════════════
   HEADER DATE + FOOTER YEAR
══════════════════════════════════════════════════════════ */
function renderMeta(enriched) {
  const latest = enriched[enriched.length - 1];
  if (!latest) return;

  const headerDate = document.getElementById('headerDate');
  if (headerDate) {
    headerDate.textContent = 'Updated ' + new Date(latest.date).toLocaleDateString('en-US', {
      month: 'long', day: 'numeric', year: 'numeric',
    });
  }

  const footerYear = document.getElementById('footerYear');
  if (footerYear) {
    footerYear.textContent = new Date(latest.date).getFullYear();
  }
}

/* ══════════════════════════════════════════════════════════
   MAIN — data fetch, then render everything
══════════════════════════════════════════════════════════ */
loadData().then((data) => {
  if (data.length === 0) {
    console.error('No data available to display');
    return;
  }

  // Enrich raw data with computed daily growth
  const enriched = enrichWithDaily(data);

  // Build monthly aggregates
  const monthly = buildMonthly(enriched);

  // Store for table pagination
  tableData = monthly;

  // Render everything
  renderMeta(enriched);
  renderKPIs(enriched);
  renderDailyChart(enriched, 90);       // default: 90d
  setupRangeSelector(enriched);
  renderMonthlyGrowthChart(monthly);
  renderGrowthRateChart(monthly);
  renderMilestones(enriched);
  renderTablePage();
});
