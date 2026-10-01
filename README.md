# Linden im Einsatz

Eine eigenständige, öffentliche Entdeckungsseite zur [Aktivitätenliste der Ortsfeuerwehr Linden](https://www.ff-linden.de/veranstaltungsliste/). Nur diese Liste liefert die Einsatzangaben. Die Seite braucht keinen laufenden Server und keine bezahlten Dienste.

**Öffentliche Seite:** [Linden im Einsatz](https://reagans94.github.io/linden-im-einsatz/)

## Was Besucher sehen

- Monatsverlauf, Tageszeiten, Anlässe und Stadtteile
- einen Schalter, der außergewöhnliche Tage beim Monatsvergleich ausblendet
- einen zufälligen Tag aus der Liste
- den letzten veröffentlichten Einsatz und das Datum der letzten Prüfung
- einen vorsichtigen Ausblick: Eine heutige Schätzung erscheint erst, wenn 30 **vorher festgehaltene** Vermutungen nach mindestens 60 Tagen geprüft werden konnten

Die Seite zeigt keine zusätzlichen persönlichen Angaben. Im Zufallstag erscheinen nur Anlass und Stadtteil aus der öffentlichen Liste.

## Jeden Tag aktuell halten

Der [automatische Ablauf](https://github.com/ReaganS94/linden-im-einsatz/actions/workflows/refresh-and-publish.yml) prüft die Feuerwehrliste täglich morgens. Neue Einträge werden übernommen und die Seite wird erneut veröffentlicht. Falls eine alte Zeile verschwindet oder geändert wird, stoppt der Ablauf und hält einen Prüfhinweis bereit. So werden Korrekturen nicht stillschweigend als neue oder fehlende Einsätze gezählt. Einmal im Monat sollte jemand kurz prüfen, ob der tägliche Ablauf noch läuft; GitHub kann geplante Abläufe in länger inaktiven öffentlichen Projekten pausieren.

Die Veröffentlichung läuft über GitHub Pages mit **GitHub Actions** als Quelle. Der erste erfolgreiche Lauf fand am 1. Oktober 2026 statt.

Wenn der Ablauf wegen einer geänderten alten Zeile stoppt: Den Prüfhinweis aus dem fehlgeschlagenen Ablauf öffnen und die genannten Zeilen mit der aktuellen Feuerwehrliste vergleichen. Nur wenn die Änderung dort wirklich steht, den Ablauf erneut von Hand starten und dabei **Änderungen alter Zeilen übernehmen** auswählen. Die vorige Fassung bleibt im Projektverlauf erhalten.

Zum Prüfen am eigenen Rechner reichen Python 3 und ein einfacher lokaler Webserver:

```sh
python3 scripts/refresh.py --dry-run
python3 -m http.server 4175 --directory dist
```

## Zählregeln

Die Ausgangsliste enthält 610 Aktivitäten, davon 595 mit der Kennzeichnung „Einsatz“ (geprüft am 1. Oktober 2026). Für die Vergleiche werden 24 erkennbare Dienste, Absicherungen oder Übungen ausgelassen und drei Zeilen mit identischem Tag, identischer Zeit, identischem Stichwort, Anlass, Straße und Stadtteil je einmal gezählt. Die 27 wortgleichen Wiederholungen im Unwetterblock vom 14. Juli 2026 bleiben einzeln, weil die Liste getrennte Einsatzstellen nicht ausschließen kann. An Tagen mit mindestens zehn Mitternachtsangaben und mindestens 80 % Mitternachtsanteil behandelt die Seite diese Uhrzeit als unbekannt. Das betrifft bislang 84 Einträge vom 14. Juli 2026.

Die Vermutungen für morgen werden **vor** diesem Tag festgehalten. Frühestens 60 Tage später wird einmalig geprüft, ob für den Tag nach dem dann sichtbaren Listenstand mindestens ein passender Eintrag vorliegt. Der Stand und das Ergebnis bleiben gespeichert; spätere Nachträge ändern diese Prüfung nicht. Alte Listeneinträge haben kein Veröffentlichungsdatum; deshalb ist ein fairer historischer Rückblick mit dem heutigen Stand allein unmöglich.

## Aufbau für die Pflege

- `source/activities.json`: zuletzt gesicherte Originalzeilen aus der Feuerwehrliste
- `source/forecasts.json`: vorher festgehaltene Vermutungen
- `scripts/refresh.py`: tägliche Prüfung und Schutz vor verschwundenen Zeilen
- `scripts/build.py`: Zählregeln für die öffentliche Ansicht
- `scripts/forecast.py`: Vermutungen und spätere Prüfung
- `dist/`: fertige Website

Es gibt keine zusätzlichen Pakete, Schlüssel oder Konten für den täglichen Ablauf.
