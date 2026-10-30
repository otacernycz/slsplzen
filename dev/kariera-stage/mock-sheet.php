<?php
declare(strict_types=1);

// Falešná náborová tabulka pro lokální stage – chová se jako Apps Script.
// POST (JSON od lead.php): ověří token, připíše řádek do leady.csv, vrátí {"ok":true}.
// GET: ukáže přijaté leady jako tabulku (http://127.0.0.1:8097/).

const TOKEN = 'stage-token';
const COLS = ['cas', 'stranka', 'pozice', 'jmeno', 'telefon', 'email', 'zprava', 'souhlas',
              'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
$csv = __DIR__ . '/leady.csv';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    $d = json_decode((string) file_get_contents('php://input'), true);
    if (!is_array($d)) {
        echo json_encode(['ok' => false, 'error' => 'bad json']);
        exit;
    }
    // Simulace výpadku tabulky: v konzoli `touch dev/kariera-stage/FAIL`
    if (is_file(__DIR__ . '/FAIL') || ($d['token'] ?? '') !== TOKEN) {
        echo json_encode(['ok' => false, 'error' => 'bad token']);
        exit;
    }
    $f = fopen($csv, 'a');
    fputcsv($f, array_map(fn($k) => (string) ($d[$k] ?? ''), COLS), ',', '"', '');
    fclose($f);
    echo json_encode(['ok' => true]);
    exit;
}

$rows = [];
if (is_file($csv)) {
    $f = fopen($csv, 'r');
    while (($r = fgetcsv($f, null, ',', '"', '')) !== false) $rows[] = $r;
    fclose($f);
}
$rows = array_reverse($rows);
$e = fn($v) => htmlspecialchars((string) $v, ENT_QUOTES);
?><!doctype html>
<html lang="cs"><head><meta charset="utf-8"><meta http-equiv="refresh" content="5">
<title>Stage – leady</title>
<style>
body { font: 14px/1.4 -apple-system, sans-serif; margin: 24px; color: #333; }
h1 { font-size: 18px; } p { color: #666; }
table { border-collapse: collapse; width: 100%; }
th, td { border-bottom: 1px solid #e5e5e5; padding: 6px 8px; text-align: left; vertical-align: top; }
th { background: #f5f5f5; font-weight: 600; }
</style></head><body>
<h1>Stage – náborová tabulka (<?= count($rows) ?> leadů)</h1>
<p>Nejnovější nahoře, obnovuje se každých 5 s. Data v dev/kariera-stage/leady.csv<?= is_file(__DIR__ . '/FAIL') ? ' · <strong style="color:#D82034">REŽIM VÝPADKU (soubor FAIL)</strong>' : '' ?></p>
<table><tr><?php foreach (COLS as $c) echo '<th>' . $e($c) . '</th>'; ?></tr>
<?php foreach ($rows as $r) { echo '<tr>'; foreach ($r as $v) echo '<td>' . $e($v) . '</td>'; echo '</tr>'; } ?>
</table></body></html>
