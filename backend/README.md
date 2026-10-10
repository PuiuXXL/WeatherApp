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
GET /api/recommendations?latitude=44.43&longitude=26.10
GET /api/recommendations?city=Bucharest
```

Integrarea foloseste Open-Meteo Forecast API si Geocoding API, fara API key pentru uz non-comercial.

Modulul `src/modules/current-location` serveste pagina de la
`http://localhost:3000/local-weather`. La deschidere, browserul cere permisiunea
pentru locatie, apoi trimite coordonatele la `/api/weather` si afiseaza vremea.
Coordonatele nu sunt salvate de acest modul; sunt trimise catre Open-Meteo pentru
prognoza. Localizarea necesita localhost sau HTTPS si serviciile de localizare
disponibile pe dispozitiv. Daca permisiunea este refuzata, utilizatorul o poate
reactiva din setarile site-ului si poate folosi butonul de actualizare.

## Recomandari de activitati

Pagina `/local-weather` afiseaza si sugestii pentru azi, seara si urmatoarele
zile. Endpoint-ul `/api/recommendations` accepta aceiasi parametri ca vremea.
Returneaza `timezone`, `forecastTime`, `placesStatus` si trei `recommendations`,
fiecare cu `period`, `activity`, `title`, `interval`, `reason`, `place`, `weather`.
Intervalele sunt ore locale la destinatie, fara offset; `timezone` identifica
fusul orar. Un interval absent este `null`.

Motorul cauta doua ore consecutive (trei puncte orare), de la urmatoarea ora
intreaga, cu temperatura resimtita 15-28 C, ploaie <=25%, vant <=20 km/h,
rafale <=35 km/h, UV <=5, lumina naturala si cod meteo 0-3. Pentru azi cauta
inainte de 19, pentru seara de la 19, iar pentru viitor primul interval eligibil
din urmatoarele sase zile. Aceste praguri sunt reguli de produs ajustabile,
nu garantii privind vremea. In lipsa unui interval sugereaza activitati in
interior; seara poate sugera un film acasa, fara a inventa un titlu sau proiectii.

Modulul `places` cauta parcuri/cafenele la 8 km, muzee la 15 km si lacuri la 20 km
in OpenStreetMap prin Overpass. Campul `distanceKm` al locului este in linie
dreapta pana la punctul/centrul acestuia, nu traseu pietonal. Campul separat
`route` contine estimari rutiere. Datele nu confirma programul de acces. Rezultatele sunt pastrate
temporar in memorie 15 minute (maximum 100 de cautari); coordonatele sunt
trimise si catre Overpass. Daca serviciul esueaza, `placesStatus` este
`unavailable` si se folosesc sugestii generale. Nu se recomanda trasee montane
pe baza prognozei orasului. Acest motor de baza ramane disponibil fara AI.
Endpoint-ul Overpass poate fi schimbat prin `OVERPASS_URL`. Erorile sunt
pastrate un minut pentru a evita repetarea cererilor catre un serviciu ocupat.

Teste: `npm test`.

## Numele locatiei

Ambele endpoint-uri (`/api/weather` si `/api/recommendations`) includ obiectul
`location`: `name` (localitate), `admin1` (judet/regiune), `country`, `countryCode`,
`displayName`, `latitude`, `longitude`, `timezone`, `source` si `status`.
Pagina locala afiseaza `displayName` deasupra coordonatelor.

Pentru cereri prin coordonate, modulul `location` foloseste reverse geocoding
OpenStreetMap / Nominatim. Localitatea este aproximativa, conform coordonatelor
browserului. Se trimit coordonatele si catre acest furnizor. Cererile sunt
limitate la una pe secunda pentru procesul backend si rezultatele sunt pastrate
in memorie o ora (maximum 100 de locatii); erorile sunt pastrate un minut.
Cererile simultane pentru aceeasi locatie sunt reunite. Daca serviciul este
ocupat cu o alta locatie sau esueaza, campurile descriptive sunt `null`,
`status` este `unavailable`, iar coordonatele si prognoza raman disponibile.

Pentru alt furnizor compatibil, seteaza `REVERSE_GEOCODING_URL`. Instantele
multiple necesita o limita comuna de cereri sau un furnizor propriu.
Surse: https://nominatim.org/release-docs/latest/api/Reverse/ si
https://operations.osmfoundation.org/policies/nominatim/.

## Planuri cu OpenAI

`src/config.js` incarca automat `backend/.env`, independent de directorul de
pornire. Variabilele deja setate in mediu au prioritate. Configureaza
`OPENAI_API_KEY` si optional `OPENAI_MODEL` (implicit `gpt-5.4-mini`). Nu include
cheia in Git. Pe Vercel configureaza variabilele in setarile proiectului.

`/api/recommendations` pastreaza campul `recommendations` existent si adauga:

- `assistant`: `status` (`generated` sau `fallback`), `provider`, `model`, `reason`.
- `days`: data, temperatura minima/maxima, rezumat si `suggestions` cu activitate,
  interval, loc verificat (sau null), explicatie si lista orientativa `takeWith`.
  `itinerary` contine pasi cu `start`, `end`, `title`, afisati numai pentru azi.
- `destinations`: locurile cu ruta auto si prognoza proprie verificate.

