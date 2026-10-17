/**
 * Assembles Modelltest 4 source JSON from pasted parts + Hören URLs.
 * Usage: node scripts/build-mt4-from-parts.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('content');
const partialPath = path.join(ROOT, 'modelltest-4-partial.json');
const outPath = path.join(ROOT, 'modelltest-4-source.json');

const R2 = 'https://pub-9c97adaccfb94d4bb515056232bed4f8.r2.dev';

const hoeren = {
  teil1: {
    part: 1,
    title: 'Teil 1',
    subtitle: 'Hörverstehen, Teil 1',
    instruction:
      'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören diese Texte nur einmal. Entscheiden Sie beim Hören, ob die Aussagen 41–45 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 41–45. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 41–45. Sie haben dazu 30 Sekunden Zeit.',
    contentRevision: 'modelltest-4-hoeren-teil1-v1',
    transcript: `Nummer 41.

Also, ich wohne ungefähr vier Kilometer von meinem Büro entfernt. Früher bin ich jeden Morgen mit dem Bus gefahren, aber der war oft sehr voll. Seit letztem Frühjahr fahre ich meistens mit dem Fahrrad zur Arbeit. Das dauert ungefähr zwanzig Minuten und ich bin morgens gleich ein bisschen an der frischen Luft. Nur wenn es stark regnet oder sehr kalt ist, nehme ich noch den Bus.

Nummer 42.

Ich habe seit vielen Jahren ein Auto und brauche es auch beruflich. Das Problem ist nur, dass es in unserem Viertel viel zu wenige Parkplätze gibt. Wenn ich abends nach Hause komme, suche ich manchmal zwanzig Minuten, bis ich einen freien Platz finde. Deshalb überlege ich inzwischen sogar, einen festen Stellplatz zu mieten, obwohl das ziemlich teuer ist.

Nummer 43.

Mittwochs und samstags ist bei uns auf dem Rathausplatz Wochenmarkt. Ich gehe fast immer samstags dorthin. Obst, Gemüse, Käse und Brot kaufe ich meistens dort, weil die Sachen frisch sind und ich viele Verkäufer inzwischen persönlich kenne. Nur Getränke und größere Haushaltsartikel kaufe ich normalerweise im Supermarkt.

Nummer 44.

Viele meiner Freunde sind aufs Land gezogen, weil es dort ruhiger ist. Für mich wäre das nichts. Ich wohne gern mitten in der Stadt. Mein Büro ist nur zwei U-Bahn-Stationen entfernt, und abends kann ich spontan ins Kino oder in ein Restaurant gehen. Klar, manchmal ist es laut, aber ich möchte im Moment auf keinen Fall außerhalb wohnen.

Nummer 45.

Als ich vor sechs Monaten in dieses Haus gezogen bin, kannte ich in der Stadt fast niemanden. Zum Glück haben mich meine Nachbarn gleich zu einem kleinen Fest im Innenhof eingeladen. Dort habe ich viele Leute aus dem Haus kennengelernt. Mit zwei Nachbarinnen treffe ich mich inzwischen regelmäßig zum Kaffee, und manchmal gehen wir zusammen spazieren.`,
    questions: [
      {
        questionNumber: 41,
        prompt: 'Die Sprecherin fährt normalerweise mit dem Fahrrad zur Arbeit.',
        correctAnswer: '+',
        sortOrder: 0,
      },
      {
        questionNumber: 42,
        prompt: 'Der Sprecher findet in seinem Wohnviertel leicht einen Parkplatz.',
        correctAnswer: '-',
        sortOrder: 1,
      },
      {
        questionNumber: 43,
        prompt:
          'Die Sprecherin kauft ihre Lebensmittel meistens auf dem Wochenmarkt.',
        correctAnswer: '+',
        sortOrder: 2,
      },
      {
        questionNumber: 44,
        prompt: 'Der Sprecher möchte lieber außerhalb der Stadt wohnen.',
        correctAnswer: '-',
        sortOrder: 3,
      },
      {
        questionNumber: 45,
        prompt: 'Die Sprecherin hat durch ihre Nachbarn neue Leute kennengelernt.',
        correctAnswer: '+',
        sortOrder: 4,
      },
    ],
    audioUrl: `${R2}/modelltest-4-hoeren/modelltest-4-hoeren-teil1.mp3`,
    imageUrl: '',
    durationMinutes: 8,
  },
  teil2: {
    part: 2,
    title: 'Teil 2',
    subtitle: 'Hörverstehen, Teil 2',
    instruction:
      'Sie hören nun ein Gespräch. Dazu sollen Sie zehn Aufgaben lösen. Sie hören das Gespräch zweimal. Entscheiden Sie beim Hören, ob die Aussagen 46–55 richtig oder falsch sind. Markieren Sie Ihre Lösungen auf dem Antwortbogen bei den Aufgaben 46–55. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch auf dem Antwortbogen. Lesen Sie jetzt die Aufgaben 46–55. Sie haben dazu eine Minute Zeit.',
    contentRevision: 'modelltest-4-hoeren-teil2-v1',
    transcript: `Moderator: Guten Tag und herzlich willkommen zu unserem Stadtmagazin. Heute geht es um ein neues Stadtteilzentrum im Süden unserer Stadt. Seit Anfang dieses Monats ist das Zentrum geöffnet. Bei mir im Studio ist Frau Keller, die dort als Projektleiterin arbeitet. Guten Tag, Frau Keller.

Frau Keller: Guten Tag.

Moderator: Frau Keller, warum hat man dieses neue Stadtteilzentrum überhaupt eingerichtet?

Frau Keller: In unserem Stadtteil wohnen sehr unterschiedliche Menschen: Familien, ältere Leute, Studierende und auch viele Menschen, die erst seit kurzer Zeit hier leben. Es gab zwar schon einzelne Vereine und Angebote, aber bisher keinen gemeinsamen Treffpunkt. Deshalb wollte die Stadt einen Ort schaffen, an dem sich die Bewohner kennenlernen und gemeinsam etwas machen können.

Moderator: Das Zentrum ist also vor allem ein Treffpunkt?

Frau Keller: Ja, aber nicht nur. Wir bieten auch verschiedene Kurse und Beratungen an. Es gibt zum Beispiel Deutschkurse, Computerkurse, einen offenen Treff für Eltern mit kleinen Kindern und zweimal pro Woche eine Hausaufgabenhilfe für Schülerinnen und Schüler.

Moderator: Und wer kann diese Angebote nutzen?

Frau Keller: Eigentlich alle Bewohner des Stadtteils. Für die meisten offenen Veranstaltungen muss man sich nicht anmelden. Bei Kursen mit begrenzter Teilnehmerzahl ist eine Anmeldung natürlich notwendig.

Moderator: Muss man für die Kurse bezahlen?

Frau Keller: Das ist unterschiedlich. Viele Angebote sind kostenlos, weil sie von der Stadt finanziert werden. Für einige Kurse, zum Beispiel den Kochkurs oder bestimmte Computerkurse, gibt es eine kleine Teilnahmegebühr. Diese liegt meistens zwischen fünf und fünfzehn Euro.

Moderator: Wie wird das Zentrum insgesamt finanziert?

Frau Keller: Der größte Teil der Kosten wird von der Stadt übernommen. Zusätzlich bekommen wir Geld von einigen sozialen Organisationen. Außerdem unterstützen uns lokale Unternehmen, zum Beispiel mit Material oder kleineren Spenden.

Moderator: Arbeiten im Zentrum nur fest angestellte Mitarbeiter?

Frau Keller: Nein. Wir haben sechs fest angestellte Mitarbeiterinnen und Mitarbeiter, aber ohne Ehrenamtliche könnten wir unser Programm gar nicht anbieten. Zurzeit helfen uns etwa 25 Menschen regelmäßig. Manche unterstützen bei Veranstaltungen, andere geben Hausaufgabenhilfe oder begleiten ältere Menschen bei digitalen Fragen.

Moderator: Sie haben gerade ältere Menschen erwähnt. Gibt es spezielle Angebote für sie?

Frau Keller: Ja. Jeden Mittwochvormittag gibt es einen offenen Treff für Seniorinnen und Senioren. Außerdem bieten wir einmal im Monat eine Smartphone-Sprechstunde an. Dort erklären Ehrenamtliche zum Beispiel, wie man Nachrichten verschickt, Fotos speichert oder eine Fahrkarte mit dem Handy kauft.

Moderator: Das klingt praktisch. Und wie sieht es mit Jugendlichen aus?

Frau Keller: Auch für Jugendliche gibt es einiges. Freitags am frühen Abend haben wir einen offenen Jugendtreff. Dort können sie Musik hören, Tischtennis spielen oder einfach miteinander reden. Ab nächsten Monat wollen wir außerdem einen kleinen Medienworkshop anbieten.

Moderator: Wie sind denn die Öffnungszeiten?

Frau Keller: Von Montag bis Freitag sind wir normalerweise von neun bis zwanzig Uhr geöffnet. Samstags öffnen wir von zehn bis sechzehn Uhr. Sonntags ist das Zentrum geschlossen, außer wenn eine besondere Veranstaltung stattfindet.

Moderator: Und wie haben die Menschen im Stadtteil bisher reagiert?

Frau Keller: Sehr positiv. In den ersten drei Wochen kamen schon über 600 Besucher. Besonders gut besucht waren das Eröffnungsfest und die Sprachcafés. Wir haben allerdings gemerkt, dass viele Bewohner noch gar nicht genau wissen, welche Angebote es gibt.

Moderator: Was wollen Sie dagegen tun?

Frau Keller: Wir möchten stärker informieren. Neben unserer Internetseite verteilen wir jetzt Flyer in Schulen, Arztpraxen und Geschäften. Außerdem wollen wir über soziale Medien mehr Menschen erreichen.

Moderator: Gibt es schon Pläne für die Zukunft?

Frau Keller: Ja. Wenn alles gut läuft, möchten wir im nächsten Frühjahr einen kleinen Gemeinschaftsgarten hinter dem Gebäude anlegen. Dort könnten Kinder und Erwachsene gemeinsam Gemüse und Kräuter anbauen.

Moderator: Frau Keller, vielen Dank für das Gespräch.

Frau Keller: Sehr gerne.`,
    questions: [
      {
        questionNumber: 46,
        prompt:
          'Das Stadtteilzentrum wurde eingerichtet, weil es vorher keinen gemeinsamen Treffpunkt im Viertel gab.',
        correctAnswer: '+',
        sortOrder: 0,
      },
      {
        questionNumber: 47,
        prompt: 'Das Zentrum bietet nur Freizeitaktivitäten an.',
        correctAnswer: '-',
        sortOrder: 1,
      },
      {
        questionNumber: 48,
        prompt: 'Für alle Veranstaltungen muss man sich vorher anmelden.',
        correctAnswer: '-',
        sortOrder: 2,
      },
      {
        questionNumber: 49,
        prompt: 'Einige Kurse kosten eine kleine Gebühr.',
        correctAnswer: '+',
        sortOrder: 3,
      },
      {
        questionNumber: 50,
        prompt:
          'Das Zentrum wird ausschließlich von privaten Unternehmen finanziert.',
        correctAnswer: '-',
        sortOrder: 4,
      },
      {
        questionNumber: 51,
        prompt: 'Im Zentrum arbeiten auch viele ehrenamtliche Helfer.',
        correctAnswer: '+',
        sortOrder: 5,
      },
      {
        questionNumber: 52,
        prompt: 'Für ältere Menschen gibt es Hilfe bei der Nutzung von Smartphones.',
        correctAnswer: '+',
        sortOrder: 6,
      },
      {
        questionNumber: 53,
        prompt: 'Der Jugendtreff findet sonntags statt.',
        correctAnswer: '-',
        sortOrder: 7,
      },
      {
        questionNumber: 54,
        prompt: 'Das Zentrum ist an normalen Sonntagen geschlossen.',
        correctAnswer: '+',
        sortOrder: 8,
      },
      {
        questionNumber: 55,
        prompt: 'Hinter dem Gebäude gibt es bereits einen Gemeinschaftsgarten.',
        correctAnswer: '-',
        sortOrder: 9,
      },
    ],
    audioUrl: `${R2}/modelltest-4-hoeren/modelltest-4-hoeren-teil2.mp3`,
    imageUrl: '',
    durationMinutes: 10,
  },
  teil3: {
    part: 3,
    title: 'Teil 3',
    subtitle: 'Hörverstehen, Teil 3',
    instruction:
      'Sie hören nun fünf kurze Texte. Dazu sollen Sie fünf Aufgaben lösen. Sie hören jeden Text zweimal. Entscheiden Sie beim Hören, ob die Aussagen 56–60 richtig oder falsch sind. Markieren Sie Ihre Lösungen für die Aufgaben 56–60 auf dem Antwortbogen. Markieren Sie PLUS (+) gleich richtig und MINUS (–) gleich falsch.',
    contentRevision: 'modelltest-4-hoeren-teil3-v1',
    transcript: `56
Guten Tag. Hier ist die Stadtbibliothek Süd. Wegen einer internen Veranstaltung schließen wir heute bereits um 16 Uhr. Morgen sind wir wieder wie gewohnt von 9 bis 19 Uhr für Sie da. Bereits ausgeliehene Bücher können Sie auch nach der Schließung am Automaten vor dem Eingang zurückgeben.

57
Achtung, Fahrgäste der Straßenbahnlinie 3. Wegen Bauarbeiten fährt die Linie heute nicht bis zum Hauptbahnhof. Bitte steigen Sie an der Haltestelle Rathaus aus und benutzen Sie von dort den Ersatzbus. Die Fahrkarten der Straßenbahn gelten selbstverständlich auch im Bus.

58
Und nun der Wetterbericht für morgen. Am Vormittag bleibt es in der ganzen Region trocken. Gegen Mittag ziehen von Westen Wolken auf. Am Nachmittag muss besonders im Stadtgebiet mit kräftigem Regen gerechnet werden. Die Temperaturen erreichen höchstens 17 Grad.

59
Herzlich willkommen im Einkaufszentrum CityPoint. Heute findet in der ersten Etage unser Aktionstag statt. Zwischen 14 und 18 Uhr können Kinder dort kostenlos an einem Malworkshop teilnehmen. Die Eltern müssen ihre Kinder vorher am Informationsstand im Erdgeschoss anmelden.

60
Liebe Besucherinnen und Besucher des Stadtparks. Das für heute Abend geplante Konzert am See muss wegen des starken Windes leider ausfallen. Bereits gekaufte Eintrittskarten behalten ihre Gültigkeit für den Ersatztermin am kommenden Freitag. Weitere Informationen finden Sie auf unserer Internetseite.`,
    questions: [
      {
        questionNumber: 56,
        prompt: 'Die Stadtbibliothek schließt heute früher als normalerweise.',
        correctAnswer: '+',
        sortOrder: 0,
      },
      {
        questionNumber: 57,
        prompt: 'Die Straßenbahnlinie 3 fährt heute bis zum Hauptbahnhof.',
        correctAnswer: '-',
        sortOrder: 1,
      },
      {
        questionNumber: 58,
        prompt: 'Am Nachmittag bleibt es im Stadtgebiet trocken.',
        correctAnswer: '-',
        sortOrder: 2,
      },
      {
        questionNumber: 59,
        prompt: 'Kinder können kostenlos an einem Malworkshop teilnehmen.',
        correctAnswer: '+',
        sortOrder: 3,
      },
      {
        questionNumber: 60,
        prompt: 'Das Konzert im Stadtpark findet heute Abend statt.',
        correctAnswer: '-',
        sortOrder: 4,
      },
    ],
    audioUrl: `${R2}/modelltest-4-hoeren/modelltest-4-hoeren-teil3.mp3`,
    imageUrl: '',
    durationMinutes: 8,
  },
};

const hoerenAnswerKey = {
  hoerenTeil1: { '41': '+', '42': '-', '43': '+', '44': '-', '45': '+' },
  hoerenTeil2: {
    '46': '+',
    '47': '-',
    '48': '-',
    '49': '+',
    '50': '-',
    '51': '+',
    '52': '+',
    '53': '-',
    '54': '+',
    '55': '-',
  },
  hoerenTeil3: { '56': '+', '57': '-', '58': '-', '59': '+', '60': '-' },
};

if (!fs.existsSync(partialPath)) {
  throw new Error(`Missing ${partialPath}`);
}

const partial = JSON.parse(fs.readFileSync(partialPath, 'utf8'));
partial.sections.hoeren = hoeren;
partial.answerKey = { ...partial.answerKey, ...hoerenAnswerKey };
partial.extractionWarnings = partial.extractionWarnings ?? [];

fs.writeFileSync(outPath, `${JSON.stringify(partial, null, 2)}\n`, 'utf8');
console.log('Wrote', outPath);
