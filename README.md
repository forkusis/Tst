# Rotation Intelligence – radna verzija 1

Pokretanje lokalno:
```bash
python3 -m http.server 8080
```
Otvori http://localhost:8080

Uz index.html moraju biti core.js, app.js, styles.css, tickers.json i history.json.

Moduli: Pregled tržišta, Tržišni kontekst, Rotacija/RRG, Relativna snaga, Volumen i aktivnost, Korelacije, Research Lab i Univerzum.

MFI se računa samo kada serije sadrže dosledne sirove High/Low/Close i volumen podatke. Ako close sirovog porekla nedostaje, MFI se označava kao nedostupan umesto mešanja adjusted close i sirovih high/low podataka.

Benchmarki su radni predlog i mogu se menjati u Research Lab-u. Relativna snaga, korelacija i volumen sami po sebi ne dokazuju tokove kapitala. Ovo je analitički alat, ne investicioni savet.

Testovi:
```bash
node test-core.cjs
```
