# Zadávací specifikace pro implementaci: LTx Pathway

Pracovní název: LTx Pathway (Lung Transplant Pathway)

Verze: 2.0 (konsolidovaná, zúžený scope dle klinického brainstormingu)

Tento dokument sjednocuje předchozí dílčí podklady (cesta pacienta, role, řízení toku, protokoly) do jednoho implementačního zadání. Je psaný jako podklad pro vývojový tým.

---

## 1. Účel a kontext

Transplantace plic je dlouhá cesta pacienta přes mnoho rukou: od ambulantního pneumologa, přes vyšetření a rozhodnutí týmu v centru, samotnou transplantaci, až po doživotní sledování. Dnes tahle cesta drží pohromadě přes maily, papír, telefon a WhatsApp. Cílem systému není přepsat celou nemocnici, ale posílit ta místa, kde to nejvíc pomůže pacientovi a týmu a kde nedublujeme existující nemocniční systémy.

Centrem transplantace plic v ČR je FN Motol (jediné centrum, slouží i Slovensku).

---

## 2. Záměrné vymezení: toto NENÍ zdravotnický prostředek

Systém je organizační, workflow a data management nástroj. Spravuje pacienty, dokumenty, stavy procesu, úkoly, komunikaci a zobrazuje data a trendy.

Systém nestanovuje diagnózu, negeneruje závazná klinická doporučení a nerozhoduje o léčbě. Veškerá upozornění jsou informativní podněty k posouzení a o každém kroku rozhoduje zdravotník. Tato povaha musí být v UI viditelná: u každého výpočtu a podnětu je disclaimer o informativní povaze. Důvod: drží to MVP mimo režim MDR a zároveň nebrání pozdějšímu přechodu na certifikovanou verzi.

Všechny výpočty (trend FEV1, baseline, kategorie BOS) jsou deterministické vzorce nad zadanými daty, ne predikce.

---

## 3. Rozsah MVP: tři úrovně hloubky

Toto je nejdůležitější sekce pro odhad práce. Ne všechny fáze se implementují stejně. Cesta pacienta má šest fází, ale plně se staví jen dvě.

**Plně (jádro, kde je hodnota):**
- Fáze 4: Na čekací listině (pacientská aplikace plus správa listiny).
- Fáze 6: Po transplantaci, dlouhodobé sledování (pacientská aplikace plus follow-up).

**Lehce (aby cesta držela, ne do detailu):**
- Fáze 1: Odeslání (jednoduchý formulář plus přílohy).
- Fáze 2: Příjem a vyšetření v centru (záznam o hospitalizaci plus podklady, ne detailní checklist vyšetření).
- Fáze 3: Rozhodnutí týmu (záznam výroku a větvení, ne plný konziliární modul).
- Fáze 5: Transplantace (jednoduchý záznam výkonu).

**Vize do budoucna (mimo MVP, viz sekce 12):**
- Plný indikační seminář s prouděním informací a podklady (nedublovat nemocniční systém).
- Koordinace nabídek orgánů (dnes přes WhatsApp).
- Integrace na nemocniční systémy a KST.
- Vodítka pro včasné odeslání (řešení pozdního záchytu).

---

## 4. Cesta pacienta a stavový model

Pacient prochází stavovým automatem. Ambulantní pneumolog stojí na začátku i na konci cesty (pacient u něj vychází a po transplantaci se k němu vrací).

| Stav | Název | Hloubka |
|---|---|---|
| `ODESLANI` | Péče a odeslání (ambulantní pneumolog) | lehce |
| `PRIJEM` | Příjem a vyšetření v centru | lehce |
| `ROZHODNUTI` | Představení týmu a rozhodnutí | lehce (záznam výroku) |
| `WL` | Na čekací listině | plně |
| `TX` | Transplantace | lehce (záznam) |
| `SLEDOVANI` | Po transplantaci, zpět v péči pneumologa | plně |
| `UKONCENO` | Ukončeno (zamítnut, exitus, ztráta sledování) | lehce |

