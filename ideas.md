# Holon Control Panel — Design Brainstorm

## Kontekst
Dashboard operacyjny dla infrastruktury Holon Mesh: 12 Aniołów Stróżów, Coolify, Supabase, Cloudflare Workers, Redis, Ollama — wszystko na jednym ekranie.

---

<response>
<text>
## Idea A — "Neural Command Center" (Cyberpunk Ops)

**Design Movement:** Dark Ops / Cyberpunk Terminal Aesthetic
**Core Principles:**
1. Ciemne tło z neonowymi akcentami — poczucie centrum dowodzenia
2. Dane zawsze na pierwszym planie — zero dekoracji bez funkcji
3. Asymetryczna siatka paneli — jak prawdziwy NOC (Network Operations Center)
4. Animowane wskaźniki statusu — pulsujące, żywe

**Color Philosophy:** Czarne tło `#0a0a0f`, neonowa zieleń `#00ff88` dla healthy, czerwień `#ff3366` dla error, złoto `#ffd700` dla warning. Paleta inspirowana terminalami wojskowymi.

**Layout Paradigm:** Asymetryczna siatka 3-kolumnowa z lewym sidebarem nawigacyjnym, centralnym panelem głównym i prawym paskiem alertów. Panele można "minimalizować" jak okna terminala.

**Signature Elements:**
- Scanline overlay (subtelny efekt CRT)
- Pulsujące kropki statusu z animacją `ping`
- Monospace font dla danych numerycznych

**Interaction Philosophy:** Kliknięcie na Anioła otwiera jego terminal w overlay. Hover na metrykę pokazuje sparkline historii.

**Animation:** Entrance animations z fade-in + slide-up. Statusy zmieniają się z płynnym crossfade. Alerty "wpadają" z prawej.

**Typography System:** `Space Mono` dla danych/terminali, `Inter` dla UI labels. Bold 700 dla wartości, Regular 400 dla opisów.
</text>
<probability>0.07</probability>
</response>

<response>
<text>
## Idea B — "Crystalline Infrastructure" (Glassmorphism + Geometric)

**Design Movement:** Glassmorphism + Sacred Geometry (nawiązanie do "Aniołów")
**Core Principles:**
1. Półprzezroczyste karty z backdrop-blur — warstwy informacji
2. Geometryczne ikony dla każdego Anioła (heksagony, trójkąty)
3. Gradient tło z głębią — ciemny granat do fioletu
4. Subtelne świecenie (glow) dla aktywnych elementów

**Color Philosophy:** Głęboki granat `#0d1b2a` jako tło, akrylowe białe karty z 15% opacity, akcentowy błękit `#4fc3f7` i fiolet `#ce93d8`. Inspiracja: kryształy i konstelacje.

**Layout Paradigm:** Centralny grid z kartami Aniołów w układzie 4x3, górny pasek z globalnymi metrykami, lewy sidebar z nawigacją sekcji.

**Signature Elements:**
- Heksagonalne karty Aniołów
- Gradient borders (border-image z gradientem)
- Particle background (subtelne gwiazdy/punkty)

**Interaction Philosophy:** Hover na kartę Anioła powoduje "rozświetlenie" i pokazanie szczegółów. Kliknięcie otwiera drawer z pełnym statusem.

**Animation:** Karty wchodzą z staggered fade-in (każda 50ms później). Statusy animowane przez CSS transitions. Glow pulsuje dla unhealthy.

**Typography System:** `Outfit` (nowoczesny, geometryczny) dla nagłówków, `JetBrains Mono` dla metryk technicznych.
</text>
<probability>0.09</probability>
</response>

<response>
<text>
## Idea C — "Brutalist NOC" (Raw Data Brutalism)

**Design Movement:** Brutalist Web Design + Military Operations Center
**Core Principles:**
1. Surowe, gęste dane — maksymalna informacja na ekranie
2. Ostre krawędzie, zero zaokrągleń — precyzja wojskowa
3. Monochromatyczna baza z jednym kolorem akcentowym
4. Typografia jako element designu — wielkie litery, tracking

**Color Philosophy:** Czysta biel `#ffffff` tło, czarny `#000000` tekst, jeden akcent: intensywna czerwień `#e63946` dla alertów i aktywnych elementów. Zero gradientów.

**Layout Paradigm:** Pełnoekranowa siatka z twardymi liniami podziału. Każdy Anioł to prostokątny blok z danymi. Sidebar z listą i główna przestrzeń z detalami.

**Signature Elements:**
- Grube czarne linie podziału (2px borders)
- Wielkie litery dla statusów (HEALTHY / ERROR / UNKNOWN)
- Tabele zamiast kart

**Interaction Philosophy:** Kliknięcie selektuje wiersz jak w spreadsheet. Brak animacji — dane zmieniają się natychmiast.

**Animation:** Minimalne — tylko blink dla alertów krytycznych.

**Typography System:** `IBM Plex Mono` dla wszystkiego. Bold dla statusów, Regular dla danych.
</text>
<probability>0.06</probability>
</response>

---

## Wybór: **Idea A — "Neural Command Center"**

Ciemny, neonowy dashboard operacyjny z pulsującymi wskaźnikami statusu, asymetryczną siatką paneli i terminalowym charakterem. Idealny dla centrum dowodzenia infrastrukturą AI.
