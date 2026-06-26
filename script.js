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
        const currentUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
        const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${API_KEY}&units=metric`;
        
        const [currentRes, forecastRes] = await Promise.all([
            fetch(currentUrl),
            fetch(forecastUrl)
        ]);
        
        if (!currentRes.ok || !forecastRes.ok) throw new Error('Failed to fetch weather');
        
        const currentData = await currentRes.json();
        const forecastData = await forecastRes.json();

        weatherDataCache = { current: currentData, forecast: forecastData };
        
        // Process forecast data to get daily summaries
        weatherDataCache.daily = processDailyForecast(forecastData.list);

        updateUI(displayCityName);
    } catch (err) {
        hideSkeletons();
        errorMessage.textContent = 'Failed to fetch weather data. Please try again.';
        errorMessage.classList.remove('hidden');
    }
}

function processDailyForecast(list) {
    const dailyMap = new Map();
    list.forEach(item => {
        const date = item.dt_txt.split(' ')[0];
        if (!dailyMap.has(date)) {
            dailyMap.set(date, {
                date: date,
                temp_max: item.main.temp_max,
                temp_min: item.main.temp_min,
                wind_speed: item.wind.speed,
                icons: [item.weather[0].icon],
                descriptions: [item.weather[0].description]
            });
        } else {
            const day = dailyMap.get(date);
            day.temp_max = Math.max(day.temp_max, item.main.temp_max);
            day.temp_min = Math.min(day.temp_min, item.main.temp_min);
            day.wind_speed = Math.max(day.wind_speed, item.wind.speed);
            day.icons.push(item.weather[0].icon);
            day.descriptions.push(item.weather[0].description);
        }
    });
    
    const daily = Array.from(dailyMap.values()).slice(0, 5);
    
    daily.forEach(day => {
        day.icon = getMostFrequent(day.icons);
        day.description = getMostFrequent(day.descriptions);
    });
    
    return daily;
}

function getMostFrequent(arr) {
    const counts = arr.reduce((a, c) => { a[c] = (a[c] || 0) + 1; return a; }, {});
    return Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b);
}

function updateUI(cityName) {
    hideSkeletons();
    errorMessage.classList.add('hidden');
    
    currentCityName.textContent = cityName;
    forecastCityName.textContent = cityName;
    selectedDayIndex = 0;

    updateMainCard(0);

    const daily = weatherDataCache.daily;
    forecastDaysContainer.innerHTML = '';
    
    for (let i = 0; i < daily.length; i++) {
        const dayData = daily[i];
        const [year, month, day] = dayData.date.split('-');
        const dateObj = new Date(year, month - 1, day);
        
        const dayName = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
        const owmMap = getOwmIcon(dayData.icon, dayData.description);
        
        const dayDiv = document.createElement('div');
        dayDiv.className = 'day-item' + (i === 0 ? ' active' : '');
        dayDiv.title = owmMap.desc;
        dayDiv.innerHTML = `
            <span class="day-name">${dayName}</span>
            <i class="ph-fill ${owmMap.icon}"></i>
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
    const current = weatherDataCache.current;
    const daily = weatherDataCache.daily;
    
    const mainTitle = document.getElementById('main-card-title');
    
    if (index === 0) {
        if(mainTitle) mainTitle.textContent = "Today's Weather";
        temperatureEl.textContent = `${Math.round(current.main.temp)}°C`;
        const owmMap = getOwmIcon(current.weather[0].icon, current.weather[0].description);
        weatherDescriptionEl.textContent = owmMap.desc;
        mainWeatherIcon.className = `ph-fill ${owmMap.icon} big-icon`;
        
        humidityEl.textContent = `${current.main.humidity}%`;
        windSpeedEl.textContent = `${Math.round(current.wind.speed * 3.6)} km/h`; 
        uvIndexEl.textContent = '--'; 
        
        updateClock(); 
    } else {
        const dayData = daily[index];
        const [year, month, day] = dayData.date.split('-');
        const dateObj = new Date(year, month - 1, day);
        
        if(mainTitle) mainTitle.textContent = `${dateObj.toLocaleDateString('en-US', { weekday: 'long' })}'s Forecast`;
        
        temperatureEl.textContent = `${Math.round(dayData.temp_max)}°C`;
        const owmMap = getOwmIcon(dayData.icon, dayData.description);
        weatherDescriptionEl.textContent = owmMap.desc;
        mainWeatherIcon.className = `ph-fill ${owmMap.icon} big-icon`;
        
        const noonItem = weatherDataCache.forecast.list.find(item => item.dt_txt.startsWith(dayData.date) && item.dt_txt.includes('12:00:00')) || weatherDataCache.forecast.list.find(item => item.dt_txt.startsWith(dayData.date));
        
        humidityEl.textContent = noonItem ? `${noonItem.main.humidity}%` : '--';
        windSpeedEl.textContent = `${Math.round(dayData.wind_speed * 3.6)} km/h`;
        uvIndexEl.textContent = '--';
        
        liveTimeEl.textContent = "Forecast";
        liveDateEl.textContent = dateObj.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short' });
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
        for (let i = 0; i < daily.length; i++) {
            const dayData = daily[i];
            const [year, month, day] = dayData.date.split('-');
            const dateObj = new Date(year, month - 1, day);
            const dayName = i === 0 ? 'Today' : dateObj.toLocaleDateString('en-US', { weekday: 'short' });
            labels.push(dayName);
            temperatures.push(Math.round(dayData.temp_max));
        }
    } else {
        const list = weatherDataCache.forecast.list;
        const dayData = weatherDataCache.daily[selectedDayIndex];
        
        let dayItems;
        if (selectedDayIndex === 0) {
            dayItems = list.slice(0, 8);
        } else {
            dayItems = list.filter(item => item.dt_txt.startsWith(dayData.date));
        }

        dayItems.forEach((item, i) => {
            const dateObj = new Date(item.dt * 1000);
            const timeLabel = dateObj.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
            labels.push((i === 0 && selectedDayIndex === 0) ? 'Now' : timeLabel);
            temperatures.push(Math.round(item.main.temp));
        });
    }

    renderChart(labels, temperatures);
}

function getOwmIcon(iconCode, description) {
    const map = {
        '01d': 'ph-sun',
        '01n': 'ph-moon',
        '02d': 'ph-cloud-sun',
        '02n': 'ph-cloud-moon',
        '03d': 'ph-cloud',
        '03n': 'ph-cloud',
        '04d': 'ph-cloud',
        '04n': 'ph-cloud',
        '09d': 'ph-cloud-rain',
        '09n': 'ph-cloud-rain',
        '10d': 'ph-cloud-sun-rain',
        '10n': 'ph-cloud-moon-rain',
        '11d': 'ph-cloud-lightning',
        '11n': 'ph-cloud-lightning',
        '13d': 'ph-cloud-snow',
        '13n': 'ph-cloud-snow',
        '50d': 'ph-cloud-fog',
        '50n': 'ph-cloud-fog'
    };
    
    const icon = map[iconCode] || 'ph-cloud';
    const desc = description ? description.charAt(0).toUpperCase() + description.slice(1) : 'Unknown';
    return { desc, icon };
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
