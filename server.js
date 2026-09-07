const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const path = require('path');
const { Pool } = require('pg');

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. PostgreSQL Verbindung
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 2. Datenbank initialisieren (Erstellt Tabelle und fügt die Spalte für den Namen hinzu)
const initDb = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS push_subscriptions (
      id SERIAL PRIMARY KEY,
      subscription_data JSONB NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  // Fügt die Username-Spalte hinzu, falls sie aus dem alten Test noch fehlt
  await pool.query(`
    ALTER TABLE push_subscriptions ADD COLUMN IF NOT EXISTS username TEXT;
  `);
  console.log('PostgreSQL Datenbank & Struktur sind bereit.');
};
initDb().catch(err => console.error('Datenbank-Fehler beim Start:', err));

// HIER DEINE GENERIERTEN SCHLÜSSEL EINTRAGEN
const publicVapidKey = 'BHGV74UuIiP2EEqlozOGoC-4WcCtndI5TdMcU3_MqcbaFB8nLynSgQva3JUoA_HJE5HaNmOm1jlVSwtaIVpkiuM';
const privateVapidKey = 'SSEIN5yZtJCbtBwGWDQmAgMvoyz_1TDyOQ97Qgphzz0';

webpush.setVapidDetails('mailto:test@deinedomain.com', publicVapidKey, privateVapidKey);

// Route 1: Abonnement MIT Name empfangen und speichern
app.post('/subscribe', async (req, res) => {
  const { subscription, username } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Name wird benötigt!' });
  }

  try {
    // Falls der User sich neu registriert, alten Eintrag löschen (verhindert Duplikate)
    await pool.query('DELETE FROM push_subscriptions WHERE username = $1', [username.trim()]);

    // Neu eintragen
    await pool.query(
      'INSERT INTO push_subscriptions (subscription_data, username) VALUES ($1, $2)',
      [JSON.stringify(subscription), username.trim()]
    );
    
    res.status(201).json({ success: true });
    console.log(`Smartphone von "${username}" erfolgreich registriert!`);
  } catch (err) {
    console.error('Fehler beim Speichern:', err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// Route 2: Push auslösen (Gezielt per Name oder an alle)
// Testen über: /trigger-push?user=Max oder /trigger-push (für alle)
app.get('/trigger-push', async (req, res) => {
  const targetUser = req.query.user;

  try {
    let result;
    if (targetUser) {
      // Nur an bestimmten User senden
      result = await pool.query('SELECT subscription_data, username FROM push_subscriptions WHERE username = $1', [targetUser.trim()]);
    } else {
      // An alle senden, wenn kein User angegeben ist
      result = await pool.query('SELECT subscription_data, username FROM push_subscriptions');
    }
    
    if (result.rows.length === 0) {
      return res.status(400).send(targetUser ? `User "${targetUser}" nicht gefunden!` : 'Keine Geräte registriert!');
    }

    const payload = JSON.stringify({
      title: 'Neue Nachricht!',
      body: targetUser ? `Hallo ${targetUser}, das ist dein persönlicher Push!` : 'Sammelruf an alle registrierten Smartphones!'
    });

    const pushPromises = result.rows.map(row => {
      return webpush.sendNotification(row.subscription_data, payload)
        .catch(err => console.error(`Fehler bei User ${row.username}:`, err));
    });

    await Promise.all(pushPromises);
    res.send(`Push erfolgreich an ${result.rows.length} Gerät(e) gesendet!`);

  } catch (err) {
    console.error(err);
    res.status(500).send('Interner Serverfehler');
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));
