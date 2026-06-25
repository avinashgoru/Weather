const API_KEY = '7dd545e8cdf025e84696ddbf6bdc1266';

const cityInput = document.getElementById('city-input');
const searchBtn = document.getElementById('search-btn');
const suggestionsList = document.getElementById('search-suggestions');
const errorMessage = document.getElementById('error-message');
const dashboard = document.getElementById('dashboard');
const themeToggleBtn = document.getElementById('theme-toggle');

const todayContent = document.getElementById('today-content');
const todaySkeleton = document.getElementById('today-skeleton');
const chartContainer = document.getElementById('chart-container');
const forecastDaysContainer = document.getElementById('forecast-days-container');
const forecastSkeleton = document.getElementById('forecast-skeleton');

const currentCityName = document.getElementById('current-city-name');
const forecastCityName = document.getElementById('forecast-city-name');
const temperatureEl = document.getElementById('temperature');
const weatherDescriptionEl = document.getElementById('weather-description');
const mainWeatherIcon = document.getElementById('main-weather-icon');
const liveTimeEl = document.getElementById('live-time');
const liveDateEl = document.getElementById('live-date');

const humidityEl = document.getElementById('humidity');
const windSpeedEl = document.getElementById('wind-speed');
const uvIndexEl = document.getElementById('uv-index');
const extraMetricsEl = document.getElementById('extra-metrics');

const btnDaily = document.getElementById('btn-daily');
const btnHourly = document.getElementById('btn-hourly');

let forecastChartInstance = null;
let isLightMode = false;
let weatherDataCache = null;
let currentChartView = 'daily';
let searchTimeout = null;
let selectedDayIndex = 0;

function init() {
    showSkeletons();
    updateClock();
    setInterval(updateClock, 1000);

    const savedTheme = localStorage.getItem('weatherTheme');
    if (savedTheme === 'light') {
        toggleTheme(true);
    } else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches && !savedTheme) {
        toggleTheme(true);
    }

    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            fetchWeatherDataByCoords(lat, lon, "Current Location");
        }, error => {
            fetchWeatherDataByCity("Toronto");
        });
    } else {
        fetchWeatherDataByCity("Toronto");
    }
}

// Autocomplete logic
cityInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const query = e.target.value.trim();
    if (!query) {
        suggestionsList.classList.add('hidden');
        return;
    }
    
    searchTimeout = setTimeout(async () => {
        try {
            const url = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(query)}&limit=5&appid=${API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            
            suggestionsList.innerHTML = '';
            if (data && data.length > 0) {
                data.forEach(city => {
                    const li = document.createElement('li');
                    li.className = 'suggestion-item';
                    const stateInfo = city.state ? `${city.state}, ` : '';
                    const countryInfo = `${stateInfo}${city.country}`;
                    li.innerHTML = `<i class="ph-fill ph-map-pin"></i> <span>${city.name}, <small style="color:var(--text-muted)">${countryInfo}</small></span>`;
                    li.addEventListener('click', () => {
                        cityInput.value = '';
                        suggestionsList.classList.add('hidden');
                        fetchWeatherDataByCoords(city.lat, city.lon, city.name);
                    });
                    suggestionsList.appendChild(li);
                });
                suggestionsList.classList.remove('hidden');
            } else {
                suggestionsList.classList.add('hidden');
            }
        } catch (e) {
            suggestionsList.classList.add('hidden');
        }
    }, 300);
});

// Hide suggestions when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-container')) {
        suggestionsList.classList.add('hidden');
    }
});

searchBtn.addEventListener('click', () => {
    suggestionsList.classList.add('hidden');
    fetchWeatherDataByCity();
});

cityInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        suggestionsList.classList.add('hidden');
        fetchWeatherDataByCity();
    }
});
themeToggleBtn.addEventListener('click', () => toggleTheme());

// Toggle Logic
btnDaily.addEventListener('click', () => {
    if(currentChartView === 'daily') return;
    currentChartView = 'daily';
    btnDaily.classList.add('active');
    btnHourly.classList.remove('active');
    if(weatherDataCache) updateChartData();
});

btnHourly.addEventListener('click', () => {
    if(currentChartView === 'hourly') return;
    currentChartView = 'hourly';
    btnHourly.classList.add('active');
    btnDaily.classList.remove('active');
    if(weatherDataCache) updateChartData();
});

window.addEventListener('DOMContentLoaded', init);

