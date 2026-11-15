# Rotation Intelligence – radna verzija 1

Rotation Intelligence prati relativnu snagu, moguće promene tržišnog vođstva i odnose između tržišnih grupa kroz dnevni i nedeljni pogled.

## Lokalno pokretanje

Najjednostavnije:
```bash
python3 -m http.server 8080
```
Otvori http://localhost:8080.

Ili koristi lokalni server sa osvežavanjem podataka:
```bash
./server.sh start
```
Zatim otvori http://127.0.0.1:8088. Server ima /api/health i /api/refresh.

## Moduli

1. Pregled tržišta
2. Tržišni kontekst
3. Rotacija / RRG
4. Relativna snaga i momentum
5. Volumen i aktivnost
6. Korelacije
7. Research Lab
8. Univerzum i benchmarki

Research Lab podržava više izabranih instrumenata i više benchmarka, uključujući poređenje matrice. Volumenski indikatori ne zahtevaju benchmark.

## Podaci

tickers.json je jedinstveni katalog. history.json sadrži dnevne i nedeljne serije.

Dnevni podaci koriste prilagođenu cenu zatvaranja za prinose, kao i sirove High/Low/Close i volumen za OHLCV indikatore. Nedeljne serije agregiraju nedeljni volumen, najviši High, najniži Low i poslednje zatvaranje. MFI se ne računa kada nedostaju dosledni sirovi OHLC podaci.

Workflow .github/workflows/ri-data.yml osvežava tržišne podatke dva puta tokom radnih dana i čuva prethodnu verziju ako preuzimanje ne prođe proveru. Zakazani workflow se aktivira kada se promena spoji u podrazumevanu main granu.

Workflow .github/workflows/ri-pages.yml objavljuje aplikaciju na GitHub Pages nakon spajanja u main. Stranica se objavljuje iz čiste kopije potrebnih fajlova, a ne iz celog izvornog repozitorijuma.

## Samostalni HTML

```bash
node build-standalone.mjs
```
Pravi dist/rotation-intelligence-YYYYMMDD.html sa ugrađenim katalogom i istorijskim podacima. Chart.js se i dalje učitava sa CDN-a.

## Testovi

```bash
node test-core.cjs
node check-app.mjs
node build-standalone.mjs
```

GitHub Actions automatski proverava sintaksu JavaScript-a, osnovne formule, sve tickere i aplikacionu strukturu na svakoj izmeni razvojne grane i na pull request-u ka main.

## Važna ograničenja

Relativna snaga, momentum, korelacija i volumen ne dokazuju direktno tokove kapitala. Benchmarki u katalogu su početna stručna podešavanja i mogu se menjati u Research Lab-u. Signali su analitički indikatori, ne obećanje budućeg prinosa niti investicioni savet.
