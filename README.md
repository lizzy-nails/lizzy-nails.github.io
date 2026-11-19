# lizzy-nails.github.io

Лендинг мастера маникюра Лизы с онлайн-записью. Статика без сборки, публикуется GitHub Pages из `main`: https://lizzy-nails.github.io

- `index.html`, `style.css` — страница
- `nails.js` — рисует превью ногтей (SVG) по уровню дизайна и цвету
- `app.js` — календарь свободных окон, выбор услуги/дизайна, референсы, отправка заявки
- `map.js` — карта «Где я» (Leaflet + OpenStreetMap, перекрашена под сайт в `style.css`)

Запись принимает сервис `nails` в кластере b.net (`gitops/nails` в berry_ecosystem), снаружи доступный через
Tailscale Funnel: `https://berry-k3s.tail4064e5.ts.net:10000`. Записи Лиза смотрит на `nails.b.net`.

Локально: запустить сервис с `-origins http://localhost:8000`, затем `python3 -m http.server 8000`
и открыть `http://localhost:8000/?api=http://127.0.0.1:18081`.
