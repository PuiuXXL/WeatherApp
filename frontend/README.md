# WeatherWise Frontend

Dashboardul Weather Match foloseste stilizarea si animatiile din `weather.html`,
cu date preluate din backend. Vite serveste acelasi dashboard la `/` si `/weather.html`.

## Comenzi

```bash
npm run dev
```

```bash
npm run build
```

Porneste backendul intr-un terminal separat, din `backend`, cu `npm start`.
Din `frontend`, ruleaza `npm run dev` si deschide adresa afisata de Vite.
Proxy-ul de dezvoltare trimite `/api` catre `http://localhost:3000`.

La deschidere browserul solicita automat locatia si trimite coordonatele catre
backend pentru vreme si recomandari. Permite accesul la locatie cand browserul
il solicita. Daca localizarea este refuzata sau indisponibila, poti cauta un oras
manual sau reincerca folosind "Locatia mea". Nu se foloseste un oras implicit.
Poti actualiza datele cu butonul de actualizare. Recomandarile se incarca
separat de vreme si pot dura mai mult. Localizarea necesita localhost sau HTTPS.

Endpointuri folosite: `/api/locations`, `/api/weather`, `/api/recommendations`.
Datele meteo includ temperatura curenta, umiditatea, vantul, temperatura
resimtita si prognoza zilnica maxima/minima. Prognoza orara afiseaza toate orele
zilei curente la destinatie, temperatura, starea vremii si probabilitatea de
precipitatii. Ora curenta este evidentiata si banda se poate derula in ambele
directii, inclusiv catre orele trecute. Planurile afiseaza sugestiile,
intervalele locale, itinerarul pentru azi, obiectele de luat si locurile/rutele
disponibile; starea AI/fallback este afisata in interfata.

Fiecare actualizare solicita un plan nou. Istoricul ultimelor activitati pentru
fiecare data si zona este pastrat in `localStorage` (maximum zece zone, sapte
zile si sase ID-uri per zi); backendul exclude aceste optiuni cand exista
alternative eligibile. Nu se stocheaza texte AI sau chei API. Daca stocarea
browserului este blocata, istoricul ramane disponibil pana la reincarcare.
Acest flux poate genera apeluri OpenAI noi la fiecare actualizare.

Pentru productie, seteaza `VITE_API_BASE_URL` la originea backendului inainte de
`npm run build` (vezi `.env.example`). Daca ramane gol, hostul frontendului trebuie
sa directioneze `/api` catre backend. Proxy-ul Vite este doar pentru dezvoltare.
Nu pune chei API in variabile `VITE_*`; acestea sunt publice in browser.
