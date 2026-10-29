/**
 * config.js — API base URL configuration.
 *
 * For local development the backend runs on localhost:8080.
 * For production, replace the Render URL below with your
 * actual deployed backend URL.
 */
const CONFIG = {
    API_BASE_URL:
        window.location.hostname === 'localhost' ||
        window.location.hostname === '127.0.0.1'
            ? 'http://localhost:8080'
            : 'https://mind-map-backend.onrender.com'   // ← replace after deploying to Render
};
