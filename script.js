let chart;
let chartData = [];
let chartLabels = [];
let tracking = false;
let interval;
let startTime;
let endTime;
let videoId = "";
let targetViews = 0;
let spikeStartTime;
let spikeIntervalMinutes = 5;

// ✅ API Key Rotation
let apiKeys = [
  "AIzaSyBvVpO0WJB97BNO91RtqTIolLNmV66Qqt8",
  "AIzaSyBT5aGU-3R-jpP4HrGbvX4HBg0IB7IyvIQ",
  "AIzaSyBPbjeqqO6-JicHBUb0OWEubTujbXJtUV8",
  "AIzaSyDgFJ-2KbTEtO3aCIh6K_aw5pJarl_ht0Y",
  "AIzaSyDFplTm2sR5hRiHvKVkrVxPgERErZrxS7Y",
  "AIzaSyDPTmRWq7Cc1dD38o5f00oKQCKpMdxcMC4",
  "AIzaSyBFU7O82AVwmfYx_-hPgBrPCEDJS9L-0Mc"
];
let currentKeyIndex = 0;
let apiKey = apiKeys[currentKeyIndex];

function startTracking() {
  clearInterval(interval);
  tracking = true;
  videoId = document.getElementById("videoId").value;
  targetViews = parseInt(document.getElementById("targetViews").value);
  const targetTimeString = document.getElementById("targetTime").value;
  const firstSpikeTimeString = document.getElementById("firstSpikeTime").value;
  spikeIntervalMinutes = parseInt(document.getElementById("spikeInterval").value);

  if (!targetTimeString || !firstSpikeTimeString) {
    alert("Please select both target and first spike times.");
    return;
  }

  startTime = new Date();
  endTime = new Date(targetTimeString);
  spikeStartTime = new Date(firstSpikeTimeString);

  if (!chart) {
    initChart();
  }

  updateStats();
  interval = setInterval(updateStats, 1000);
}

function initChart() {
  const ctx = document.getElementById("viewChart").getContext("2d");
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: chartLabels,
      datasets: [{
        label: "Live Views",
        data: chartData,
        fill: false,
        borderColor: "blue",
        backgroundColor: "blue",
        tension: 0.3,
        pointRadius: 4
      }]
    },
    options: {
      scales: {
        y: { beginAtZero: false }
      }
    }
  });
}

// 🔄 API fetch with key rotation
function fetchWithKeyRotation(url, attempt = 0) {
  return fetch(url)
    .then(response => {
      if (!response.ok) throw new Error("API quota may be exceeded.");
      return response.json();
    })
    .catch(error => {
      if (attempt < apiKeys.length - 1) {
        currentKeyIndex = (currentKeyIndex + 1) % apiKeys.length;
        apiKey = apiKeys[currentKeyIndex];
        console.warn(`⚠️ Switching to API Key ${currentKeyIndex + 1}`);
        const newUrl = url.replace(/key=[^&]+/, `key=${apiKey}`);
        return fetchWithKeyRotation(newUrl, attempt + 1);
      } else {
        console.error("❌ All API keys exhausted.");
        throw error;
      }
    });
}

