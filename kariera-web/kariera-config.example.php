<?php
// Zkopírovat na serveru jako „kariera-config.php" (stejná složka) a doplnit.
// kariera-config.php je v .gitignore — tokeny a klíče nikdy necommitovat.

// Náborová Google tabulka: URL webové aplikace z Apps Scriptu
// (Nasadit → Webová aplikace) a tajný token, který musí sedět
// s WEB_TOKEN ve skriptu (viz README.md).
define('KARIERA_SHEET_WEBHOOK', '');
define('KARIERA_SHEET_TOKEN', '');

// Nepovinné: záloha do Ecomailu, když zápis do tabulky selže.
// Stejný klíč a seznam jako na minikurzu (web/ecomail-config.php);
// náborové kontakty se odliší štítkem „kariera", automatizace se nespouští.
// Nechte prázdné, pokud nábor do Ecomailu nepatří.
define('ECOMAIL_API_KEY', '');
define('ECOMAIL_LIST_ID', '');
