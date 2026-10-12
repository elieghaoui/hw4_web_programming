const searchForm = document.getElementById('search-form');
const cityInput = document.getElementById('city-input');
const searchButton = document.getElementById('search-button');
const retryButton = document.getElementById('retry-button');
const statusBox = document.getElementById('status');
const statusMessage = document.getElementById('status-message');
const weatherResults = document.getElementById('weather-results');
const forecastList = document.getElementById('forecast-list');

searchForm.addEventListener('submit', searchWeather);
retryButton.addEventListener('click', searchWeather);

function setStatus(state, message) {
  statusBox.className = `status status-${state}`;
  statusMessage.textContent = message;
  statusBox.querySelector('.status-symbol').textContent =
    state === 'loading' ? '' : state === 'error' ? '!' : state === 'success' ? '✓' : '☀';
  searchButton.disabled = state === 'loading';
  retryButton.hidden = state !== 'error' || !cityInput.value.trim();
}

function getWeatherInfo(code, isDay = 1) {
  if (code === 0) return { text: 'Clear sky', icon: isDay ? '☀️' : '🌙' };
  if (code === 1) return { text: 'Mainly clear', icon: '🌤️' };
  if (code === 2) return { text: 'Partly cloudy', icon: '⛅' };
  if (code === 3) return { text: 'Overcast', icon: '☁️' };
  if (code === 45 || code === 48) return { text: 'Foggy', icon: '🌫️' };
  if (code >= 51 && code <= 57) return { text: 'Drizzle', icon: '🌦️' };
  if (code >= 61 && code <= 67) return { text: 'Rain', icon: '🌧️' };
  if (code >= 71 && code <= 77) return { text: 'Snow', icon: '❄️' };
  if (code >= 80 && code <= 82) return { text: 'Rain showers', icon: '🌦️' };
  if (code >= 95) return { text: 'Thunderstorm', icon: '⛈️' };
  return { text: 'Cloudy', icon: '☁️' };
}

async function searchWeather(event) {
  event.preventDefault();
  if (searchButton.disabled) return;
  const city = cityInput.value.trim();

  if (!city) {
    weatherResults.hidden = true;
    retryButton.hidden = true;
    setStatus('error', 'Please enter a city name, such as Beirut.');
    return;
  }

  weatherResults.hidden = true;
  setStatus('loading', `Loading weather for ${city}...`);

  try {
    // First, find the city's coordinates.
    const cityParams = new URLSearchParams({ name: city, count: '1', language: 'en', format: 'json' });
    const cityResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${cityParams}`);
    if (!cityResponse.ok) throw new Error(cityResponse.status === 429 ? 'busy' : 'request');

    const cityData = await cityResponse.json();
    if (!cityData.results || cityData.results.length === 0) throw new Error('city');
    const place = cityData.results[0];

    // Use the coordinates to get the current weather and forecast.
    const weatherParams = new URLSearchParams({
      latitude: place.latitude,
      longitude: place.longitude,
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min',
      forecast_days: '3',
      timezone: 'auto'
    });
    const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?${weatherParams}`);
    if (!weatherResponse.ok) throw new Error(weatherResponse.status === 429 ? 'busy' : 'request');

    const weather = await weatherResponse.json();
    if (!weather.current || !weather.daily) throw new Error('data');
    showWeather(place, weather);
    setStatus('success', `Weather loaded for ${place.name}.`);
  } catch (error) {
    let message = 'Something went wrong. Please try again.';
    if (error.message === 'city') message = 'City not found. Check the spelling and try again.';
    else if (error.message === 'busy') message = 'The weather service is busy. Please try again in a moment.';
    else if (error.message === 'request') message = 'Could not get weather data. Please try again.';
    else if (error.message === 'data') message = 'The weather service returned incomplete data.';
    else if (error instanceof TypeError) message = 'Could not connect. Check your internet connection.';
    setStatus('error', message);
  }
}

function showWeather(place, weather) {
  const current = weather.current;
  const info = getWeatherInfo(current.weather_code, current.is_day);

  document.getElementById('location-name').textContent = place.name;
  document.getElementById('location-detail').textContent = [place.admin1, place.country].filter(Boolean).join(', ');
  document.getElementById('weather-icon').textContent = info.icon;
  document.getElementById('weather-description').textContent = info.text;
  document.getElementById('current-temperature').textContent = `${Math.round(current.temperature_2m)}°`;
  document.getElementById('humidity').textContent = `${current.relative_humidity_2m}%`;
  document.getElementById('wind-speed').textContent = `${Math.round(current.wind_speed_10m)} km/h`;
  document.getElementById('feels-like').textContent = `${Math.round(current.apparent_temperature)}°C`;
  document.getElementById('updated-time').textContent = `Local time: ${current.time.replace('T', ' ')}`;

  forecastList.innerHTML = weather.daily.time.map((date, index) => {
    const day = getWeatherInfo(weather.daily.weather_code[index]);
    const name = new Date(`${date}T12:00:00`).toLocaleDateString('en', { weekday: 'long' });
    const high = Math.round(weather.daily.temperature_2m_max[index]);
    const low = Math.round(weather.daily.temperature_2m_min[index]);
    return `<article class="forecast-day">
      <span class="forecast-name">${name}</span>
      <span class="forecast-icon">${day.icon}</span>
      <span class="forecast-desc">${day.text}</span>
      <div class="forecast-temperatures"><span>${high}°</span><span class="forecast-low">${low}°</span></div>
    </article>`;
  }).join('');

  weatherResults.hidden = false;
}
