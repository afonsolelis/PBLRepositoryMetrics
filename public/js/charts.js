async function fetchJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function loadCharts() {
  const q = typeof filterQuery !== 'undefined' ? filterQuery : '';

  const [cot, mrs, iss] = await Promise.all([
    fetchJSON(`/api/commits-over-time?${q}`),
    fetchJSON(`/api/mr-status?${q}`),
    fetchJSON(`/api/issue-status?${q}`),
  ]);

  if (document.getElementById('commitsOverTimeChart')) {
    new Chart(document.getElementById('commitsOverTimeChart'), {
      type: 'line',
      data: { labels: cot.labels, datasets: [{ ...cot.datasets[0], borderColor: '#4e79a7', fill: true, backgroundColor: 'rgba(78,121,167,0.15)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
    });
  }

  const doughnutOpts = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
  };

  if (document.getElementById('mrStatusChart')) {
    new Chart(document.getElementById('mrStatusChart'), {
      type: 'doughnut',
      data: { labels: mrs.labels, datasets: [{ ...mrs.datasets[0], backgroundColor: ['#59a14f','#4e79a7','#e15759'] }] },
      options: doughnutOpts,
    });
  }

  if (document.getElementById('issueStatusChart')) {
    new Chart(document.getElementById('issueStatusChart'), {
      type: 'doughnut',
      data: { labels: iss.labels, datasets: [{ ...iss.datasets[0], backgroundColor: ['#59a14f','#f28e2b'] }] },
      options: doughnutOpts,
    });
  }
}

document.addEventListener('DOMContentLoaded', loadCharts);
