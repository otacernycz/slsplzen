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

if ($name === '' || !filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($phone) < 9) {
    respond(422, false, 'Vyplňte prosím jméno, platný e-mail a telefon.');
}

$nameParts = preg_split('/\s+/', $name, 2);
$firstName = $nameParts[0];
$surname = $nameParts[1] ?? '';

$payload = [
    'subscriber_data' => [
        'email' => $email,
        'name' => $firstName,
        'surname' => $surname,
        'phone' => $phone,
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

if ($response === false) {
    error_log('subscribe.php: Ecomail request failed - ' . $curlError);
    respond(502, false, 'Nepodařilo se spojit s Ecomailem. Zkuste to prosím znovu.');
}

if ($httpCode >= 200 && $httpCode < 300) {
    respond(200, true);
}

error_log('subscribe.php: Ecomail returned HTTP ' . $httpCode . ' - ' . $response);
respond(502, false, 'Přihlášení se nepodařilo uložit. Zkuste to prosím znovu, nebo nám napište.');
