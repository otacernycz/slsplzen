<?php
// Copy this file to "ecomail-config.php" (same folder) and fill in your
// real values before uploading. ecomail-config.php is gitignored — never
// commit your real API key to a public repository.

// Ecomail → Nastavení účtu → API klíč
define('ECOMAIL_API_KEY', 'PASTE-YOUR-ECOMAIL-API-KEY-HERE');

// ID seznamu, do kterého se mají kontakty přihlašovat.
// Najdete ho v Ecomailu u seznamu (Kontakty → seznam), nebo v URL
// veřejného formuláře, který se dosud používal: .../public/subscribe/{ID}/...
define('ECOMAIL_LIST_ID', 1);

// --- Registrace na akce (např. /nemovitosti_10_2026/) -----------------
// Nepovinné. Bez něj se registrace z akcí ukládají do ECOMAIL_LIST_ID výše
// a od minikurzu se odliší štítky (bez spuštění minikurzových automatizací).
// Vyplňte jen pokud chcete akce v samostatném seznamu.
define('ECOMAIL_EVENT_LIST_ID', '');