Větvení u stavu `ROZHODNUTI`:
- Zamítnuto: přechod na `UKONCENO` s důvodem, pacient se vrací k ambulantnímu pneumologovi a pokračuje dosavadní léčba.
- Zařazen: přechod na `WL`.

---

## 5. Role

Devět rolí. Každá má v demu předpřipravený účet pro přepínání.

| Role | Poznámka |
|---|---|
| Ambulantní pneumolog | odesílá pacienta, sleduje ho před i po transplantaci |
| Transplantační pneumolog | posuzuje, vede follow-up; může být i ze Slovenska |
| Transplantační chirurg | provádí výkon |
| Anesteziolog a intenzivista | perioperační a časná pooperační péče |
| Transplantační koordinátor | řídí tok, spravuje čekací listinu, administrativa |
| Psycholog | samostatná role, velká úloha v edukaci a přípravě pacienta |
| Rehabilitační pracovník / Fyzioterapeut | může být lékař i nelékař, prerehabilitace a rehabilitace |
| Pacient | aktivní hlavně na čekací listině a po transplantaci |
| Datová vrstva (administrátor) | přístup k datům pro oprávněné napříč obory, správa číselníků |

Role pečovatel a samostatní konziliáři se neimplementují (pacient má vlastní účet i když o něj někdo pečuje; konzilia se odehrávají v nemocničním systému a nedublujeme je).

---

## 6. Viditelnost a oprávnění

Princip viditelnosti:
- Ambulantní pneumolog vidí jen své odeslané pacienty a jejich stav.
- Koordinátor vidí všechny pacienty a řídí tok.
- Transplantační tým (pneumolog, chirurg, anesteziolog, psycholog, rehabilitace) vidí pacienty v centru, každý svou agendu.
- Pacient vidí jen sebe, a jen v relevantních fázích (hlavně čekací listina a po transplantaci).

**Hranice tým vs. vnějšek (MVP demo):**
- Uvnitř týmu centra nejsou per-dokument přepínače - vše je interní, kromě explicitně označené „sdílené zprávy pro odesílatele“ (`shared_ambulatory`).
- Pacient **nedostává** surové týmové podklady (flowEvidence, výstupy vyšetření); vidí edukaci, kontakty, plán kontrol a vlastní domácí záznamy.
- Ven z týmu jde jen typ dokumentu „sdílená zpráva pro odesílatele“ - typicky jedna zpráva na přechod fáze; ostatní podklady zůstávají interní.
- Výstup fáze = informativní notifikace pneumologovi + sdílená zpráva, **ne systémový úkol**.

Oprávnění se v MVP zjednodušují na úrovně: čtení, zápis, rozhodnutí, správa. Kritické pro implementaci: kontrola přístupu musí být vynucená na backendu, ne jen schováním prvku v UI. Zejména datový rozsah: ambulantní pneumolog nesmí vidět cizí pacienty ani po změně identifikátoru v requestu.

---

## 7. Řízení toku

Tok řídí transplantační koordinátor. Je vlastníkem přepínání stavů ve všech fázích, s jedinou výjimkou: úplně první krok, odeslání, iniciuje ambulantní pneumolog (tím se pacient v systému vůbec objeví).

Klíčové rozlišení: koordinátor stavy přepíná, ale klinicky nerozhoduje. O zařazení na čekací listinu rozhodne tým, koordinátor ten výrok jen zaznamená a promítne do stavu.

| Přechod | Provede (přepne stav) | Klinicky rozhodne |
|---|---|---|
| Vznik odeslání | Ambulantní pneumolog | Ambulantní pneumolog |
| Přijetí a naplánování vyšetření | Koordinátor | Transplantační pneumolog |
| Příprava na tým | Koordinátor | Transplantační pneumolog |
| Zamítnuto, návrat k pneumologovi | Koordinátor | Tým |
| Zařazen na čekací listinu | Koordinátor | Tým |
| Nabídka orgánu a transplantace | Koordinátor | Chirurg, transplantační pneumolog |
| Přechod na dlouhodobé sledování | Koordinátor | Transplantační pneumolog |