function toggleTheme(forceLight) {
    isLightMode = forceLight !== undefined ? forceLight : !isLightMode;
    const themeLabel = themeToggleBtn.querySelector('.theme-label');
    const themeIcon = themeToggleBtn.querySelector('.theme-icon');

    if (isLightMode) {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
        themeLabel.textContent = 'Dark';
        themeIcon.className = 'ph-fill ph-toggle-right theme-icon';
        localStorage.setItem('weatherTheme', 'light');
    } else {
        document.body.classList.add('dark-theme');
        document.body.classList.remove('light-theme');
        themeLabel.textContent = 'Light';
        themeIcon.className = 'ph-fill ph-toggle-left theme-icon';
        localStorage.setItem('weatherTheme', 'dark');
    }
    
    if (forecastChartInstance) {
        updateChartTheme();
    }
}

function updateChartTheme() {
    if(!forecastChartInstance) return;
    const ctx = document.getElementById('forecastChart').getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    
    if (isLightMode) {
        gradient.addColorStop(0, 'rgba(43, 53, 80, 0.3)');
        gradient.addColorStop(1, 'rgba(43, 53, 80, 0.0)');
        forecastChartInstance.data.datasets[0].borderColor = '#2B3550';
        forecastChartInstance.data.datasets[0].pointBorderColor = '#2B3550';
    } else {
        gradient.addColorStop(0, 'rgba(140, 153, 184, 0.5)');
        gradient.addColorStop(1, 'rgba(140, 153, 184, 0.0)');
        forecastChartInstance.data.datasets[0].borderColor = '#8C99B8';
        forecastChartInstance.data.datasets[0].pointBorderColor = '#8C99B8';
    }
    forecastChartInstance.data.datasets[0].backgroundColor = gradient;
    forecastChartInstance.update();
}

function updateClock() {
    if (selectedDayIndex !== 0) return;
    const now = new Date();
    liveTimeEl.textContent = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    liveDateEl.textContent = now.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
}

async function fetchWeatherDataByCity(defaultCity) {
    const city = cityInput.value.trim() || defaultCity;
    if (!city) return;
    
    showSkeletons();

    try {
        const geoUrl = `https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${API_KEY}`;
        const geoRes = await fetch(geoUrl);
        const geoData = await geoRes.json();
        
        if (!geoData || geoData.length === 0) {
            throw new Error('City not found');
        }
        
        const location = geoData[0];
        await fetchWeatherDataByCoords(location.lat, location.lon, location.name);
        cityInput.value = '';
    } catch (err) {
        hideSkeletons();
        errorMessage.textContent = 'Location not found. Please try again.';
        errorMessage.classList.remove('hidden');
    }
}

