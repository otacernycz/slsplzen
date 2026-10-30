<?php
declare(strict_types=1);

// Lead z náborového formuláře (index.html, manazer.html).
// Lead jde do náborové Google tabulky přes Apps Script (KARIERA_SHEET_WEBHOOK
// + KARIERA_SHEET_TOKEN v kariera-config.php), který pošle i notifikaci.
// Ecomail (ECOMAIL_LIST_ID) slouží jen jako záloha, když tabulka selže —
// pak kontakt dostane štítky „kariera" a pozice, bez spuštění automatizací.

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, bool $success, string $message = ''): void {
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Method not allowed.');
}

$configFile = __DIR__ . '/kariera-config.php';
if (!is_file($configFile)) {
    error_log('lead.php: missing kariera-config.php');
    respond(500, false, 'Formulář je dočasně mimo provoz. Zavolejte nám prosím.');
}
require $configFile;

function field(string $key, int $max = 300): string {
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $v = str_replace(["\r", "\n"], ' ', $v);
    return mb_substr($v, 0, $max);
}

// Honeypot — bot dostane „úspěch", nic se neuloží.
if (field('web') !== '') {
    respond(200, true);
}

$stranka = preg_replace('/[^a-z0-9-]/', '', field('stranka', 60)) ?: 'kariera';
$pozice  = field('pozice', 80) ?: 'Ještě nevím';
$jmeno   = field('jmeno', 120);
$telefon = preg_replace('/[^0-9+]/', '', field('telefon', 30));
$email   = field('email', 160);
$zprava  = field('zprava', 2000);
$souhlas = field('souhlas', 10);
$utm = [];
foreach (['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as $k) {
    $utm[$k] = field($k, 100);
}

if ($jmeno === '') {
    respond(422, false, 'Vyplňte prosím jméno.');
}
if ($telefon === '' && $email === '') {
    respond(422, false, 'Nechte nám prosím telefon nebo e-mail.');
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, false, 'E-mail nevypadá správně.');
}
if ($telefon !== '' && strlen(preg_replace('/\D/', '', $telefon)) < 9) {
    respond(422, false, 'Telefon nevypadá správně.');
}
if ($souhlas !== 'ano') {
    respond(422, false, 'Pro odeslání potřebujeme váš souhlas se zpracováním údajů.');
}

/* ---------- Náborová tabulka (Google Apps Script) ---------- */
// Skript lead zapíše do listu „Leady" a pošle e-mailovou notifikaci (viz README.md).
$sheetOk = false;
if (defined('KARIERA_SHEET_WEBHOOK') && (string) KARIERA_SHEET_WEBHOOK !== '') {
    $ch = curl_init((string) KARIERA_SHEET_WEBHOOK);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'token' => defined('KARIERA_SHEET_TOKEN') ? (string) KARIERA_SHEET_TOKEN : '',
            'cas' => (new DateTime('now', new DateTimeZone('Europe/Prague')))->format('Y-m-d H:i:s'),
            'stranka' => $stranka,
            'pozice' => $pozice,
            'jmeno' => $jmeno,
            'telefon' => $telefon,
            'email' => $email,
            'zprava' => $zprava,
            'souhlas' => $souhlas,
        ] + $utm, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_FOLLOWLOCATION => true, // Apps Script odpovídá přesměrováním
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
    ]);
    $sheetResponse = curl_exec($ch);
    $sheetCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $sheetData = is_string($sheetResponse) ? json_decode($sheetResponse, true) : null;
    $sheetOk = $sheetCode >= 200 && $sheetCode < 300 && is_array($sheetData) && !empty($sheetData['ok']);
    if (!$sheetOk) {
        error_log('lead.php: sheet webhook failed - HTTP ' . $sheetCode . ' ' . (string) $sheetResponse);
    }
}

/* ---------- Ecomail — jen záloha ---------- */
// Ecomail potřebuje e-mail; lead jen s telefonem bez tabulky uložit nejde.
$ecomailOk = false;
if (!$sheetOk && $email !== '' && defined('ECOMAIL_API_KEY') && defined('ECOMAIL_LIST_ID') && (string) ECOMAIL_LIST_ID !== '') {
    function slug(string $v): string {
        $v = strtr(mb_strtolower($v), ['á'=>'a','č'=>'c','ď'=>'d','é'=>'e','ě'=>'e','í'=>'i','ň'=>'n','ó'=>'o','ř'=>'r','š'=>'s','ť'=>'t','ú'=>'u','ů'=>'u','ý'=>'y','ž'=>'z']);
        return trim(preg_replace('/[^a-z0-9]+/', '-', $v), '-');
    }
    $tags = ['kariera', 'pozice-' . slug($pozice), 'stranka-' . $stranka];
    if ($utm['utm_source'] !== '') $tags[] = 'zdroj-' . slug($utm['utm_source']);
    if ($utm['utm_campaign'] !== '') $tags[] = 'kampan-' . slug($utm['utm_campaign']);

    $nameParts = preg_split('/\s+/', $jmeno, 2);
    $payload = [
        'subscriber_data' => [
            'email' => $email,
            'name' => $nameParts[0],
            'surname' => $nameParts[1] ?? '',
            'phone' => $telefon,
            'tags' => $tags,
        ],
        'trigger_autoresponders' => false,
        'update_existing' => true,
        'resubscribe' => false,
    ];

    $ch = curl_init('https://api2.ecomailapp.cz/lists/' . rawurlencode((string) ECOMAIL_LIST_ID) . '/subscribe');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['key: ' . ECOMAIL_API_KEY, 'Content-Type: application/json'],
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 12,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);

    $ecomailOk = $response !== false && $httpCode >= 200 && $httpCode < 300;
    if (!$ecomailOk) {
        error_log('lead.php: Ecomail failed - HTTP ' . $httpCode . ' ' . $curlError . ' ' . (string) $response);
    }
}

if ($sheetOk || $ecomailOk) {
    respond(200, true);
}
error_log('lead.php: LEAD NEULOŽEN - ' . $jmeno . ' / ' . $telefon . ' / ' . $email . ' / ' . $pozice);
respond(502, false, 'Odeslání se nepovedlo. Zkuste to prosím znovu, nebo nám zavolejte.');
