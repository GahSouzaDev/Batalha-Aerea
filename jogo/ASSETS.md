# Batalha Aérea — Assets necessários

Este projeto já está pronto pra rodar (com modelos simples, sem textura, e sem som
enquanto os arquivos abaixo não estiverem nas pastas certas). Basta colar seus
arquivos ORIGINAIS com estes nomes exatos (maiúsculas/minúsculas importam):

## public/img/  (texturas)
- `images.png`               → emblema na cauda do Cessna
- `antigo.png`                → textura do corpo do ATR Bimotor
- `ATR.png`                   → emblema na cauda do ATR Bimotor
- `camuflagem.png`            → textura do corpo do Jato e do SR-71
- `FAB.png`                   → emblema na cauda do Jato
- `ovni.png`                  → textura do corpo do OVNI
- `terra.png`                 → textura da pista secundária do mapa
- `torre-de-controle.png`     → textura da torre de controle
- `conjunto-predios-1.png`    → textura de um conjunto de prédios
- `conjunto-predios-2.png`    → textura de outro conjunto de prédios
- `conjunto-predios-3.png`    → textura de outro conjunto de prédios
- `outdor.png`                → textura do outdoor

## public/sons/  (efeitos/motor — mesmos nomes de arquivo do jogo original)
- `bi-motor.mp3`                                              → motor do Cessna
- `Cessna sound effect _ Enjoy!.mp3`                          → motor do ATR Bimotor
- `Som de avião Caça.mp3`                                     → motor do Jato
- `boeing.mp3`                                                → motor do SR-71
- `Decolagem do 777 Emirates. Se liga no som dos motores.mp3` → motor do OVNI

(Sim, os nomes de som estão "trocados" em relação ao avião — isso é exatamente
como estava no seu jogo original, mantido de propósito.)

Se um arquivo não existir, o jogo simplesmente segue sem aquela textura/som
(não quebra nada) — então pode testar aos poucos.

## Como adicionar um avião novo
1. Copie `public/models/plane-cessna.js` pra `public/models/plane-NOVOTIPO.js`
2. Ajuste a geometria/texturas dentro dele
3. Registre as specs de voo em `public/js/plane-specs.js` (`PLANE_SPECS.NOVOTIPO = {...}`)
4. Adicione `'NOVOTIPO'` em `PLANE_ORDER` (mesmo arquivo)
5. Inclua `<script src="models/plane-NOVOTIPO.js"></script>` no `index.html`
6. Adicione `"NOVOTIPO"` em `VALID_PLANES` no `server.js`

## Como adicionar um mapa novo
1. Copie `public/js/maps/map-cidade.js` pra `public/js/maps/map-NOVOMAPA.js`
2. Escreva sua própria função `buildMapNovoMapa(group)`
3. No fim do arquivo, registre: `MAP_REGISTRY.novomapa = buildMapNovoMapa;`
   (ou substitua uma das chaves já existentes em `MAP_REGISTRY` no map-cidade.js
   pra trocar só o mapa "Deserto"/"Floresta"/"Laboratório" sem mexer no resto)
4. Inclua `<script src="js/maps/map-NOVOMAPA.js"></script>` no `index.html`
   (antes de `main.js`)
5. Adicione a chave em `MAP_INFO` (`public/js/config.js`) e em `VALID_MAPS`
   (`server.js`)
