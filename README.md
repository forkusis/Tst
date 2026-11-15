# Rotacija kapitala — sa svežim podacima, dva puta dnevno, besplatno

Ovaj folder je ista ona aplikacija (`07jdr9.html`) ali **bez ugrađenih podataka**.
Podatke više ne nosi u sebi: oni se preuzimaju sa Yahoo Finance i objavljuju kao
jedan fajl `history.json`, a aplikacija ga učita pri otvaranju.

---

## 1. Kratak odgovor na tvoja pitanja

| Pitanje | Odgovor |
|---|---|
| Treba li GitHub repo? | **Da** — ali ne zbog cron-a. Repo je mesto gde živi kod i odakle se besplatno servira sajt (GitHub Pages). |
| Treba li Cloudflare? | **Ne, nije obavezan.** Sve radi na GitHub-u. Cloudflare (ili cron-job.org) je samo *rezervni tajmer* ako želiš da pokretanje bude tačno na minut. |
| Treba li D1 / baza / KV / R2? | **Ne.** „Baza" je jedan JSON fajl od ~2 MB. Statički sajt ga servira, pretraživač ga kešira. Baza bi samo dodala komplikaciju i rizik. |
| Koliko košta? | **0 evra.** Javni repo = neograničeni besplatni Actions minuti i Pages saobraćaj. |
| Zašto GitHub cron „kasni"? | GitHub pokreće zakazane poslove u redu čekanja — nekad 5, nekad 40 minuta posle zadatog vremena. Za dnevne (EOD) podatke to je nebitno. Ako baš želiš tačnost, vidi §6. |
| Šta ako GitHub padne? | Sajt nastavlja da radi sa poslednjim uspešnim podacima. Aplikacija ti napiše koliko su stari. |

## 2. Kako to radi

```
┌──────────────────────────────┐
│ GitHub Actions (tajmer)      │  21:17 UTC i 10:07 UTC, radni dani
│  1. node scripts/fetch.mjs   │  → Yahoo Finance chart v8, 59 ETF-ova, 3 god.
│  2. node test/check-app.mjs  │  → provera da app radi sa novim brojevima
│  3. upload + deploy Pages    │  → objavi app/ kao sajt
└──────────────┬───────────────┘
               ▼
     https://<tvoj-nalog>.github.io/<repo>/
        index.html  +  history.json
               ▼
   Telefon: otvoriš link → app učita history.json → svi paneli sveži
```

Bitno: **ako preuzimanje padne, ništa se ne objavljuje** — ostaje prethodna, ispravna verzija.
Ako padne samo par tickera (npr. 2 od 59), objavi se ostalo, a u zaglavlju piše
„⚠ nedostaje N ticker(a)".

## 3. Šta je unutra

```
rotacija/
├── app/
│   ├── index.html          ← aplikacija (analitika je ista kao u originalu)
│   └── history.json        ← poslednji preuzeti podaci (seed, menja se pri svakom run-u)
├── catalog/tickers.json    ← koje instrumente pratimo + „sobe" (grupe)
├── scripts/fetch.mjs       ← preuzimanje (Node 18+, bez ijedne biblioteke)
├── test/check-app.mjs      ← test bez browsera: učita history.json i proveri sve panele
├── dev-server.mjs          ← lokalni server + /api/refresh (pravo preuzimanje na dugme)
├── server.sh               ← start / stop / restart / status / log
└── .github/workflows/update-data.yml  ← tajmer + objava
```

### Izmene u odnosu na original

1. **Ugrađeni podaci (4,4 MB) su izbačeni.** Fajl je sada 70 KB i učitava se trenutno.
2. Aplikacija **sama povlači `history.json`** (`./history.json`, može i `?data=<url>`).
3. **Jasna oznaka svežine** u zaglavlju: `DATA: OK · 59 tickera · D do 2026-11-02 · W do … · osveženo …`
   Ako su podaci stariji od 36h — zaglavlje požuti i piše `⚠ podaci stari Nh`.
4. Ako nema mreže, piše tačan razlog (npr. `HTTP 404`) i nudi ručno učitavanje fajla.
5. Uklonjeno je duplo crtanje tabova (bug iz originala) i duplirani init.

## 4. Postavljanje (10 minuta, jednom)

### 4.1 Napravi repo

1. `https://github.com/new` → ime npr. `rotacija` → **Public** (besplatni Actions bez limita)
   → *Create repository*.
2. Pošalji ovaj folder u repo. Sa telefona najlakše preko GitHub web interfejsa
   (*Add file → Upload files*) — ali `history.json` je 2 MB, pa je bolje:

```bash
cd /root/projects/prvi/rotacija
git init -b main
git add .
git commit -m "rotacija: sveži podaci 2x dnevno"
git remote add origin https://github.com/<tvoj-nalog>/rotacija.git
git push -u origin main
```

### 4.2 Uključi Pages

Repo → **Settings → Pages** → *Build and deployment* → **Source: GitHub Actions**.
(to je sve — nema grane `gh-pages`, nema build koraka u repou)

### 4.3 Pokreni prvi put ručno

Repo → **Actions** → *Osveži podatke i objavi app* → **Run workflow**.
Za ~2 minuta dobijaš link: `https://<nalog>.github.io/rotacija/`

