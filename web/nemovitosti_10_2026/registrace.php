<?php
declare(strict_types=1);

// Registrace na akci „Od nájmu k výnosu" (13. 10. 2026).
// Lead se pošle (a) e-mailem na EVENT_NOTIFY_EMAIL tomu, kdo volá,
// a (b) do samostatného seznamu v Ecomailu (ECOMAIL_EVENT_LIST_ID), ať
// event leady nepadají do minikurzové sekvence. Obojí se nastavuje
// v ../ecomail-config.php na serveru — stačí mít vyplněné aspoň jedno.
//
// Pro další akci: zkopírovat celou složku, přejmenovat a upravit
// EVENT_NAME níže + EVENT_ID v index.html a dekujeme.html.

date_default_timezone_set('Europe/Prague');

const EVENT_NAME = 'Od nájmu k výnosu — 13. 10. 2026, Plzeň';

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

$listId = defined('ECOMAIL_EVENT_LIST_ID') ? (string) ECOMAIL_EVENT_LIST_ID : '';
$notify = defined('EVENT_NOTIFY_EMAIL') ? (string) EVENT_NOTIFY_EMAIL : '';
if ($listId === '' && $notify === '') {
    error_log('registrace.php: set ECOMAIL_EVENT_LIST_ID and/or EVENT_NOTIFY_EMAIL in ecomail-config.php');
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
$pocet   = preg_replace('/\D/', '', field('pocet', 2)) ?: '1';
$zdroj   = field('zdroj', 60);
$kampan  = field('kampan', 100);

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen(preg_replace('/\D/', '', $phone)) < 9) {
    respond(422, false, 'Vyplňte prosím jméno, platný telefon a e-mail.');
}

$ok = false;

/* ---------- 1) Ecomail — samostatný seznam pro akce ---------- */
if ($listId !== '' && defined('ECOMAIL_API_KEY')) {
    $nameParts = preg_split('/\s+/', $name, 2);
    $tags = [str_replace('_', '-', $eventId), 'hoste-' . $pocet];
    if ($zdroj !== '') $tags[] = 'zdroj-' . preg_replace('/[^a-z0-9-]/', '', strtolower($zdroj));

    $payload = [
        'subscriber_data' => [
            'email' => $email,
            'name' => $nameParts[0],
            'surname' => $nameParts[1] ?? '',
            'phone' => $phone,
            'tags' => $tags,
            'custom_fields' => [
                'ZKUSENOSTI' => $vztah,
                'CIL' => $zajmy,
            ],
        ],
        'trigger_autoresponders' => true,
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
        $ok = true;
    } else {
        error_log('registrace.php: Ecomail failed - HTTP ' . $httpCode . ' ' . $curlError . ' ' . (string) $response);
    }
}

/* ---------- 2) E-mail pro toho, kdo volá ---------- */
if ($notify !== '') {
    $lines = [
        'Nová registrace: ' . EVENT_NAME,
        '',
        'Jméno:    ' . $name,
        'Telefon:  ' . $phone,
        'E-mail:   ' . $email,
        'Počet:    ' . $pocet . ' os.',
        '',
        'Vztah k nemovitostem: ' . $vztah,
        'Zajímá ho/ji:         ' . $zajmy,
        '',
        'Zdroj: ' . ($zdroj !== '' ? $zdroj : '(neuvedeno)') . ($kampan !== '' ? ' / ' . $kampan : ''),
        'Čas:   ' . date('j. n. Y H:i'),
        '',
        '→ Zavolat do 24 h, potvrdit účast a sdělit místo konání.',
    ];
    $from = 'noreply@investicniminikurz.cz';
    $headers = implode("\r\n", [
        'From: Registrace akce <' . $from . '>',
        'Reply-To: ' . $email,
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 8bit',
    ]);
    $subject = '=?UTF-8?B?' . base64_encode('Registrace: ' . $name . ' (' . $pocet . ' os.)') . '?=';
    if (mail($notify, $subject, implode("\n", $lines), $headers, '-f' . $from)) {
        $ok = true;
    } else {
        error_log('registrace.php: mail() to ' . $notify . ' failed');
    }
}

if ($ok) {
    respond(200, true);
}
respond(502, false, 'Registraci se nepodařilo uložit. Zkuste to prosím znovu, nebo nám zavolejte.');
