# Czat AI dla strony Arber-Gordon

Mały serwer (Cloudflare Worker), który łączy okienko czatu na stronie z modelem Claude.
Klucz API zostaje na serwerze i nigdy nie trafia do przeglądarki.

Bez tego serwera czat na stronie też działa, ale odpowiada tylko z wbudowanej bazy
gotowych odpowiedzi (ceny, terminy, pakowanie, faktury, kontakt).

## Uruchomienie (ok. 10 minut)

1. Załóż darmowe konto na https://dash.cloudflare.com i klucz API na https://console.anthropic.com.
2. W tym folderze:

   ```bash
   npm install
   npx wrangler login
   npx wrangler secret put ANTHROPIC_API_KEY   # wklej klucz, gdy poprosi
   ```

3. W `wrangler.toml` wpisz w `ALLOWED_ORIGINS` adres, pod którym działa strona
   (np. `https://arber-gordon.pl`). Tylko z tych adresów czat będzie przyjmował pytania.
4. Wdróż:

   ```bash
   npx wrangler deploy
   ```

   Wrangler wypisze adres w stylu `https://arber-gordon-chat.<konto>.workers.dev`.
5. W `index.html` wpisz ten adres w stałą `CHAT_API_URL` (szukaj `const CHAT_API_URL = ''`).

Jeśli serwer będzie niedostępny, czat sam przełączy się na wbudowane odpowiedzi.

## Co warto wiedzieć

- **Wiedza asystenta** jest w `SYSTEM_PROMPT` w `src/index.js`. Zmieniasz usługi, dane albo zasady? Popraw ten tekst i wdróż ponownie.
- **Asystent nie podaje cen ani nie potwierdza terminów.** Zawsze kieruje do telefonu lub formularza wyceny.
- **Koszty:** każda wiadomość to płatne zapytanie do API Anthropic. Warto ustawić miesięczny limit wydatków w konsoli Anthropic.
- **Ograniczenia:** serwer przyjmuje maksymalnie 20 ostatnich wiadomości po 1500 znaków.
- **Test lokalny:** `npx wrangler dev`. Klucz do testów wpisz do pliku `.dev.vars` jako `ANTHROPIC_API_KEY=...`. Plik jest ignorowany przez git.
