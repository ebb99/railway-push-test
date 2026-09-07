// Hintergrund-Event: Wird ausgelöst, sobald der Railway-Server eine Push-Nachricht sendet
self.addEventListener('push', event => {
    // Falls der Server keine Daten mitgeschickt hat, nutzen wir einen Standard-Fallback
    let data = {
        title: 'Benachrichtigung',
        body: 'Es gibt Neuigkeiten!'
    };

    try {
        // Versuchen, die JSON-Daten vom Railway-Server zu lesen
        if (event.data) {
            data = event.data.json();
        }
    } catch (e) {
        console.error('Fehler beim Parsen der Push-Daten:', e);
    }

    // Die Optionen für das Smartphone-Popup definieren
    const options = {
        body: data.body,
        // Ein sauberes Glocken-Icon für die Benachrichtigungsleiste
        icon: 'https://flaticon.com', 
        // Vibriert kurz (Muster: 200ms Vibration, 100ms Pause, 200ms Vibration)
        vibrate:,
        // Verhindert, dass alte Nachrichten gestapelt werden (neue überschreiben alte mit dem gleichen Tag)
        tag: 'railway-push-alarm',
        // Hält die Nachricht auf dem Android-Bildschirm, bis der Nutzer sie wegwischt
        requireInteraction: true
    };

    // Das Popup nativ auf dem Smartphone-Bildschirm anzeigen
    event.waitUntil(
        self.registration.showNotification(data.title, options)
    );
});

// Klick-Event: Wird ausgelöst, wenn der Nutzer auf das Popup tippt
self.addEventListener('notificationclick', event => {
    // Das Popup-Fenster schließen
    event.notification.close();

    // Aktion: Öffnet deine Web-App im Vollbildmodus, wenn der Nutzer auf die Meldung tippt
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            // Falls die Seite irgendwo im Hintergrund schon offen ist, fokussiere sie...
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if ('focus' in client) {
                    return client.focus();
                }
            }
            // ...andernfalls öffne sie ganz neu auf dem Smartphone
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});