### 4.4 Provera

Na linku u zaglavlju treba da piše `osveženo <današnji datum>`.
Ako piše greška — otvori Actions log, korak *Preuzmi sveže kotacije*.

## 5. Kako da dodaš/ukloniš instrument

Sve je u `catalog/tickers.json`:

```json
{
  "rooms": [
    { "id": "sectors", "name": "US Sektori", "bench": "SPY", "list": ["XLE", "XLB", ...] }
  ],
  "tickers": {
    "SPY": { "name": "S&P500", "type": "ETF", "group": "benchmark" },
    "AAPL": { "name": "Apple", "type": "STOCK", "group": "tech" }
  }
}
```

Dodaj ticker u `tickers` (i, ako želiš, u neku `list`) → sačuvaj → pokreni workflow.
Yahoo prihvata i akcije (`AAPL`), i kripto (`BTC-USD`), i indekse (`^GSPC`).
Ne treba menjati kod. Gornja granica: ~120 tickera po run-u (traje ~2 min).

## 6. Ako želiš tačan tajmer (opciono, i dalje besplatno)

GitHub cron može da zakasni. Dva načina da se to „zakuca":

**A) cron-job.org** (najlakše): besplatan nalog → *Create cronjob* → URL:

```
https://api.github.com/repos/<nalog>/<repo>/actions/workflows/update-data.yml/dispatches
```

metod **POST**, header `Authorization: Bearer <fine-grained PAT sa pravom Actions: write>`,
body `{"ref":"main"}` → raspored `17 21 * * 1-5` i `7 10 * * 1-5`.

**B) Cloudflare Worker** (ako već imaš nalog, isti princip kao `binance-withdrawal-alert`):
worker sa cron trigger-om koji radi jedan `fetch` na isti GitHub URL sa tokenom u secret-u.
Pošto je to **jedan** zahtev, ostaje daleko ispod besplatnih limita (10 ms CPU, 50 subrequest-a).

U oba slučaja posao i dalje radi GitHub — spolja se samo pritiska dugme na vreme.

## 7. Troškovi i limiti (realno)

| Stavka | Besplatni limit | Naša potrošnja |
|---|---|---|
| Actions minuti (javni repo) | neograničeno | ~2 min × 2/dan |
| Pages saobraćaj | 100 GB/mesec (soft) | ~2 MB po otvaranju, keširano |
| Veličina fajla | 100 MB po fajlu | 2,1 MB |
| Repo bez aktivnosti 60 dana | cron se gasi | ne važi — svaki run je aktivnost |

## 8. Poznati rizici

* **Yahoo Finance nije zvanični API.** Povremeno vraća 429 (previše zahteva) ili menja format.
  Skript zato ima 4 pokušaja, dva hosta, pauzu između tickera i toleranciju na pojedinačne padove.
  Ako jednog dana Yahoo zatvori vrata, menja se samo `fetchTicker()` — sve ostalo ostaje.
  Rezervni izvori (Stooq, Tiingo) mogu se dodati u istu funkciju.
* **Podaci su EOD** (kraj dana), ne intraday. Dva run-a dnevno znače: posle zatvaranja dobijaš
  konačne brojeve, ujutru eventualne ispravke. Nema „uživo" cene — za to treba plaćen feed.
* **Adjusted close** uključuje dividende (total return) — to je ispravno za relativnu snagu.

## 9. Paljenje i gašenje lokalnog pregleda

Server je **običan proces**, ne servis — ne pali se sam. Umire kada zatvoriš
OpenCode Mobile aplikaciju / Ubuntu, ili kada Android-u ponestane memorije.

```bash
cd /root/projects/prvi/rotacija
./server.sh start      # podigne i ispiše link
./server.sh status     # radi li + koliko su podaci stari
./server.sh stop       # ugasi
./server.sh restart    # ugasi pa podigne
./server.sh log        # zadnjih 20 linija dnevnika
```

Ako link ne otvara ništa, prvo `./server.sh status` — ako piše „NE RADI", uradi `start`.
Na GitHub Pages ovaj problem ne postoji: tamo nema procesa, sajt uvek stoji.

## 10. Lokalno, bez ičega

```bash
cd /root/projects/prvi/rotacija
node scripts/fetch.mjs --range 3y     # ~45 s, pravi app/history.json
node test/check-app.mjs               # provera bez browsera
./server.sh start                     # http://127.0.0.1:8088
./server.sh stop                      # ugasi
```

Lokalno dugme **„Osvježi podatke"** stvarno preuzima nove kotacije: aplikacija tada
pozove `POST /api/refresh` na `dev-server.mjs`, koji pokrene `scripts/fetch.mjs`
(~45 s) i vrati sveže `history.json`. Taj endpoint postoji **samo lokalno** — na
GitHub Pages nema servera, pa dugme tamo samo ponovo učita fajl (a podatke menja
tajmer 2× dnevno).

Zašto posle klika nekad i dalje piše isto: ako je berza zatvorena ili je podatak već
najsvežiji, `latestD` se ne menja — to nije greška. Gledaj `D do …` i `osveženo …`:
ako se `osveženo` promenilo, preuzimanje je radilo.
