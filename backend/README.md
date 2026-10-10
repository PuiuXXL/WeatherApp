# WeatherWise Backend

Backend-ul este separat de frontend si expune endpoint-uri pentru verificare si date meteo prin Open-Meteo.

```bash
npm run dev
```

Endpoint-uri disponibile:

```text
GET /api/health
GET /api/locations?query=Bucharest
GET /api/weather?city=Bucharest
GET /api/weather?latitude=44.43&longitude=26.10
```

Integrarea foloseste Open-Meteo Forecast API si Geocoding API, fara API key pentru uz non-comercial.
