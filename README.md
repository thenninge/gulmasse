# Gulmasse

Mobilapp for **Gulmasse** – Christmas Beer Competition med invitasjon, påmelding, stemmegiving og snurrehjul.

## Gulmasse '26

- **Dato:** 28. november 2026
- **Påmelding:** [`/invite`](https://gulmasse.vercel.app/invite) (`gulmasse.vercel.app/invite`)
- Flyt: JA → sett opp navn + PIN · NEI → registrer avslag
- Host: Admin → «Invitasjon & påmelding»

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

1. Del `https://gulmasse.vercel.app/invite`
2. Gjest leser «Hva er Gulmasse?» og svarer JA / NEI
3. Ved JA opprettes bruker (navn + PIN) til innlogging på kvelden
4. Host setter event til **live** fra admin når konkurransen starter
