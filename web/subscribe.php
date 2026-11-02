<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond(int $status, bool $success, string $message = '') {
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, false, 'Method not allowed.');
}

$configFile = __DIR__ . '/ecomail-config.php';
if (!is_file($configFile)) {
    error_log('subscribe.php: missing ecomail-config.php — copy ecomail-config.example.php and fill in the API key.');
    respond(500, false, 'Formulář je dočasně mimo provoz. Zkuste to prosím později.');
}
require $configFile;

function field(string $key): string {
    return isset($_POST[$key]) ? trim((string) $_POST[$key]) : '';
}

$name = field('name');
$email = field('email');
$phone = preg_replace('/[^0-9+]/', '', field('phone'));
$zkusenosti = field('zkusenosti');
$cil = field('cil');
$castka = field('castka');
$zdroj = mb_substr(field('zdroj'), 0, 60);
$kampan = mb_substr(field('kampan'), 0, 100);

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($phone) < 9) {
    respond(422, false, 'Vyplňte prosím jméno, platný e-mail a telefon.');
}

$nameParts = preg_split('/\s+/', $name, 2);
$firstName = $nameParts[0];
$surname = $nameParts[1] ?? '';

// Štítky: „minikurz“ jednoznačně odliší přihlášky do kurzu od registrací
// z akcí (ty jdou do stejného seznamu jen jako záloha), „web“ zdroj a UTM.
$tags = ['minikurz', 'web'];
if ($zdroj !== '') $tags[] = 'zdroj-' . preg_replace('/[^a-z0-9-]/', '', strtolower($zdroj));
if ($kampan !== '') $tags[] = 'kampan-' . preg_replace('/[^a-z0-9-]/', '', strtolower(str_replace('_', '-', $kampan)));

$payload = [
    'subscriber_data' => [
        'email' => $email,
        'name' => $firstName,
        'surname' => $surname,
        'phone' => $phone,
        'tags' => $tags,
        'custom_fields' => [
            'ZKUSENOSTI' => $zkusenosti,
            'CIL' => $cil,
            'CASTKA' => $castka,
        ],
    ],
    'trigger_autoresponders' => true,
    'update_existing' => true,
    'resubscribe' => false,
];

$ch = curl_init('https://api2.ecomailapp.cz/lists/' . rawurlencode((string) ECOMAIL_LIST_ID) . '/subscribe');
curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_POST => true,
    CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
    CURLOPT_HTTPHEADER => [
        'key: ' . ECOMAIL_API_KEY,
        'Content-Type: application/json',
    ],
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_TIMEOUT => 12,
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

$ecomailOk = $response !== false && $httpCode >= 200 && $httpCode < 300;
if (!$ecomailOk) {
    error_log('subscribe.php: Ecomail failed - HTTP ' . $httpCode . ' ' . $curlError . ' ' . (string) $response);
}

/* ---------- Pracovní tabulka (Google Apps Script) ---------- */
// MINIKURZ_SHEET_WEBHOOK + MINIKURZ_SHEET_TOKEN v ecomail-config.php, skript
// je v apps-script/minikurz-leady.gs. Zapisuje se vždy, i když Ecomail selže —
// lead pak v tabulce nese poznámku, že kurz neodešel.
$sheetOk = false;
if (defined('MINIKURZ_SHEET_WEBHOOK') && (string) MINIKURZ_SHEET_WEBHOOK !== '') {
    $ch = curl_init((string) MINIKURZ_SHEET_WEBHOOK);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode([
            'token' => defined('MINIKURZ_SHEET_TOKEN') ? (string) MINIKURZ_SHEET_TOKEN : '',
            'name' => $name,
            'email' => $email,
            'phone' => $phone,
            'zkusenosti' => $zkusenosti,
            'zajmy' => $cil,
            'zdroj' => $zdroj,
            'kampan' => $kampan,
            'poznamka' => $ecomailOk ? '' : 'Ecomail selhal – minikurz neodešel, přidat ručně',
        ], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_FOLLOWLOCATION => true, // Apps Script odpovídá přesměrováním
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_TIMEOUT => 20,
    ]);
    $sheetResponse = curl_exec($ch);
    $sheetCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    $sheetData = is_string($sheetResponse) ? json_decode($sheetResponse, true) : null;
    $sheetOk = $sheetCode >= 200 && $sheetCode < 300 && is_array($sheetData) && !empty($sheetData['ok']);
    if (!$sheetOk) {
        error_log('subscribe.php: sheet webhook failed - HTTP ' . $sheetCode . ' ' . (string) $sheetResponse);
    }
}

if ($ecomailOk || $sheetOk) {
    respond(200, true);
}
respond(502, false, 'Přihlášení se nepodařilo uložit. Zkuste to prosím znovu, nebo nám napište.');