async function fetchWeatherDataByCoords(lat, lon, cityName) {
    showSkeletons();
    
    let displayCityName = cityName;
    if (cityName === "Current Location") {
        try {
            const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`;
            const revRes = await fetch(revUrl);
            const revData = await revRes.json();
            displayCityName = revData.city || revData.locality || "Current Location";
        } catch (e) {
            console.warn('Reverse geocoding failed');
        }
    }

    try {
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,relative_humidity_2m&daily=weathercode,temperature_2m_max,temperature_2m_min,uv_index_max,windspeed_10m_max&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        if (!weatherRes.ok) throw new Error('Failed to fetch weather');
        const weatherData = await weatherRes.json();

        weatherDataCache = weatherData; // Cache for toggling
        updateUI(weatherData, displayCityName);
    } catch (err) {
        hideSkeletons();
        errorMessage.textContent = 'Failed to fetch weather data. Please try again.';
        errorMessage.classList.remove('hidden');
    }
}

function updateUI(weatherData, cityName) {
    hideSkeletons();
    errorMessage.classList.add('hidden');
    
    currentCityName.textContent = cityName;
    forecastCityName.textContent = cityName;
    selectedDayIndex = 0;

    updateMainCard(0);

    // Bottom Grid
    const daily = weatherData.daily;
    forecastDaysContainer.innerHTML = '';
    const weatherProp = 'weather' + 'code';
    
    for (let i = 0; i < 7; i++) {
        const dateStr = daily.time[i];
        const [year, month, day] = dateStr.split('-');
        const date = new Date(year, month - 1, day);
        
        const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
        const dayWmo = getWmoDescriptionAndIcon(daily[weatherProp][i]);
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-item' + (i === 0 ? ' active' : '');
        dayDiv.title = dayWmo.desc;
        dayDiv.innerHTML = `
            <span class="day-name">${dayName}</span>
            <i class="ph-fill ${dayWmo.icon}"></i>
        `;
        
        dayDiv.addEventListener('click', () => {
            selectedDayIndex = i;
            document.querySelectorAll('.day-item').forEach(el => el.classList.remove('active'));
            dayDiv.classList.add('active');
            updateMainCard(i);
        });
        
        forecastDaysContainer.appendChild(dayDiv);
    }

    updateChartData();
}

function updateMainCard(index) {
    if (!weatherDataCache) return;
    const weatherData = weatherDataCache;
    const daily = weatherData.daily;
    const current = weatherData.current_weather;
    const weatherProp = 'weather' + 'code';
    
    const mainTitle = document.getElementById('main-card-title');
    
    if (index === 0) {
        // Today Live Data
        if(mainTitle) mainTitle.textContent = "Today's Weather";
        temperatureEl.textContent = `${Math.round(current.temperature)}°C`;
        const wmoMap = getWmoDescriptionAndIcon(current[weatherProp]);
        weatherDescriptionEl.textContent = wmoMap.desc;
        mainWeatherIcon.className = `ph-fill ${wmoMap.icon} big-icon`;
        
        const currentHourIndex = weatherData.hourly.time.findIndex(t => t.startsWith(current.time));
        let humidity = 0;
        if (currentHourIndex !== -1) {
            humidity = weatherData.hourly.relative_humidity_2m[currentHourIndex];
        }
        const windProp = 'wind' + 'speed';
        const windSpeed = current[windProp];
        const uvMax = daily.uv_index_max[0];

        humidityEl.textContent = `${humidity}%`;
        windSpeedEl.textContent = `${windSpeed} km/h`;
        uvIndexEl.textContent = uvMax !== undefined ? `${Math.round(uvMax)}` : '0';
        
        updateClock(); // instantly restore live clock
    } else {
        // Future Forecast Data
        const dateStr = daily.time[index];
        const [year, month, day] = dateStr.split('-');
        const date = new Date(year, month - 1, day);
        
        if(mainTitle) mainTitle.textContent = `${date.toLocaleDateString('en-US', { weekday: 'long' })}'s Forecast`;
        
        temperatureEl.textContent = `${Math.round(daily.temperature_2m_max[index])}°C`;
        const wmoMap = getWmoDescriptionAndIcon(daily[weatherProp][index]);
        weatherDescriptionEl.textContent = wmoMap.desc;
        mainWeatherIcon.className = `ph-fill ${wmoMap.icon} big-icon`;
        
        // Approximate metrics for future days
        // The API provides maximum wind velocity in daily, but we might have requested it or just use a fallback if not present
        const windDailyProp = 'wind' + 'speed_10m_max';
        const windSpeed = daily[windDailyProp] ? Math.round(daily[windDailyProp][index]) : '--';
        const uvMax = daily.uv_index_max ? daily.uv_index_max[index] : '--';
        
        // Pick noon humidity for the future day
        const targetTime = `${dateStr}T12:00`;
        const hourIndex = weatherData.hourly.time.findIndex(t => t === targetTime);
        let humidity = '--';
        if (hourIndex !== -1) {
            humidity = weatherData.hourly.relative_humidity_2m[hourIndex];
        }
        
        humidityEl.textContent = `${humidity}%`;
        windSpeedEl.textContent = `${windSpeed} km/h`;
        uvIndexEl.textContent = uvMax !== '--' ? `${Math.round(uvMax)}` : uvMax;
        
        // Stop clock overwriting and show the day
        liveTimeEl.textContent = "Forecast";
        liveDateEl.textContent = date.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
    }
    
    extraMetricsEl.classList.remove('hidden');
    updateChartData();
}

function updateChartData() {
    if(!weatherDataCache) return;
    
    const labels = [];
    const temperatures = [];

    if (currentChartView === 'daily') {
        const daily = weatherDataCache.daily;
        for (let i = 0; i < 7; i++) {
            const dateStr = daily.time[i];
            const [year, month, day] = dateStr.split('-');
            const date = new Date(year, month - 1, day);
            const dayName = i === 0 ? 'Today' : date.toLocaleDateString('en-US', { weekday: 'short' });
            labels.push(dayName);
            temperatures.push(Math.round(daily.temperature_2m_max[i]));
        }
    } else {
        // Hourly
        const hourly = weatherDataCache.hourly;
        let startIndex;
        
        if (selectedDayIndex === 0) {
            // Next 24 hours from current hour
            const currentTimeStr = weatherDataCache.current_weather.time;
            startIndex = hourly.time.findIndex(t => t.startsWith(currentTimeStr));
            if (startIndex === -1) startIndex = 0; 
        } else {
            // 24 hours for the selected future day (starting at midnight)
            const selectedDateStr = weatherDataCache.daily.time[selectedDayIndex];
            const startOfDayStr = `${selectedDateStr}T00:00`;
            startIndex = hourly.time.findIndex(t => t === startOfDayStr);
            if (startIndex === -1) startIndex = selectedDayIndex * 24;
        }

        for (let i = 0; i < 24; i++) {
            const idx = startIndex + i;
            if (idx >= hourly.time.length) break;
            
            const timeStr = hourly.time[idx];
            const date = new Date(timeStr);
            const timeLabel = date.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            
            labels.push((i === 0 && selectedDayIndex === 0) ? 'Now' : timeLabel);
            temperatures.push(Math.round(hourly.temperature_2m[idx]));
        }
    }

    renderChart(labels, temperatures);
}

function getWmoDescriptionAndIcon(code) {
    if (code === 0) return { desc: 'Clear sky', icon: 'ph-sun' };
    if (code === 1) return { desc: 'Mainly clear', icon: 'ph-sun' };
    if (code === 2) return { desc: 'Partly cloudy', icon: 'ph-cloud-sun' };
    if (code === 3) return { desc: 'Overcast', icon: 'ph-cloud' };
    if (code >= 45 && code <= 48) return { desc: 'Fog', icon: 'ph-cloud-fog' };
    if (code >= 51 && code <= 55) return { desc: 'Drizzle', icon: 'ph-cloud-rain' };
    if (code >= 61 && code <= 65) return { desc: 'Rain', icon: 'ph-cloud-rain' };
    if (code >= 71 && code <= 77) return { desc: 'Snow', icon: 'ph-cloud-snow' };
    if (code >= 80 && code <= 82) return { desc: 'Rain showers', icon: 'ph-cloud-rain' };
    if (code >= 85 && code <= 86) return { desc: 'Snow showers', icon: 'ph-cloud-snow' };
    if (code >= 95 && code <= 99) return { desc: 'Thunderstorm', icon: 'ph-cloud-lightning' };
    return { desc: 'Unknown', icon: 'ph-cloud' };
}

function renderChart(labels, dataPoints) {
    const ctx = document.getElementById('forecastChart').getContext('2d');
    
    if (forecastChartInstance) {
        forecastChartInstance.destroy();
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    const borderColor = isLightMode ? '#2B3550' : '#8C99B8';
    
    if (isLightMode) {
        gradient.addColorStop(0, 'rgba(43, 53, 80, 0.3)');
        gradient.addColorStop(1, 'rgba(43, 53, 80, 0.0)');
    } else {
        gradient.addColorStop(0, 'rgba(140, 153, 184, 0.5)');
        gradient.addColorStop(1, 'rgba(140, 153, 184, 0.0)');
    }

    let pointRadii = 4;
    let pointBgColors = isLightMode ? '#2B3550' : '#FFFFFF';
    
    if (currentChartView === 'daily') {
        pointRadii = labels.map((_, i) => i === selectedDayIndex ? 8 : 4);
        pointBgColors = labels.map((_, i) => 
            i === selectedDayIndex 
                ? (isLightMode ? '#2B3550' : '#FFFFFF') 
                : (isLightMode ? 'rgba(43, 53, 80, 0.5)' : 'rgba(255, 255, 255, 0.5)')
        );
    }

    forecastChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Temperature',
                data: dataPoints,
                borderColor: borderColor,
                backgroundColor: gradient,
                borderWidth: 2,
                pointBackgroundColor: pointBgColors,
                pointBorderColor: borderColor,
                pointRadius: pointRadii,
                pointHoverRadius: currentChartView === 'daily' ? pointRadii : 6,
                fill: true,
                tension: 0.4 
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.parsed.y}°C`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    display: false, 
                    min: Math.min(...dataPoints) - 5,
                    max: Math.max(...dataPoints) + 5  
                },
                x: {
                    display: false 
                }
            },
            layout: {
                padding: { left: 20, right: 20, top: 10, bottom: 10 }
            }
        }
    });
}

function showSkeletons() {
    errorMessage.classList.add('hidden');
    dashboard.classList.remove('hidden'); 
    
    todayContent.classList.add('hidden');
    chartContainer.classList.add('hidden');
    forecastDaysContainer.classList.add('hidden');
    
    todaySkeleton.classList.remove('hidden');
    forecastSkeleton.classList.remove('hidden');
}

function hideSkeletons() {
    todaySkeleton.classList.add('hidden');
    forecastSkeleton.classList.add('hidden');
    
    todayContent.classList.remove('hidden');
    chartContainer.classList.remove('hidden');
    forecastDaysContainer.classList.remove('hidden');
}
