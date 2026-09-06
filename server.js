const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg'); // PostgreSQL Treiber importieren

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. Verbindung zur PostgreSQL Datenbank herstellen
// Railway übergibt im Live-Betrieb automatisch die Umgebungsvariable process.env.DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:passwort@localhost:5432/mein_lokaler_test',
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false // Erforderlich für Railway-Verbindungen
});

// 2. Tabelle beim Serverstart anlegen (falls noch nicht vorhanden)
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      subscription_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  console.log('PostgreSQL Tabelle ist bereit.');
};
initDb().catch(err => console.error('Datenbank-Fehler beim Start:', err));

// HIER DEINE GENERIERTEN SCHLÜSSEL EINTRAGEN
const publicVapidKey = 'BHGV74UuIiP2EEqlozOGoC-4WcCtndI5TdMcU3_MqcbaFB8nLynSgQva3JUoA_HJE5HaNmOm1jlVSwtaIVpkiuM';
const privateVapidKey = 'SSEIN5yZtJCbtBwGWDQmAgMvoyz_1TDyOQ97Qgphzz0';

webpush.setVapidDetails(
  'mailto:test@deinedomain.com',
  publicVapidKey,
  privateVapidKey
);

// Route 1: Abonnement in der PostgreSQL Datenbank speichern
app.post('/subscribe', async (req, res) => {
  const subscription = req.body;

  try {
    // Das JSON-Abonnement wird sicher in der Spalte "subscription_data" abgelegt
    await pool.query(
      'INSERT INTO push_subscriptions (subscription_data) VALUES ($1)',
      [JSON.stringify(subscription)]
    );
    
    res.status(201).json({});
    console.log('Ein neues Smartphone wurde dauerhaft in PostgreSQL gespeichert!');
  } catch (err) {
    console.error('Fehler beim Speichern in DB:', err);
    res.status(500).send(err);
  }
});

// Route 2: Push-Nachricht an ALLE gespeicherten Smartphones senden
app.get('/trigger-push', async (req, res) => {
  try {
    // Alle Abonnements aus der Datenbank abfragen
    const result = await pool.query('SELECT subscription_data FROM push_subscriptions');
    
    if (result.rows.length === 0) {
      return res.status(400).send('Keine Smartphones in der Datenbank registriert!');
    }

    const payload = JSON.stringify({
      title: 'PostgreSQL Push!',
      body: `Gesendet an eines von ${result.rows.length} registrierten Geräten!`
    });

    // Schleife durchläuft alle gefundenen Smartphones in der DB
    const pushPromises = result.rows.map(row => {
      const subscription = row.subscription_data;
      return webpush.sendNotification(subscription, payload)
        .catch(err => {
          // Falls ein Abo abgelaufen oder ungültig ist (z.B. App deinstalliert), könnte man es hier löschen
          console.error('Senden an ein Gerät fehlgeschlagen:', err);
        });
    });

    // Warten, bis alle Push-Nachrichten abgeschickt wurden
    await Promise.all(pushPromises);
    res.send(`Push-Meldung an alle ${result.rows.length} Geräte gesendet!`);

  } catch (err) {
    console.error('Fehler beim Abrufen aus DB:', err);
    res.status(500).send(err);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
