# Video dimostrativo: evoluzione dei browser

`browsers-evolution-1080x1920.mp4` (41 s, 1080×1920, H.264 + AAC) è stato generato con Bounce Studio e il preset **Evolution**:
sedici palline *Explorer* entrano dal tubo una alla volta; quando due uguali si toccano si fondono nella forma successiva
(Explorer → Edge → Safari → Chrome → Brave) con un suono per ogni passaggio, fino a quando resta un solo Brave.

Per riprodurlo o modificarlo: apri https://pippopoppi.github.io/bounce-studio/, in Settings → Run usa **Load JSON** con
`browsers-evolution.json` (immagini incluse), premi **▶ Play** o **⏺ Record**. Stesso seed = stesso video; cambia il seed per una
variante (non tutti i seed arrivano alla forma finale entro la durata).

I loghi dei browser appartengono ai rispettivi proprietari e sono usati solo a scopo illustrativo; quattro provengono da
Wikimedia Commons, l'icona di Safari è disegnata a mano.

## Vivek → Vance → Vance meme → Trump

`vivek-to-trump.json`: stessa meccanica, catena a quattro livelli. Sedici *Vivek* entrano dal tubo; due Vivek diventano un
*JD Vance*, due Vance diventano un *Vance meme* (caricatura con le guance gonfie), due Vance meme diventano un *Trump*, e Trump
non si trasforma più: continua a rimbalzare. Tutti i livelli hanno la stessa dimensione (raggio 120 px) e la fusione è uno scambio istantaneo; inquadratura 2000×2200 con un anello arcobaleno da 700 px, tubo e ostacoli dello stesso colore dell'anello. Con il seed 12 tutti sono diventati Trump dopo circa 22 s (in Chrome/Edge; Firefox arrotonda la trigonometria in modo diverso e dopo ~20 s di rimbalzi caotici può divergere); la durata è di 45 s.
Quando due Trump si scontrano parte un audio («Bing! Bing! Bing! Hear ye, hear ye, hear ye») preso da un discorso pubblico di Donald Trump diffuso su X, usato solo a scopo parodistico. Il file completo (13 s) è incluso nel JSON; la parte riprodotta (0,35–7,3 s) si regola con il clipper nel riquadro Trump/Trump (Characters → Character vs character), e il cooldown di 7 s la fa sentire per intero.
Le foto sono ritratti ufficiali (pubblico dominio) e, per Vivek Ramaswamy, una foto di Gage Skidmore (CC BY-SA 2.0, Wikimedia
Commons); il "Vance meme" è l'immagine virale fornita dall'autore. Per cambiare un volto: Characters → tipo → Upload image.

## Pianeti: Luna → Terra → Giove → Sole

`planets-to-sun.json`: video 1080×1920 scelto e assemblato da Claude. Sedici *Lune* entrano dal tubo in un anello bianco su fondo nero;
due Lune diventano una *Terra*, due Terre un *Giove*, due Giovi un *Sole*; il Sole non si trasforma più. Ogni fusione suona un
rintocco sempre più acuto e, quando due Soli si scontrano, parte la radio dell'Apollo 13 («Okay, Houston, we've had a problem here»,
clip 0–9,2 s del file incluso, cooldown 9,5 s). Con il seed 2 tutti sono diventati Sole dopo circa 29 s (in Chrome/Edge e in Firefox);
titolo «Will they all become Suns?».

Immagini e audio da Wikimedia Commons: Luna — *FullMoon2010* di Gregory H. Revera (CC BY-SA 3.0); Terra — *The Blue Marble*,
Apollo 17 (NASA, pubblico dominio); Giove — Hubble, *Jupiter and its shrunken Great Red Spot* (NASA/ESA, pubblico dominio);
Sole — Solar Dynamics Observatory AIA, 19 agosto 2010 (NASA, pubblico dominio); audio — Apollo 13, *Houston, we've had a problem*
(NASA, pubblico dominio).

## Confronto tra AI: 2 ChatGPT = 1 Claude

`ai-to-claude.json`: confronto scherzoso, non un'evoluzione. Sedici *Grok* entrano dal tubo; due Grok valgono un *Gemini*, due Gemini
un *ChatGPT*, due ChatGPT un *Claude*, e Claude resta Claude. Stessa arena e stessa fisica del video dei pianeti (seed 2: tutti Claude
dopo circa 28 s); quando due Claude si scontrano suona la fanfara integrata. I loghi provengono da Wikimedia Commons e appartengono
ai rispettivi proprietari; sono usati solo a scopo illustrativo.

## Modelli nello studio

Tutti questi JSON compaiono in Bounce Studio in Settings → **Templates** (elenco e descrizioni in `templates.json`): scegli e premi
**Load template**. Al build il sito li copia in `templates/`, quindi per aggiungerne uno basta mettere il file in questa cartella e
una riga in `templates.json`.

## Quale paese sopravvive? (battaglia di bandiere)

`countries-escape.json`: sedici bandiere in un anello arcobaleno che ruota con un'apertura. Chi esce è eliminato («France is out!»),
in alto il contatore «N left», l'ultima bandiera dentro vince. Pensato per i video brevi: 5 eliminazioni nei primi 4 secondi come
gancio, poi il ritmo rallenta fino a un duello finale di circa 9 s. Con il seed 29 vince il Brasile contro la Turchia dopo circa 27 s
(Chrome/Edge; anche Firefox, a 29,7 s). Per un altro vincitore basta cambiare il seed (🎲 New seed). Bandiere nazionali da Wikimedia
Commons (pubblico dominio).

## Ogni rimbalzo cresce (In the Hall of the Mountain King)

`grow-every-bounce.json`: una sola pallina in un anello arcobaleno, a velocità costante. A ogni rimbalzo sul bordo cresce di 4,4 px
e suona la nota successiva di *Nell'antro del re della montagna* di Grieg (pubblico dominio, sintetizzata nel browser). Più cresce,
più i rimbalzi si fanno vicini, quindi la musica accelera da sola, proprio come il brano, fino a riempire il cerchio dopo circa 27 s
(107 note su 109). In alto «N% full», alla fine «It filled the circle!». A velocità costante il risultato è identico in Chrome e
Firefox. Altre melodie integrate: Inno alla gioia, Per Elisa, Twinkle Twinkle; oppure scrivi le tue note (Characters → Melody).