Brány přechodů: v MVP je většina přechodů volná (koordinátor řídí). Kde dává smysl podmínka (například chybějící podpis při zařazení), platí měkká brána: systém upozorní, ale oprávněná role smí přechod provést přes override s povinným odůvodněním, které se zaloguje do auditu. Tvrdé blokující brány nejsou v MVP potřeba, protože detailní evaluace se neimplementuje.

---

## 8. Funkční specifikace po fázích

### 8.1 ODESLANI (lehce)
Přepne do něj: ambulantní pneumolog.

Funkce: jednoduchý odesílací formulář (identifikace pacienta, diagnóza, důvod odeslání, stručné klíčové parametry) s možností přiložit dosavadní vyšetření a zprávy jako přílohy. Generuje se odesílací záznam. Pneumolog sleduje stav svého odeslání. Koordinátor vidí nově příchozí odeslání ve frontě.

Výstup: odesílací záznam plus přílohy.

### 8.2 PRIJEM (lehce)
Přepne do něj: koordinátor.

Funkce: koordinátor převezme pacienta a naplánuje vyšetření (hospitalizaci). Vyšetření probíhá jako jedna hospitalizace, systém pouze eviduje, že proběhlo a vznikly podklady (přílohy a zprávy). Neimplementuje se detailní checklist jednotlivých vyšetření. Transplantační pneumolog vidí pacienta a přiložené nálezy.

Výstup: záznam o hospitalizaci plus podklady.

### 8.3 ROZHODNUTI (lehce, záznam výroku)
Přepne do něj: koordinátor (zaznamená výrok týmu). Rozhodnutí dělá tým.

Funkce: systém zaznamená výrok týmu (zařadit nebo zamítnout) s poznámkou. Neimplementuje se plný konziliární modul s pozvánkami, kolováním dokumentů ani hlasováním (to je vize, nedublovat nemocniční systém). Po zaznamenání výroku koordinátor přepne stav podle větvení.

Větvení:
- Zamítnuto: přechod na `UKONCENO`, ambulantní pneumolog dostane informaci, pokračuje dosavadní léčba.
- Zařazen: přechod na `WL`.

Výstup: záznam rozhodnutí.

### 8.4 WL: Na čekací listině (PLNĚ, jádro)
Přepne do něj: koordinátor.

Správa listiny (koordinátor): zařadí pacienta, vede jeho status a čekací dobu, plánuje opakovaná vyšetření, přijímá hlášení zhoršení.

Pacientská aplikace: viz sekce 9.1.

Tým: psycholog a rehabilitace zpřístupňují edukaci a prerehabilitaci a drží kontakt. Transplantační pneumolog reaguje na hlášení zhoršení.

### 8.5 TX: Transplantace (lehce, záznam)
Přepne do něj: koordinátor.

Funkce: jednoduchý záznam o výkonu (typ, datum, kdo). Chirurg a anesteziolog doplní základní záznam o výkonu a časném pooperačním průběhu. Neimplementuje se detailní perioperační modul ani koordinace nabídek orgánů (vize).

Výstup: záznam o výkonu.

### 8.6 SLEDOVANI: Po transplantaci (PLNĚ, jádro)
Přepne do něj: koordinátor.

Pacientská aplikace: viz sekce 9.2.

Tým: transplantační pneumolog sleduje trendy, reaguje na informativní podněty, vede follow-up (nejvíce v prvním období). Ambulantní pneumolog postupně přebírá dlouhodobé sledování a vidí data pacienta. Rehabilitace pokračuje.

---

## 9. Pacientská aplikace (jádro systému)

