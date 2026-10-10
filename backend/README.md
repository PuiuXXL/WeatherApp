# WeatherWise Backend

Backend-ul este separat de frontend si expune endpoint-uri pentru verificare si date meteo prin Open-Meteo.

```bash
npm run dev
```

Endpoint-uri disponibile:

```text
GET /api/health
GET /local-weather
GET /api/locations?query=Bucharest
GET /api/weather?city=Bucharest
GET /api/weather?latitude=44.43&longitude=26.10
```

Integrarea foloseste Open-Meteo Forecast API si Geocoding API, fara API key pentru uz non-comercial.

Modulul `src/modules/current-location` serveste pagina de la
`http://localhost:3000/local-weather`. La deschidere, browserul cere permisiunea
pentru locatie, apoi trimite coordonatele la `/api/weather` si afiseaza vremea.
Coordonatele nu sunt salvate de acest modul; sunt trimise catre Open-Meteo pentru
prognoza. Localizarea necesita localhost sau HTTPS si serviciile de localizare
disponibile pe dispozitiv. Daca permisiunea este refuzata, utilizatorul o poate
reactiva din setarile site-ului si poate folosi butonul de actualizare.
