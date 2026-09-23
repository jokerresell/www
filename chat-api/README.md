# Czat dla strony Arber-Gordon (darmowy)

Czat na stronie działa w dwóch trybach. Oba są darmowe.

## 1. Tryb wbudowany (domyślny, bez konfiguracji)

Działa w całości w przeglądarce, bez serwera i bez kosztów:

- odpowiada na typowe pytania: ceny, terminy, pakowanie, faktury, piętra i windy, trasy, kontakt,
- prowadzi klienta przez **wycenę krok po kroku**: skąd, dokąd, kiedy, co, piętra, dodatkowe usługi, imię, telefon,
- na końcu daje przyciski **Wyślij SMS**, **Wyślij e-mail** i **Zadzwoń** z gotowym zgłoszeniem do firmy.

Nic nie trzeba robić: wystarczy opublikować `index.html`.

## 2. Tryb AI (opcjonalny, też darmowy): Cloudflare Workers AI

Ten folder to mały serwer, który odpowiada na dowolne pytania modelem językowym
(Llama 3.3 70B) na **darmowym planie Cloudflare**. Plan daje dzienny limit
10 000 „neuronów”, czyli mniej więcej 80 odpowiedzi dziennie. Po wyczerpaniu limitu
czat na stronie sam wraca do trybu wbudowanego. Nie trzeba podawać karty płatniczej.

### Uruchomienie (ok. 10 minut)

1. Załóż darmowe konto na https://dash.cloudflare.com.
2. W tym folderze:

   ```bash
   npm install
   npx wrangler login
   ```

3. W `wrangler.toml` wpisz w `ALLOWED_ORIGINS` adres, pod którym działa strona
   (np. `https://arber-gordon.pl`). Tylko z tych adresów czat będzie przyjmował pytania.
4. Wdróż:

   ```bash
   npx wrangler deploy
   ```

   Wrangler wypisze adres w stylu `https://arber-gordon-chat.<konto>.workers.dev`.
5. W `index.html` wpisz ten adres w stałą `CHAT_API_URL` (szukaj `const CHAT_API_URL = ''`).

### Co warto wiedzieć

- **Wiedza asystenta** jest w `SYSTEM_PROMPT` w `src/index.js`. Po zmianie wdróż ponownie (`npx wrangler deploy`).
- **Asystent nie podaje cen ani nie potwierdza terminów.** Kieruje do telefonu lub wyceny w czacie.
- **Wycena krok po kroku zawsze działa lokalnie**, także przy włączonym AI.
- **Płatny Claude (opcjonalnie):** jeśli kiedyś zechcesz lepszych odpowiedzi, ustaw
  `npx wrangler secret put ANTHROPIC_API_KEY`. Serwer użyje wtedy Claude zamiast Workers AI (płatnie, za każde zapytanie).
- **Test lokalny:** `npx wrangler dev`.