Pacient se aktivně zapojuje ve dvou fázích. Aplikace musí být jednoduchá a přístupná i pro starší a méně zdatné uživatele.

### 9.1 Na čekací listině

**Edukace (složka, ke které se pacient kdykoli vrátí):**
- Videa o transplantaci (jak proběhne, co pacienta čeká).
- Dechová cvičení a prerehabilitace (videa od fyzioterapeutů).
- Zkušenosti a komunikace od pacientů, kteří už zákrok podstoupili (komplikace, úskalí).

**Kontakty:**
- Na transplantačního pneumologa, psychologa, rehabilitaci a oddělení (chirurgie).

**Plánovaná vyšetření:**
- Seznam s místem a časem. Během čekání se některá vyšetření opakují, pacient má přehled, co a kdy ho čeká.

**Hlášení zhoršení stavu:**
- Pacient může nahlásit zhoršení: dušnost nebo zhoršení fyzické aktivity, známky infekce (teplota, kašel), bolesti na hrudi.
- Po odeslání hlášení jde upozornění koordinátorovi nebo pneumologovi. Důvod: nemocný pacient nemůže být transplantován, takže centrum musí o zhoršení vědět.
- Hlášení je jednoduché odkliknutí, na které pak aktivně reaguje člověk z týmu.

### 9.2 Po transplantaci

**Domácí sledování (pacient zadává):**
- Spirometrie (FEV1), tělesná hmotnost, krevní tlak, teplota, saturace SpO2.
- Příznaky (dušnost, kašel, charakter sputa, horečka, bolesti).
- Užití léků (adherence).

**Trendy a přehled:**
- Graf vývoje FEV1 oproti baseline (baseline je průměr dvou nejvyšších poperačních hodnot). Barevné zóny podle kategorie BOS slouží jako orientační kontext, s disclaimerem o informativní povaze.
- Plán kontrol.

**Edukace** pokračuje i zde.

### 9.3 Informativní podněty (rule engine, ne diagnostika)

Z hlášení a měřených dat vznikají informativní podněty pro tým, vždy označené jako informativní a s nastavitelnými prahy, aby se omezila zahlcenost upozorněními:
- Pokles FEV1 oproti baseline (mírný a výraznější práh).
- Teplota nad nastavený práh, nízká saturace, vynechání léků.
- Hlášení zhoršení od pacienta (na čekací listině i po transplantaci).
- Chybějící data pacienta delší dobu (organizační podnět koordinátorovi).

Každý podnět má frontu, přiřazení odpovědné osobě a stav (nový, v řešení, vyřešeno). O reakci rozhoduje člověk.

Úrovně podnětů se pojmenovávají slovně (kritická, varovná, informativní). Barva je jen vizuální kód, ne název kategorie.

---

## 10. Datový model (klíčové entity)

```
Patient (+ stav) ─┬─ Referral (odeslání + přílohy)
                  ├─ ExaminationRecord (záznam hospitalizace + podklady)
                  ├─ BoardDecision (výrok týmu: zařadit / zamítnout + poznámka)
                  ├─ WaitlistEntry (status, čekací doba)
                  ├─ Surgery (záznam výkonu)
                  ├─ EducationContent (videa, materiály, sdílené)
                  ├─ Contact (kontakty na tým)
                  ├─ PlannedExam (plánovaná vyšetření: co, kde, kdy)
                  ├─ SymptomReport (hlášení zhoršení)
                  ├─ Measurement (FEV1, váha, TK, teplota, SpO2)
                  ├─ SelfReport (denní záznamy pacienta)
                  ├─ Alert (informativní podněty)
                  ├─ Document (přílohy a generované záznamy)
                  ├─ Task (úkoly napříč rolemi)
                  └─ AuditEntry (kdo co kdy, včetně override)
```

Číselníky: diagnózy, role, statusy, typy podnětů, kontakty.

---

## 11. Průřezové moduly