function updateStats() {
  const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${videoId}&key=${apiKey}`;
  fetchWithKeyRotation(url).then(data => {
    const viewCount = parseInt(data.items[0].statistics.viewCount);
    const currentTime = new Date();

    const timeLeftMinutes = Math.max(0, Math.floor((endTime - currentTime) / 60000));

    chartLabels.push(currentTime.toLocaleTimeString());
    chartData.push(viewCount);
    chart.update();

    const stats = {
      5: getViewsDiffByPoints(300),
      10: getViewsDiffByPoints(600),
      15: getViewsDiffByPoints(900),
      20: getViewsDiffByPoints(1200),
      25: getViewsDiffByPoints(1500),
      30: getViewsDiffByPoints(1800),
    };

    for (const [min, views] of Object.entries(stats)) {
      const rate = views / (min / 5);
      document.getElementById(`last${min}Min`).innerText = views.toLocaleString();
      document.getElementById(`rate${min}Min`).innerText = `${views.toLocaleString()} / ${min / 5} = ${rate.toFixed(1)}`;
    }

    const last15 = stats[15];
    const avg15 = last15 / 15;

    const viewsLeft = Math.max(0, targetViews - viewCount);
    const requiredRate = timeLeftMinutes > 0 ? viewsLeft / timeLeftMinutes : 0;
    const requiredNext5 = requiredRate * 5;
    const projectedViews = Math.floor(viewCount + ((stats[5] / 5) * timeLeftMinutes));
    const forecast = projectedViews >= targetViews ? "Yes" : "No";

    document.getElementById("liveViews").innerText = viewCount.toLocaleString();
    document.getElementById("avg15Min").innerText = avg15.toFixed(2);
    document.getElementById("requiredRate").innerText = requiredRate.toFixed(2);
    document.getElementById("requiredNext5").innerText = Math.round(requiredNext5).toLocaleString();
    document.getElementById("projectedViews").innerText = projectedViews.toLocaleString();
    document.getElementById("forecast").innerText = forecast;

    const timeLeftString = `${timeLeftMinutes}:${(60 - currentTime.getSeconds()).toString().padStart(2, "0")}`;
    document.getElementById("timeLeft").innerText = timeLeftString;

    const viewsLeftEl = document.getElementById("viewsLeft");
    viewsLeftEl.innerText = viewsLeft.toLocaleString();
    viewsLeftEl.classList.remove("green", "red", "neutral");
    viewsLeftEl.classList.add(forecast === "Yes" ? "green" : "red");

    updateSpikeList(currentTime, viewCount, viewsLeft);

    // 🟢 RISK METER LOGIC
    const riskDiff = avg15 - requiredRate;
    const riskPercent = Math.abs(riskDiff / requiredRate) * 100;

    const riskLevelEl = document.getElementById("riskLevel");
    const riskLabelEl = document.getElementById("riskLabel");

    let riskText = "";
    let riskColor = "green";

    if (riskPercent <= 10) {
      riskText = "Very Risky";
      riskColor = "red";
    } else if (riskPercent <= 20) {
      riskText = "Risky";
      riskColor = "red";
    } else if (riskPercent <= 30) {
      riskText = "Mild Risky";
      riskColor = "yellow";
    } else if (riskPercent <= 40) {
      riskText = "Moderate";
      riskColor = "yellow";
    } else if (riskPercent <= 70) {
      riskText = "Safe";
      riskColor = "green";
    } else if (riskPercent <= 100) {
      riskText = "Very Safe";
      riskColor = "green";
    } else {
      riskText = "Super Safe";
      riskColor = "green";
    }

    riskLevelEl.style.backgroundColor = riskColor;
    riskLabelEl.innerText = `${riskText} (${riskPercent.toFixed(1)}%)`;

  }).catch(error => {
    console.error("Error fetching YouTube data:", error);
  });
}

function getViewsDiffByPoints(nPoints) {
  return chartData.length > nPoints
    ? chartData[chartData.length - 1] - chartData[chartData.length - 1 - nPoints]
    : 0;
}

function updateSpikeList(currentTime, currentViews, viewsLeft) {
  const spikeList = document.getElementById("spikeList");
  spikeList.innerHTML = "";

  let spikeTime = new Date(spikeStartTime);
  const spikes = [];

  while (spikeTime <= endTime) {
    if (spikeTime >= currentTime) {
      spikes.push(new Date(spikeTime));
    }
    spikeTime.setMinutes(spikeTime.getMinutes() + spikeIntervalMinutes);
  }

  const viewsPerSpike = spikes.length > 0 ? Math.ceil(viewsLeft / spikes.length) : 0;

  spikes.forEach(spike => {
    const li = document.createElement("li");
    li.textContent = `${spike.toLocaleTimeString()} - ${viewsPerSpike.toLocaleString()} views required`;
    spikeList.appendChild(li);
  });
}
