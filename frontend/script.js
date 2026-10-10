/* ============================================================
   Weather Match — REIMAGINED SCRIPT
   Particle systems, 3D tilt, animated counters, reactive UI
   ============================================================ */

import { initializeApi } from './weather-api.js';

const weatherIcons = {
  sunny: new URL('./src/assets/sun.svg', import.meta.url).href,
  cloudy: new URL('./src/assets/cloudy.svg', import.meta.url).href,
  rain: new URL('./src/assets/rain.svg', import.meta.url).href,
  snow: new URL('./src/assets/snow.png', import.meta.url).href,
  thunder: new URL('./src/assets/thunder.png', import.meta.url).href,
};

function weatherIconPath(key) {
  return weatherIcons[key] || weatherIcons.cloudy;
}


// ============================================================
//  PARTICLE SYSTEM — Canvas-based floating particles
// ============================================================
class ParticleSystem {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.mouse = { x: -1000, y: -1000 };
    this.running = true;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('mousemove', e => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;
    });
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  init(count = 60) {
    this.particles = [];
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: Math.random() * this.canvas.width,
        y: Math.random() * this.canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        size: 1 + Math.random() * 2.5,
        opacity: 0.1 + Math.random() * 0.3,
        baseOpacity: 0.1 + Math.random() * 0.3,
        pulseSpeed: 0.005 + Math.random() * 0.01,
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  update() {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const mouseRadius = 200;

    this.particles.forEach(p => {
      // Mouse interaction — soft repulsion
      const dx = p.x - this.mouse.x;
      const dy = p.y - this.mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < mouseRadius && dist > 0) {
        const force = (mouseRadius - dist) / mouseRadius * 0.8;
        p.vx += (dx / dist) * force * 0.15;
        p.vy += (dy / dist) * force * 0.15;
      }

      // Damping
      p.vx *= 0.99;
      p.vy *= 0.99;

      p.x += p.vx;
      p.y += p.vy;

      // Pulse opacity
      p.pulsePhase += p.pulseSpeed;
      p.opacity = p.baseOpacity + Math.sin(p.pulsePhase) * 0.15;

      // Wrap around
      if (p.x < -20) p.x = w + 20;
      if (p.x > w + 20) p.x = -20;
      if (p.y < -20) p.y = h + 20;
      if (p.y > h + 20) p.y = -20;
    });
  }

  draw() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw connections
    const connectionDist = 140;
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i];
        const b = this.particles[j];
        const dist = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
        if (dist < connectionDist) {
          const alpha = (1 - dist / connectionDist) * 0.08;
          this.ctx.beginPath();
          this.ctx.moveTo(a.x, a.y);
          this.ctx.lineTo(b.x, b.y);
          this.ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
          this.ctx.lineWidth = 0.5;
          this.ctx.stroke();
        }
      }
    }

    // Draw particles
    this.particles.forEach(p => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(200, 210, 255, ${p.opacity})`;
      this.ctx.fill();

      // Soft glow
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size * 3, 0, Math.PI * 2);
      this.ctx.fillStyle = `rgba(139, 92, 246, ${p.opacity * 0.1})`;
      this.ctx.fill();
    });
  }

  loop() {
    if (!this.running) return;
    this.update();
    this.draw();
    requestAnimationFrame(() => this.loop());
  }

  start() {
    this.init();
    this.loop();
  }

  stop() {
    this.running = false;
  }
}

// ============================================================
//  3D CARD TILT — mouse-reactive
// ============================================================
function initCardTilt() {
  document.querySelectorAll('.glass-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      const tiltX = (0.5 - y) * 10;
      const tiltY = (x - 0.5) * 10;

      card.style.setProperty('--tilt-x', `${tiltX}deg`);
      card.style.setProperty('--tilt-y', `${tiltY}deg`);
    });

    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
    });
  });
}

// ============================================================
//  CURSOR GLOW
// ============================================================
function initCursorGlow() {
  const glow = document.getElementById('cursor-glow');
  if (!glow) return;
  document.addEventListener('mousemove', e => {
    glow.style.left = e.clientX + 'px';
    glow.style.top = e.clientY + 'px';
  });
}

// ============================================================
//  ANIMATED TEMPERATURE COUNTER
// ============================================================
function animateCounter(el, target, duration = 1500) {
  if (el.counterFrame) cancelAnimationFrame(el.counterFrame);
  if (target == null) {
    el.textContent = '--';
    return;
  }
  const start = performance.now();
  const from = 0;

  function tick(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out-quart
    const eased = 1 - Math.pow(1 - progress, 4);
    const current = Math.round(from + (target - from) * eased);
    el.textContent = current + '°';

    if (progress < 1) el.counterFrame = requestAnimationFrame(tick);
  }

  el.counterFrame = requestAnimationFrame(tick);
}

// ============================================================
//  RIPPLE EFFECT
// ============================================================
function initRippleEffect() {
  document.querySelectorAll('.glass-card').forEach(card => {
    card.addEventListener('click', e => {
      const rect = card.getBoundingClientRect();
      const ripple = document.createElement('span');
      ripple.className = 'ripple';
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size / 2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size / 2) + 'px';
      card.appendChild(ripple);
      ripple.addEventListener('animationend', () => ripple.remove());
    });
  });
}

// ============================================================
//  ENTRANCE ANIMATIONS (IntersectionObserver)
// ============================================================
function initEntranceAnimations() {
  // Trigger all at once on load for above-fold content
  setTimeout(() => {
    document.querySelectorAll('.animate-in').forEach(el => {
      el.classList.add('visible');
    });
  }, 200);
}

// ============================================================
//  DOM RENDERING
// ============================================================
function renderCurrentWeather(data) {
  document.getElementById('city-name').textContent = data.current_location;

  // Animated counter for temperature
  const tempEl = document.getElementById('current-temp');
  animateCounter(tempEl, data.current_temp, 1800);

  document.getElementById('current-weather-label').textContent = data.weather_label;
  document.getElementById('current-date').textContent = data.date_label;

  const icon = document.getElementById('current-weather-icon');
  icon.src = weatherIconPath(data.current_weather);
  icon.alt = data.weather_label;

  // Stat badges
  document.getElementById('stat-humidity').textContent = data.humidity == null ? '--' : data.humidity + '%';
  document.getElementById('stat-wind').textContent = data.wind_speed == null ? '--' : data.wind_speed + ' km/h';
  document.getElementById('stat-feels').textContent = data.feels_like == null ? '--' : data.feels_like + '°';
}

// ============================================================
//  FORECAST DAY CARDS
// ============================================================
function renderForecastDayCards(forecast) {
  const container = document.getElementById('forecast-day-cards');
  container.innerHTML = '';

  forecast.forEach((day, i) => {
    const card = document.createElement('div');
    card.className = 'forecast-day-card animate-in';
    card.setAttribute('data-delay', String(i + 1));

    const name = document.createElement('span');
    name.className = 'day-name';
    name.textContent = day.day;
    const icon = document.createElement('img');
    icon.className = 'day-icon';
    icon.src = weatherIconPath(day.weather);
    icon.alt = day.label;
    const temp = document.createElement('span');
    temp.className = 'day-temp';
    temp.textContent = day.temp == null ? '--' : `${day.temp}°`;
    card.title = `Min: ${day.min ?? '--'} / Max: ${day.temp ?? '--'} °C`;
    card.append(name, icon, temp);

    container.appendChild(card);

    // Trigger animation with stagger
    setTimeout(() => card.classList.add('visible'), 400 + i * 100);
  });
}

// ============================================================
//  CHART.JS — 7-Day Temperature Trend
// ============================================================
let tempChart = null;

function renderChart(forecast) {
  if (!window.Chart) return;
  const ctx = document.getElementById('forecast-chart').getContext('2d');
  const labels = forecast.map(d => d.day);
  const temps  = forecast.map(d => d.temp);

  const gradient = ctx.createLinearGradient(0, 0, 0, 200);
  gradient.addColorStop(0, 'rgba(139, 92, 246, 0.30)');
  gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.08)');
  gradient.addColorStop(1, 'rgba(139, 92, 246, 0.00)');

  if (tempChart) tempChart.destroy();

  tempChart = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Temperature °C',
        data: temps,
        fill: true,
        backgroundColor: gradient,
        borderColor: '#8b5cf6',
        borderWidth: 2.5,
        tension: 0.45,
        pointRadius: 5,
        pointBackgroundColor: '#c4b5fd',
        pointBorderColor: '#8b5cf6',
        pointBorderWidth: 2,
        pointHoverRadius: 10,
        pointHoverBackgroundColor: '#fbbf24',
        pointHoverBorderColor: '#ffffff',
        pointHoverBorderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 2000,
        easing: 'easeOutQuart',
      },
      interaction: { intersect: false, mode: 'index' },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(10, 14, 26, 0.95)',
          titleColor: '#e0e7ff',
          bodyColor: '#e0e7ff',
          borderColor: 'rgba(139, 92, 246, 0.3)',
          borderWidth: 1,
          padding: 14,
          cornerRadius: 14,
          displayColors: false,
          titleFont: { family: 'Inter', weight: '600' },
          bodyFont: { family: 'Inter' },
          callbacks: {
            label: ctx => `${ctx.parsed.y}°C`,
          },
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: {
            color: 'rgba(224,231,255,0.45)',
            font: { family: 'Inter', size: 11, weight: '600' },
          },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.03)', drawBorder: false },
          ticks: {
            color: 'rgba(224,231,255,0.35)',
            font: { family: 'Inter', size: 10 },
            callback: v => `${v}°`,
          },
          suggestedMin: Math.min(...temps) - 4,
          suggestedMax: Math.max(...temps) + 4,
        },
      },
    },
  });
}


// ============================================================
//  WEATHER BACKGROUND ANIMATIONS
// ============================================================
function clearWeatherAnimations() {
  const layer = document.getElementById('weather-animation-layer');
  layer.innerHTML = '';
  document.body.classList.remove('weather-sunny', 'weather-cloudy', 'weather-rain');
}

// ─── RAIN ───
function animateRain() {
  clearWeatherAnimations();
  document.body.classList.add('weather-rain');
  const layer = document.getElementById('weather-animation-layer');

  // Foreground rain (fast, thick)
  for (let i = 0; i < 80; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.height = `${22 + Math.random() * 35}px`;
    drop.style.opacity = `${0.3 + Math.random() * 0.4}`;
    drop.style.animationDuration = `${0.5 + Math.random() * 0.5}s`;
    drop.style.animationDelay = `${Math.random() * 2}s`;
    layer.appendChild(drop);
  }

  // Background rain (slower, thinner)
  for (let i = 0; i < 50; i++) {
    const drop = document.createElement('div');
    drop.className = 'raindrop';
    drop.style.left = `${Math.random() * 100}%`;
    drop.style.height = `${12 + Math.random() * 18}px`;
    drop.style.width = '1px';
    drop.style.opacity = `${0.1 + Math.random() * 0.15}`;
    drop.style.animationDuration = `${0.8 + Math.random() * 0.8}s`;
    drop.style.animationDelay = `${Math.random() * 3}s`;
    layer.appendChild(drop);
  }

  // Random lightning flashes
  function triggerLightning() {
    if (!document.body.classList.contains('weather-rain')) return;
    const flash = document.createElement('div');
    flash.className = 'lightning-flash';
    document.body.appendChild(flash);
    flash.addEventListener('animationend', () => flash.remove());
    setTimeout(triggerLightning, 5000 + Math.random() * 12000);
  }
  setTimeout(triggerLightning, 4000);

  // Rain splashes at bottom
  function spawnSplash() {
    if (!document.body.classList.contains('weather-rain')) return;
    const splash = document.createElement('div');
    splash.className = 'rain-splash';
    splash.style.left = `${Math.random() * 100}%`;
    layer.appendChild(splash);
    splash.addEventListener('animationend', () => splash.remove());
    setTimeout(spawnSplash, 50 + Math.random() * 150);
  }
  setTimeout(spawnSplash, 1000);
}

// ─── SUNNY ───
function animateSunny() {
  clearWeatherAnimations();
  document.body.classList.add('weather-sunny');
  const layer = document.getElementById('weather-animation-layer');

  // Sun orb
  const orb = document.createElement('div');
  orb.className = 'sun-orb';
  layer.appendChild(orb);

  // Corona rays
  const corona = document.createElement('div');
  corona.className = 'sun-corona';
  for (let i = 0; i < 12; i++) {
    const ray = document.createElement('div');
    ray.className = 'sun-corona-ray';
    ray.style.transform = `rotate(${i * 30}deg) translateY(-60px)`;
    ray.style.opacity = `${0.15 + Math.random() * 0.15}`;
    ray.style.height = `${80 + Math.random() * 60}px`;
    corona.appendChild(ray);
  }
  layer.appendChild(corona);

  // Floating sparkles
  function spawnSparkle() {
    if (!document.body.classList.contains('weather-sunny')) return;
    const sparkle = document.createElement('div');
    sparkle.className = 'sun-sparkle';
    sparkle.style.right = `${40 + Math.random() * 200}px`;
    sparkle.style.top = `${Math.random() * 40}%`;
    sparkle.style.animationDuration = `${2 + Math.random() * 3}s`;
    layer.appendChild(sparkle);
    sparkle.addEventListener('animationend', () => sparkle.remove());
    setTimeout(spawnSparkle, 300 + Math.random() * 800);
  }
  setTimeout(spawnSparkle, 500);
}

// ─── CLOUDY ───
function animateCloudy() {
  clearWeatherAnimations();
  document.body.classList.add('weather-cloudy');
  const layer = document.getElementById('weather-animation-layer');

  const configs = [
    { top: '5%',  h: '70px',  w: '280px', dur: '35s', op: '0.08', delay: '0s' },
    { top: '15%', h: '50px',  w: '200px', dur: '45s', op: '0.05', delay: '8s' },
    { top: '28%', h: '80px',  w: '320px', dur: '38s', op: '0.10', delay: '15s' },
    { top: '10%', h: '45px',  w: '160px', dur: '50s', op: '0.04', delay: '22s' },
    { top: '40%', h: '60px',  w: '240px', dur: '42s', op: '0.07', delay: '5s' },
    { top: '55%', h: '65px',  w: '300px', dur: '36s', op: '0.08', delay: '12s' },
    { top: '70%', h: '40px',  w: '180px', dur: '48s', op: '0.04', delay: '20s' },
    { top: '85%', h: '55px',  w: '260px', dur: '40s', op: '0.06', delay: '3s' },
  ];

  configs.forEach(cfg => {
    const cloud = document.createElement('div');
    cloud.className = 'drift-cloud';
    Object.assign(cloud.style, {
      top: cfg.top,
      height: cfg.h,
      width: cfg.w,
      opacity: cfg.op,
      animationDuration: cfg.dur,
      animationDelay: cfg.delay,
    });
    layer.appendChild(cloud);
  });
}

function setWeatherAnimation(weatherKey) {
  switch (weatherKey) {
    case 'rain':   animateRain();   break;
    case 'sunny':  animateSunny();  break;
    case 'cloudy': animateCloudy(); break;
    default:       animateCloudy(); break;
  }
}

// ============================================================
//  HELPERS
// ============================================================
function getFormattedDate() {
  return new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

// ============================================================
//  BOOTSTRAP — DOMContentLoaded
// ============================================================
function bootstrap() {
  // Date display
  document.getElementById('current-date').textContent = getFormattedDate();

  initializeApi(updateWeather);

  // 5. Particle system
  const canvas = document.getElementById('particle-canvas');
  if (canvas) {
    const ps = new ParticleSystem(canvas);
    ps.start();
  }

  // 6. Interactive features
  initCursorGlow();
  initCardTilt();
  initRippleEffect();
  initEntranceAnimations();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
} else {
  bootstrap();
}

// ============================================================
//  PUBLIC API — for backend integration
// ============================================================
function updateWeather(data) {
  renderCurrentWeather(data);
  renderChart(data.forecast_7_days);
  renderForecastDayCards(data.forecast_7_days);
  setWeatherAnimation(data.current_weather);
}