**Dokumenty:** přílohy a generované záznamy vázané na pacienta a fázi (odesílací záznam, záznam hospitalizace, záznam rozhodnutí, záznam výkonu). U týmem vytvořených podkladů platí dvě zóny: interní tým vs. sdílená zpráva pro odesílatele; pacient nedostává surové týmové PDF.

**Úkoly a notifikace:** úkoly napříč rolemi s termínem a vlastníkem. Notifikace in-app, koncepčně e-mail a SMS. Fronta informativních podnětů. Při přechodu fáze centrum informuje odesílajícího pneumologa in-app zprávou (ne úkolem) s odkazem na sdílenou zprávu.

**Audit log:** každá změna stavu, override a přístup k datům jsou logovány (kdo, co, kdy).

**Dashboardy podle role:** každá role po přihlášení vidí svou agendu (ambulantní pneumolog své pacienty a jejich stav; koordinátor frontu odeslání, čekací listinu, úkoly a podněty; transplantační pneumolog pacienty k posouzení a follow-up s podněty; pacient své úkoly, trend a edukaci). Manažerský přehled (anonymizovaně): počet odeslání, konverze odeslání na zařazení, počet na listině, počet transplantací, adherence pacientů.

**Správa rolí:** přiřazení rolí a přepínání demo person.

---

## 12. Mimo MVP (vize do budoucna)

- Plný indikační seminář: proudění informací, pozvánky, podklady, úkoly pro pneumology po rozhodnutí (dnes přes maily a papír, nedublovat nemocniční systém).
- Koordinace nabídek orgánů (dnes přes WhatsApp, ad hoc okruh lidí podle nabídky).
- Integrace na nemocniční informační systémy a na KST (alokace, registr).
- Vodítka pro včasné odeslání (kritéria pro pozdní záchyt na straně ambulantního pneumologa).
- Standardy interoperability (HL7 FHIR, DICOM).
- Certifikace zdravotnického prostředku, AI vyhodnocování.
- Vícevertikálová konfigurace (jiné transplantace, jiné chronické dráhy).

---

## 13. Akceptační kritéria

- Lze se přihlásit za každou z devíti rolí a vidět odpovídající dashboard.
- Ambulantní pneumolog vytvoří odeslání s přílohami a vidí jen své pacienty.
- Koordinátor řídí celý tok: přijme, naplánuje, zaznamená výrok týmu, zařadí na listinu, posune na transplantaci a na sledování.
- U rozhodnutí funguje větvení: zamítnuto vrací pacienta k pneumologovi, zařazen ho posune na čekací listinu.
- Pacient na čekací listině vidí edukaci, kontakty, plánovaná vyšetření a může nahlásit zhoršení stavu, na které tým reaguje.
- Pacient po transplantaci zadává domácí měření a vidí svůj trend FEV1.
- Rule engine vygeneruje informativní podnět (z hlášení zhoršení i z poklesu FEV1) a tým ho odbaví ve frontě.
- Měkká brána umožní override s povinným odůvodněním a zápisem do auditu.
- Všechny výpočty a podněty nesou viditelný disclaimer o informativní povaze.
- Úrovně podnětů jsou pojmenované slovně, barva je jen vizuální kód.

---

## 14. Technický rámec (orientačně)

- Webová aplikace (responzivní) pro klinické role, jednoduché rozhraní nebo PWA pro pacienta.
- Role-based access control vynucený na backendu, přepínání demo person.
- Relační databáze, REST nebo GraphQL API.
- Generování PDF záznamů ze šablon.
- Rule engine pro informativní podněty s konfigurovatelnými prahy.
- Úložiště pro edukační videa.
- Seedovaná demo data (pacienti v různých fázích, uživatelé, číselníky, edukační obsah).
- Audit log napříč entitami.
- Integrační vrstva (nemocniční systémy, KST, FHIR) je koncepčně připravená, v MVP neaktivní nebo mockovaná.
