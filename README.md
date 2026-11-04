# Bounce Studio

Generatore di video "bouncing ball" basati su fisica 2D, nello stile dei video virali con palline che rimbalzano a tempo di musica.
Carichi i tuoi personaggi (immagini) e i tuoi suoni, regoli la fisica, lanci la simulazione e registri un video pronto per TikTok, Reels e Shorts (verticale 1080×1920 di default; anche 16:9, quadrato, 4:5 o misure personalizzate).

**Usalo qui:** https://pippopoppi.github.io/bounce-studio/

Non è un gioco: è uno strumento di simulazione e produzione video. Tutto gira nel browser, nessun server.

## Cosa fa

- **Personaggi**: quanti tipi vuoi, ognuno con nome, colore, immagine (PNG/JPG/WebP, anche trasparente), raggio, massa, rimbalzo, attrito, numero di istanze, posizione e velocità iniziali, rotazione della texture, vite e regole di eliminazione. Il corpo fisico è sempre un cerchio, qualunque sia l'immagine.
- **Fisica**: Matter.js a passo fisso (indipendente dal frame rate), gravità regolabile o disattivabile, attrito, smorzamento, rimbalzo, limite di velocità anti-tunneling, seed casuale riproducibile, impulsi iniziali e periodici.
- **Arena e ostacoli**: cerchio, rettangolo, poligono, cerchio con apertura (i personaggi possono scappare), arena rotante; **tubo d'ingresso** (i personaggi fanno la fila e cadono nell'arena uno alla volta, a intervalli regolari, con ordine alternato/sequenziale/mescolato); anello arcobaleno (il tubo lo segue, e a scelta anche gli ostacoli); ostacoli circolari, piattaforme e barre rotanti, fissi o in movimento (avanti/indietro, orbita). Cinque preset pronti: *Pinball circle*, *Pipe drop*, *Evolution*, *Zero-G chaos*, *Escape ring*.
- **Evoluzione (fusione)**: nella sezione *Evolution* del pannello Characters, per ogni tipo si può scegliere in cosa si trasforma quando due esemplari uguali si toccano (es. Seme + Seme → Germoglio → Fiore → Albero → Stella). I due si fondono in un personaggio del tipo scelto, con la sua immagine e dimensione, con un suono dedicato per ogni passaggio e un effetto di comparsa; con "stop quando resta un personaggio" il video finisce sulla forma finale.
- **Audio**: musica di sottofondo (MP3/WAV/OGG, volume, loop, sincronizzata alla timeline), matrice dei suoni di collisione per ogni coppia di tipi (A-A, A-B, …) che si adatta da sola al numero di tipi, suoni per muro, ostacolo, fuga, eliminazione e vittoria. Per ogni suono: file, volume, intonazione, cooldown, volume proporzionale all'impatto. Web Audio API, limite di voci simultanee. Una traccia musicale e i suoni base sono generati localmente, senza file esterni.
- **Grafica**: canvas 1080×1920 di default (selettore **Video size** nel pannello Export: 16:9, 1:1, 4:5 o larghezza/altezza libere), 60 fps, sfondo e contorni personalizzabili, scie, particelle, squash & stretch, contatore dei personaggi rimasti, etichette, titolo.
- **Controlli**: play, pausa, reset, avanzamento di un singolo passo, velocità di riproduzione, durata, seed, stop automatico quando resta un personaggio o un tipo, salvataggio e caricamento della configurazione in JSON (con i file incorporati).
- **Export video**: registrazione dal browser con audio sincronizzato (musica + tutti i suoni), WebM ovunque, MP4 dove il browser lo supporta (Chrome/Edge). Durata e dimensioni configurabili. Ogni suono ha un **clipper**: forma d'onda con due maniglie per scegliere la parte del file da riprodurre, con anteprima.

## Come si usa

1. Apri il sito, premi **▶ Play** per vedere la scena demo (tre tipi di personaggi, arena circolare, suoni di collisione, musica generata).
2. A destra: aggiungi tipi di personaggio, carica le immagini, regola fisica e numero. Sotto: musica e matrice dei suoni (clicca una cella per caricare un suono per quella coppia).
3. A sinistra: preset, seed, durata, fisica, arena (anche il tubo), ostacoli, aspetto.
4. **⏺ Record**: la simulazione riparte da zero e viene registrata per intero; alla fine scarichi il file.
5. Cambia il seed per ottenere una variante diversa con le stesse impostazioni.

### Note sull'export

- Chrome ed Edge registrano direttamente MP4 (H.264/AAC). Firefox e Safari producono WebM (VP9/Opus), accettato da TikTok, Instagram e YouTube. Per convertire: `ffmpeg -i video.webm -c:v libx264 -pix_fmt yuv420p -c:a aac video.mp4`.
- La simulazione durante la registrazione è agganciata al clock audio: i suoni cadono esattamente sugli urti. La registrazione avviene in tempo reale (un video di 30 s richiede 30 s); tieni la scheda visibile.
- La simulazione è deterministica (seed + passo fisso), quindi la stessa configurazione produce lo stesso video. L'architettura separa fisica, rendering e audio dalla registrazione: una pipeline Node + FFmpeg potrebbe riusare `PhysicsWorld` e `Renderer` senza modifiche.

## Sviluppo

```bash
npm install
npm run dev      # http://localhost:5173
npm run test     # vitest: configurazione, determinismo, contenimento, fughe, eliminazioni
npm run build    # tsc + vite → dist/
```

Stack: TypeScript, React, Vite, HTML5 Canvas 2D, Matter.js, Web Audio API, MediaRecorder.

Struttura (`src/`): `physics/` (mondo Matter.js, arene, ostacoli, eventi) · `audio/` (motore Web Audio, suoni generati) · `render/` (canvas, effetti) · `sim/` (orchestrazione a passo fisso) · `export/` (registrazione) · `core/` (tipi di default, preset, JSON, RNG) · `ui/` (pannelli React).

Deploy: `tools/publish.sh "messaggio"` esegue i test, fa il commit, builda con `BASE_PATH=/bounce-studio/` e pubblica `dist/` sul branch `gh-pages`, servito da GitHub Pages. In alternativa `.github/workflows/deploy.yml` fa la stessa cosa con GitHub Actions (impostare Pages su "GitHub Actions").

## Licenza

MIT — Pippo Poppi Games.
