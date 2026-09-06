const express = require('express');
const webpush = require('web-push');
const bodyParser = require('body-parser');
const path = require('path');

const app = express();
app.use(bodyParser.json());

// Statische Dateien aus dem "public" Ordner laden
app.use(express.static(path.join(__dirname, 'public')));

// HIER DEINE GENERIERTEN SCHLÜSSEL EINTRAGEN
const publicVapidKey = 'BHGV74UuIiP2EEqlozOGoC-4WcCtndI5TdMcU3_MqcbaFB8nLynSgQva3JUoA_HJE5HaNmOm1jlVSwtaIVpkiuM';
const privateVapidKey = 'SSEIN5yZtJCbtBwGWDQmAgMvoyz_1TDyOQ97Qgphzz0';

webpush.setVapidDetails(
  'mailto:test@deinedomain.com',
  publicVapidKey,
  privateVapidKey
);

// Speicher für das Smartphone-Abonnement (In der Praxis gehört das in eine Datenbank!)
let savedSubscription = null;

// Route 1: Abonnement vom Smartphone empfangen und speichern
app.post('/subscribe', (req, res) => {
  savedSubscription = req.body;
  res.status(201).json({});
  console.log('Smartphone erfolgreich abonniert!');
});

// Route 2: Push-Nachricht manuell auslösen (z.B. durch Aufruf im Browser)
app.get('/trigger-push', (req, res) => {
  if (!savedSubscription) {
    return res.status(400).send('Kein Smartphone abonniert!');
  }

  const payload = JSON.stringify({
    title: 'Test Push!',
    body: 'Das ist eine Meldung von deinem Railway Server!'
  });

  webpush.sendNotification(savedSubscription, payload)
    .then(() => res.send('Push-Meldung gesendet!'))
    .catch(err => {
      console.error('Fehler beim Senden:', err);
      res.status(500).send(err);
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server läuft auf Port ${PORT}`));