OpenAI primeste coordonatele raportate de browser, localitatea, fusul orar,
vremea curenta, TOATE orele zilei curente (inclusiv orele trecute), temperaturile
si prognoza zilnica pentru urmatoarele zile, unitatile si locurile gasite.
Intervalele viitoare eligibile sunt calculate din prognoza orara de backend.
Modelul alege numai activitati/intervale predefinite din ziua respectiva;
nu poate furniza prin campurile structurate alte locuri sau distante.
Textul explicativ este generat de AI si poate contine erori. Nu se face cautare
web prin OpenAI in aceasta versiune. Locurile concrete vin din Overpass;
drumetiile si filmele actuale necesita surse suplimentare.

Modulul `routes` calculeaza drumul dus si intors prin OSRM (configurabil prin
`ROUTING_URL`, implicit serverul public demo). `route.distanceKm` si
`durationMinutes` sunt pentru dus; `returnDistanceKm` si `returnDurationMinutes`
pentru intors. Nu includ trafic in timp real. Snap-ul la drum este limitat la
1 km: destinatia este un punct rutier apropiat de centrul obiectului OSM, nu o
intrare/parcare garantata. Accesul public si programul trebuie verificate.
Coordonatele sunt trimise si furnizorului de rutare. Pentru productie foloseste
un furnizor cu disponibilitate si limite adecvate, nu presupune SLA pentru demo.

Pentru maximum patru destinatii, backend-ul verifica ruta (maximum 90 minute
dus) si prognoza proprie, cu un buget total de 20 secunde. Fara aceste date,
destinatia nu intra in program. O iesire include pregatire, dus, vizita/plimbare,
pauza de gustare si intors. Programul nu foloseste ore trecute si nu suprapune
activitati. Iesirile exterioare necesita lumina, temperatura resimtita 8-28 C,
ploaie <=30%, UV <=5 si rafale <=40 km/h la destinatie. Muzeele si cafenelele
sunt optiuni conditionate de confirmarea programului. Activitatile de acasa
raman disponibile daca vremea sau serviciile externe nu permit o iesire.

Apelul foloseste Responses API cu schema JSON stricta si `store: false`.
Solicitam pentru azi un program detaliat (o iesire si optional seara acasa),
iar pentru fiecare zi urmatoare exact o idee scurta, fara lista de obiecte.
Interfata separa "Recomandari pentru azi" de "Idei pentru zilele urmatoare".
Optiunile de acasa includ lectura, proiecte creative, puzzle/jocuri, invatare,
muzica, gatit, albume foto si miscare usoara, plus film ca program optional
de seara. Titlurile si itinerarele sunt distincte; mesele nu sunt o etapa
obligatorie. Ordinea optiunilor variaza dupa data. AI-ul personalizeaza
explicatiile dupa prognoza, localitate si orele disponibile, fara sa presupuna
preferinte personale necunoscute.
Campul `diversityKey` identifica categoria. Pentru zilele viitoare, validarea
respinge o categorie folosita mai des decat o alternativa eligibila; un raspuns
repetitiv produce `assistant.reason: repetitive_response` si un plan de baza
variat. Si fara AI, planul prefera categoriile cel mai putin folosite si respecta
intervalele fara suprapuneri.

Fiecare actualizare a frontendului trimite un identificator `generation` nou,
plus `previous` (JSON cu maximum sapte zile si sase ID-uri recente per zi).
Istoricul ramane in browser, separat pentru fiecare zona de aproximativ 1 km;
functioneaza intre reincarcari si intre instante backend Vercel. Cand exista
alternative, optiunile recent afisate pentru aceeasi data sunt eliminate din
schema trimisa AI-ului. Parametrii sunt validati, iar ordinea optiunilor ramase
variaza dupa generare si coordonate. Cache-ul de 10 minute reuneste numai
reincercarile aceluiasi context/identificator; o actualizare noua poate consuma
un apel OpenAI nou. Limitele de generare existente raman active.

AI-ul poate scrie titluri concrete pentru activitatile generale, in categoria
aleasa; numele si titlurile destinatiilor verificate raman controlate de backend.
Cand Overpass nu furnizeaza locuri, prognoza orara de la coordonatele selectate
poate permite plimbare, fotografie sau observarea naturii intr-o zona publica
cunoscuta. Aceste optiuni au `scope: local_area`, nu contin un loc numit sau o
ruta inventata, si necesita lumina, temperatura resimtita 8-28 C, ploaie <=30%,
UV <=5 si rafale <=40 km/h. Frigul, ploaia, furtuna sau intunericul pastreaza
variantele indoor. Nu promitem activitati unice la infinit cand optiunile
eligibile sunt epuizate.
Daca modelul
nu raspunde, nu respecta structura, cheia lipseste ori exista probleme de credit,
se livreaza planul de baza si un motiv sanitizat, fara cheia sau raspunsuri brute.
Cache-ul in memorie dureaza 10 minute pentru acelasi context/model (30 secunde
pentru erori); maximum 100 rezultate, doua generari simultane si sase generari
noi pe minut per proces. Aceste limite nu sunt globale intre instante Vercel.
Inainte de expunere publica, endpoint-ul necesita control global al consumului
si adaptarea backend-ului la Vercel. Integrarea AI nu face automat deployment.

Documentatie: https://developers.openai.com/api/docs/guides/structured-outputs
si https://project-osrm.org/docs/v5.22.0/api/.
