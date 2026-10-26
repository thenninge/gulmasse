# Gulmasse

Mobilapp for **Gulmasse** – Christmas Beer Competition med invitasjon, påmelding, stemmegiving og snurrehjul.

## Nytt i Gulmasse '26

- **Event**: `gulmasse-2026` (seedet i migrasjon `007`)
- **Invitasjonslenke**: `/invitasjon/GULMASSE26` (eller eventets `invite_code`)
- **Påmelding**: navn, RSVP (kommer / kan ikke), valgfritt øl-notat
- **Host**: Admin → «Invitasjon & påmelding» (del lenke, personlige invitasjoner, status)

## Kom i gang

```bash
npm install
cp env.local.sample .env.local   # fyll inn Supabase + DATABASE_URL
npm run migrate                  # kjør SQL-migrasjoner (inkl. events)
npm run dev                      # http://localhost:3030
```

### Miljøvariabler

Se `env.local.sample`:

- `DATABASE_URL` – Postgres (migrasjoner)
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` – API
- `HOST_PIN` – host/admin PIN (standard `0808`)

## Flyt

1. Host deler `/invitasjon/GULMASSE26`
2. Gjester melder seg på
3. På arrangementsdagen logger deltakere inn med PIN i konkurranseappen (`/`)
4. Host setter event til **live** fra admin når konkurransen starter
