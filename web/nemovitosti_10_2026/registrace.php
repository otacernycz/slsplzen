<?php
declare(strict_types=1);

// Registrace na akci „Od nájmu k výnosu" (13. 10. 2026).
// Kontakt se přihlásí do stávajícího seznamu v Ecomailu (ECOMAIL_LIST_ID
// z ../ecomail-config.php; pokud je vyplněný ECOMAIL_EVENT_LIST_ID, použije se ten).
// Automatizace seznamu se NEspouští (trigger_autoresponders = false),
// takže registrovaní nedostanou minikurzové e-maily.
//
// Data jdou do vlastních polí, která musí v seznamu v Ecomailu existovat:
//   AKCE        — identifikátor akce (např. nemovitosti_10_2026)
//   AKCE_VZTAH  — vztah k investičním nemovitostem
//   AKCE_ZAJMY  — co ho zajímá (víc hodnot oddělených středníkem)
//   AKCE_ZDROJ  — utm_source / utm_campaign
// Navíc dostane jeden štítek s názvem akce (nemovitosti-10-2026) pro filtrování.
//
// Pro další akci: zkopírovat celou složku, přejmenovat a upravit
// EVENT_ID v index.html a dekujeme.html.

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, bool $success, string $message = ''): void {
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Method not allowed.');
}

$configFile = __DIR__ . '/../ecomail-config.php';
if (!is_file($configFile)) {
    error_log('registrace.php: missing ../ecomail-config.php');
    respond(500, false, 'Registrace je dočasně mimo provoz. Zkuste to prosím později.');
}
require $configFile;

$listId = defined('ECOMAIL_EVENT_LIST_ID') && (string) ECOMAIL_EVENT_LIST_ID !== ''
    ? (string) ECOMAIL_EVENT_LIST_ID
    : (defined('ECOMAIL_LIST_ID') ? (string) ECOMAIL_LIST_ID : '');
if ($listId === '' || !defined('ECOMAIL_API_KEY')) {
    error_log('registrace.php: missing ECOMAIL_LIST_ID / ECOMAIL_API_KEY in ecomail-config.php');
    respond(500, false, 'Registrace je dočasně mimo provoz. Zkuste to prosím později.');
}

function field(string $key, int $max = 300): string {
    $v = isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
    $v = str_replace(["\r", "\n"], ' ', $v);
    return mb_substr($v, 0, $max);
}

$eventId = preg_replace('/[^a-z0-9_]/', '', field('event_id', 60)) ?: 'event';
$name    = field('name', 120);
$email   = field('email', 160);
$phone   = preg_replace('/[^0-9+]/', '', field('phone', 30));
$vztah   = field('vztah');
$zajmy   = field('zajmy');
$zdroj   = field('zdroj', 60);
$kampan  = field('kampan', 100);

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen(preg_replace('/\D/', '', $phone)) < 9) {
    respond(422, false, 'Vyplňte prosím jméno, platný telefon a e-mail.');
}

/* ---------- Ecomail ---------- */
$nameParts = preg_split('/\s+/', $name, 2);
$source = trim($zdroj . ($kampan !== '' ? ' / ' . $kampan : ''));

$payload = [
    'subscriber_data' => [
        'email' => $email,
        'name' => $nameParts[0],
        'surname' => $nameParts[1] ?? '',
        'phone' => $phone,
        'tags' => [str_replace('_', '-', $eventId)],
        'custom_fields' => [
            'AKCE' => $eventId,
            'AKCE_VZTAH' => $vztah,
            'AKCE_ZAJMY' => $zajmy,
            'AKCE_ZDROJ' => $source,
        ],
    ],
    'trigger_autoresponders' => false,
    'update_existing' => true,
    'resubscribe' => false,
];

$ch = curl_init('https://api2.ecomailapp.cz/lists/' . rawurlencode($listId) . '/subscribe');
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
curl_close($ch);

if ($response !== false && $httpCode >= 200 && $httpCode < 300) {
    respond(200, true);
}

error_log('registrace.php: Ecomail failed - HTTP ' . $httpCode . ' ' . $curlError . ' ' . (string) $response);
respond(502, false, 'Registraci se nepodařilo uložit. Zkuste to prosím znovu.');
