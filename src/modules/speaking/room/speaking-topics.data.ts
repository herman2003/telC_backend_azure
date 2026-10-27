import type { CefrLevel } from '@prisma/client';

/**
 * A Live Room is opened at a CEFR level, not at B1.
 *
 * This was the literal `'B1'`, which made the level a protocol constant: a
 * student on any other level got a 400 from the validators below, on a
 * feature Start sells as unlimited. Whether a level has topics is a content
 * question — answered by `pickTopic`, with a reason — rather than a shape the
 * request is allowed to have.
 *
 * Catalogue shape is always Teil 2 (two positions + follow-ups) so Live Room
 * and Mit Elena share one card. At A1/A2 that maps to everyday preferences
 * for an Alltagsgespräch (telc Start Deutsch 1/2), not a B1/B2 Diskussion.
 * Themes follow published practice sets and our Modelltest papers (Einkaufen,
 * Essen, Freizeit, Wohnen, Urlaub, …).
 */
export type SpeakingLevel = CefrLevel;

export interface SpeakingTopic {
  id: string;
  level: SpeakingLevel;
  teil: 2;
  title: string;
  positionA: string;
  positionB: string;
  followUpQuestions: string[];
}

export const SPEAKING_TOPICS: SpeakingTopic[] = [
  // ─── A1 ──────────────────────────────────────────────────────────────────
  //
  // telc A1 Teil 2: Um Informationen bitten und Informationen geben — short
  // questions on an everyday card theme. Ten starter cards; keep language
  // short enough for Start Deutsch 1.
  {
    id: 'a1-t2-001',
    level: 'A1',
    teil: 2,
    title: 'Einkaufen',
    positionA:
      'Ich kaufe gern im Supermarkt ein. Das ist schnell und praktisch.',
    positionB: 'Ich kaufe gern auf dem Markt ein. Das Obst ist frisch.',
    followUpQuestions: [
      'Wo kaufen Sie ein?',
      'Wann gehen Sie einkaufen?',
      'Was kaufen Sie oft?',
    ],
  },
  {
    id: 'a1-t2-002',
    level: 'A1',
    teil: 2,
    title: 'Essen und Trinken',
    positionA: 'Zum Frühstück esse ich gern Brot mit Käse und trinke Tee.',
    positionB: 'Zum Frühstück esse ich gern Müsli und trinke Kaffee.',
    followUpQuestions: [
      'Was essen Sie zum Frühstück?',
      'Was trinken Sie gern?',
      'Essen Sie gern Fisch?',
    ],
  },
  {
    id: 'a1-t2-003',
    level: 'A1',
    teil: 2,
    title: 'Freizeit',
    positionA: 'Am Wochenende treffe ich Freunde und wir gehen spazieren.',
    positionB: 'Am Wochenende bleibe ich zu Hause und sehe fern.',
    followUpQuestions: [
      'Was machen Sie am Sonntag?',
      'Mit wem verbringen Sie die Freizeit?',
      'Wann haben Sie Zeit?',
    ],
  },
  {
    id: 'a1-t2-004',
    level: 'A1',
    teil: 2,
    title: 'Wohnen',
    positionA: 'Ich wohne in einer Wohnung in der Stadt. Das ist zentral.',
    positionB: 'Ich wohne in einem Haus auf dem Land. Das ist ruhig.',
    followUpQuestions: [
      'Wo wohnen Sie?',
      'Wie viele Zimmer hat Ihre Wohnung?',
      'Wohnen Sie allein oder mit Familie?',
    ],
  },
  {
    id: 'a1-t2-005',
    level: 'A1',
    teil: 2,
    title: 'Familie',
    positionA: 'Ich habe eine große Familie. Wir treffen uns oft.',
    positionB: 'Meine Familie ist klein. Wir telefonieren oft.',
    followUpQuestions: [
      'Haben Sie Geschwister?',
      'Wo wohnen Ihre Eltern?',
      'Wann sehen Sie Ihre Familie?',
    ],
  },
  {
    id: 'a1-t2-006',
    level: 'A1',
    teil: 2,
    title: 'Arbeit und Kurs',
    positionA: 'Ich arbeite und lerne Deutsch am Abend.',
    positionB: 'Ich gehe in einen Deutschkurs und habe noch keine Arbeit.',
    followUpQuestions: [
      'Wo arbeiten Sie?',
      'Wann haben Sie Feierabend?',
      'Lernen Sie gern Deutsch?',
    ],
  },
  {
    id: 'a1-t2-007',
    level: 'A1',
    teil: 2,
    title: 'Wetter',
    positionA: 'Bei Sonne gehe ich gern spazieren.',
    positionB: 'Bei Regen bleibe ich lieber zu Hause.',
    followUpQuestions: [
      'Wie ist das Wetter heute?',
      'Was machen Sie bei Regen?',
      'Welche Jahreszeit mögen Sie?',
    ],
  },
  {
    id: 'a1-t2-008',
    level: 'A1',
    teil: 2,
    title: 'Verkehr',
    positionA: 'Ich fahre mit dem Bus. Das ist günstig.',
    positionB: 'Ich fahre mit dem Auto. Das ist schnell.',
    followUpQuestions: [
      'Wie kommen Sie zur Arbeit?',
      'Fahren Sie gern Fahrrad?',
      'Wo ist die Bushaltestelle?',
    ],
  },
  {
    id: 'a1-t2-009',
    level: 'A1',
    teil: 2,
    title: 'Kleidung',
    positionA: 'Ich trage gern bequeme Kleidung, zum Beispiel Jeans.',
    positionB: 'Ich trage gern schöne Kleidung, zum Beispiel ein Kleid.',
    followUpQuestions: [
      'Welche Farbe hat Ihre Jacke?',
      'Wo kaufen Sie Kleidung?',
      'Was tragen Sie am Wochenende?',
    ],
  },
  {
    id: 'a1-t2-010',
    level: 'A1',
    teil: 2,
    title: 'Tagesablauf',
    positionA: 'Ich stehe früh auf und frühstücke zu Hause.',
    positionB: 'Ich stehe spät auf und frühstücke schnell.',
    followUpQuestions: [
      'Wann stehen Sie auf?',
      'Was machen Sie am Morgen?',
      'Wann gehen Sie schlafen?',
    ],
  },

  // ─── A2 ──────────────────────────────────────────────────────────────────
  //
  // telc A2 Teil 2: Ein Alltagsgespräch führen — W-Fragen zu einem Thema
  // (Urlaub, Wohnen, Gesundheit, …). Positions stay simple preferences so
  // two partners can start talking; follow-ups mirror exam question cards.
  {
    id: 'a2-t2-001',
    level: 'A2',
    teil: 2,
    title: 'Urlaub',
    positionA:
      'Im Urlaub fahre ich gern ans Meer. Ich schwimme und entspanne mich.',
    positionB:
      'Im Urlaub besuche ich gern Städte. Ich schaue Museen und Cafés an.',
    followUpQuestions: [
      'Wohin möchten Sie fahren?',
      'Wann machen Sie Urlaub?',
      'Mit wem fahren Sie gern?',
    ],
  },
  {
    id: 'a2-t2-002',
    level: 'A2',
    teil: 2,
    title: 'Einkaufen',
    positionA:
      'Lebensmittel kaufe ich im Supermarkt, Kleidung manchmal im Internet.',
    positionB:
      'Ich kaufe lieber im Geschäft. Ich möchte die Dinge sehen und anprobieren.',
    followUpQuestions: [
      'Wo kaufen Sie Obst und Gemüse?',
      'Wie oft gehen Sie einkaufen?',
      'Bezahlen Sie mit Karte oder mit Bargeld?',
    ],
  },
  {
    id: 'a2-t2-003',
    level: 'A2',
    teil: 2,
    title: 'Wohnen',
    positionA: 'Ich wohne gern in der Stadt, weil alles nah ist.',
    positionB: 'Ich wohne gern ruhig, mit einem Balkon oder Garten.',
    followUpQuestions: [
      'Wo wohnen Sie, in der Stadt oder auf dem Land?',
      'Wie lange wohnen Sie schon dort?',
      'Was gefällt Ihnen an Ihrer Wohnung?',
    ],
  },
  {
    id: 'a2-t2-004',
    level: 'A2',
    teil: 2,
    title: 'Essen und Trinken',
    positionA: 'Am Mittag esse ich oft in der Kantine. Das geht schnell.',
    positionB: 'Am Mittag koche ich gern selbst. Das schmeckt besser.',
    followUpQuestions: [
      'Was essen Sie am liebsten zum Frühstück?',
      'Wie oft gehen Sie ins Restaurant?',
      'Was kochen Sie am Wochenende?',
    ],
  },
  {
    id: 'a2-t2-005',
    level: 'A2',
    teil: 2,
    title: 'Freizeit',
    positionA:
      'In der Freizeit mache ich Sport, zum Beispiel Joggen oder Schwimmen.',
    positionB: 'In der Freizeit lese ich oder treffe Freunde im Café.',
    followUpQuestions: [
      'Wann haben Sie in der Woche Freizeit?',
      'Mit wem machen Sie am Wochenende etwas?',
      'Wohin gehen Sie gern in der Stadt?',
    ],
  },
  {
    id: 'a2-t2-006',
    level: 'A2',
    teil: 2,
    title: 'Gesundheit',
    positionA: 'Wenn ich krank bin, bleibe ich im Bett und trinke Tee.',
    positionB: 'Wenn ich krank bin, gehe ich schnell zum Arzt.',
    followUpQuestions: [
      'Wie oft gehen Sie zum Arzt?',
      'Was machen Sie, wenn Sie erkältet sind?',
      'Machen Sie etwas für Ihre Gesundheit?',
    ],
  },
  {
    id: 'a2-t2-007',
    level: 'A2',
    teil: 2,
    title: 'Arbeit und Schule',
    positionA: 'Ich arbeite tagsüber und lerne abends Deutsch.',
    positionB: 'Ich gehe in die Schule oder in den Kurs und lerne viel.',
    followUpQuestions: [
      'Wo arbeiten oder lernen Sie?',
      'Wann beginnen Sie am Morgen?',
      'Was machen Sie in der Pause?',
    ],
  },
  {
    id: 'a2-t2-008',
    level: 'A2',
    teil: 2,
    title: 'Tagesablauf',
    positionA: 'Mein Tag ist früh: aufstehen, frühstücken, dann zur Arbeit.',
    positionB:
      'Mein Tag beginnt später; abends habe ich mehr Zeit für Freunde.',
    followUpQuestions: [
      'Was machen Sie morgens zuerst?',
      'Wohin gehen Sie nach der Arbeit?',
      'Wann haben Sie Feierabend?',
    ],
  },
  {
    id: 'a2-t2-009',
    level: 'A2',
    teil: 2,
    title: 'Hobby',
    positionA:
      'Mein Hobby ist Musik. Ich höre gern Songs und gehe zu Konzerten.',
    positionB: 'Mein Hobby ist Sport. Ich spiele Fußball oder gehe schwimmen.',
    followUpQuestions: [
      'Welches Hobby haben Sie?',
      'Wann machen Sie das?',
      'Mit wem machen Sie das gern?',
    ],
  },
  {
    id: 'a2-t2-010',
    level: 'A2',
    teil: 2,
    title: 'Wochenende',
    positionA: 'Am Wochenende schlafe ich aus und treffe dann die Familie.',
    positionB: 'Am Wochenende plane ich Ausflüge oder mache den Haushalt.',
    followUpQuestions: [
      'Was machen Sie am Samstag?',
      'Wie lange schlafen Sie am Sonntag?',
      'Wohin fahren Sie gern am Wochenende?',
    ],
  },

  // ─── B1 ──────────────────────────────────────────────────────────────────
  {
    id: 'b1-t2-001',
    level: 'B1',
    teil: 2,
    title: 'Reisen mit einer Gruppe',
    positionA: 'Gruppenreisen sind praktisch, weil alles organisiert ist.',
    positionB: 'Allein zu reisen gibt mehr Freiheit und Ruhe.',
    followUpQuestions: [
      'Wie reisen Sie am liebsten?',
      'Welche Erfahrungen haben Sie mit Gruppenreisen?',
      'Was ist bei einer Reise besonders wichtig?',
    ],
  },
  {
    id: 'b1-t2-002',
    level: 'B1',
    teil: 2,
    title: 'Urlaub im eigenen Land',
    positionA: 'Urlaub im eigenen Land ist günstig und unkompliziert.',
    positionB: 'Im Urlaub möchte ich neue Länder und Kulturen kennenlernen.',
    followUpQuestions: [
      'Wo verbringen Sie normalerweise Ihren Urlaub?',
      'Welche Vorteile hat Urlaub in der Nähe?',
      'Welches Reiseziel möchten Sie besuchen?',
    ],
  },
  {
    id: 'b1-t2-003',
    level: 'B1',
    teil: 2,
    title: 'Auto oder öffentliche Verkehrsmittel',
    positionA: 'Mit dem Auto ist man unabhängig und flexibel.',
    positionB: 'Bus und Bahn sind besser für die Umwelt und oft entspannter.',
    followUpQuestions: [
      'Welche Verkehrsmittel benutzen Sie täglich?',
      'Wann ist ein Auto sinnvoll?',
      'Wie könnte der öffentliche Verkehr besser werden?',
    ],
  },
  {
    id: 'b1-t2-004',
    level: 'B1',
    teil: 2,
    title: 'Fahrrad in der Stadt',
    positionA: 'Das Fahrrad ist das beste Verkehrsmittel für kurze Wege.',
    positionB: 'Radfahren in der Stadt ist zu gefährlich und unpraktisch.',
    followUpQuestions: [
      'Fahren Sie oft Fahrrad?',
      'Was brauchen sichere Fahrradwege?',
      'Für welche Wege eignet sich das Fahrrad nicht?',
    ],
  },
  {
    id: 'b1-t2-005',
    level: 'B1',
    teil: 2,
    title: 'Arbeiten im Homeoffice',
    positionA: 'Im Homeoffice kann man ruhig und flexibel arbeiten.',
    positionB: 'Im Büro ist der Kontakt mit Kolleginnen und Kollegen besser.',
    followUpQuestions: [
      'Wo arbeiten Sie lieber?',
      'Welche Probleme kann Homeoffice verursachen?',
      'Wie sieht ein guter Arbeitsplatz aus?',
    ],
  },
  {
    id: 'b1-t2-006',
    level: 'B1',
    teil: 2,
    title: 'Vier-Tage-Woche',
    positionA: 'Vier Arbeitstage bringen mehr Freizeit und Motivation.',
    positionB: 'In vier Tagen ist die gleiche Arbeit kaum zu schaffen.',
    followUpQuestions: [
      'Wie viele Tage möchten Sie arbeiten?',
      'Was macht Arbeitszeiten angenehm?',
      'Welche Berufe eignen sich für dieses Modell?',
    ],
  },
  {
    id: 'b1-t2-007',
    level: 'B1',
    teil: 2,
    title: 'Beruf oder gutes Gehalt',
    positionA: 'Eine interessante Arbeit ist wichtiger als ein hohes Gehalt.',
    positionB: 'Ein gutes Gehalt gibt Sicherheit und ist deshalb wichtiger.',
    followUpQuestions: [
      'Was ist Ihnen bei der Arbeit wichtig?',
      'Was macht einen Beruf interessant?',
      'Würden Sie für mehr Geld länger arbeiten?',
    ],
  },
  {
    id: 'b1-t2-008',
    level: 'B1',
    teil: 2,
    title: 'Weiterbildung neben dem Beruf',
    positionA: 'Weiterbildung verbessert die beruflichen Chancen.',
    positionB: 'Nach der Arbeit braucht man Erholung statt weiterer Kurse.',
    followUpQuestions: [
      'Haben Sie schon eine Weiterbildung gemacht?',
      'Wie kann man Lernen und Arbeit verbinden?',
      'Welche Fähigkeiten möchten Sie lernen?',
    ],
  },
  {
    id: 'b1-t2-009',
    level: 'B1',
    teil: 2,
    title: 'Online lernen',
    positionA: 'Onlinekurse sind flexibel und sparen Zeit.',
    positionB: 'Im Kursraum lernt man besser mit anderen Menschen.',
    followUpQuestions: [
      'Wie lernen Sie am liebsten?',
      'Was braucht ein guter Onlinekurs?',
      'Welche Rolle spielt die Lehrkraft?',
    ],
  },
  {
    id: 'b1-t2-010',
    level: 'B1',
    teil: 2,
    title: 'Hausaufgaben',
    positionA: 'Hausaufgaben helfen, den Unterrichtsstoff zu üben.',
    positionB:
      'Lernen sollte in der Schule stattfinden, damit Freizeit frei bleibt.',
    followUpQuestions: [
      'Welche Erfahrungen haben Sie mit Hausaufgaben?',
      'Wie viel Übung ist sinnvoll?',
      'Was hilft beim selbstständigen Lernen?',
    ],
  },
  {
    id: 'b1-t2-011',
    level: 'B1',
    teil: 2,
    title: 'Noten in der Schule',
    positionA: 'Noten zeigen klar, wie gut eine Leistung ist.',
    positionB: 'Persönliche Rückmeldungen helfen mehr als Zahlen.',
    followUpQuestions: [
      'Sind Noten gerecht?',
      'Wie kann man Leistung anders bewerten?',
      'Was motiviert Schülerinnen und Schüler?',
    ],
  },
  {
    id: 'b1-t2-012',
    level: 'B1',
    teil: 2,
    title: 'Fremdsprachen lernen',
    positionA: 'Man lernt eine Sprache am besten in einem Kurs.',
    positionB: 'Im Alltag und durch Gespräche lernt man schneller.',
    followUpQuestions: [
      'Wie lernen Sie Deutsch?',
      'Was ist beim Sprachenlernen schwierig?',
      'Welche Methoden helfen Ihnen?',
    ],
  },
  {
    id: 'b1-t2-013',
    level: 'B1',
    teil: 2,
    title: 'Smartphones im Unterricht',
    positionA: 'Smartphones können beim Lernen nützlich sein.',
    positionB: 'Smartphones lenken ab und gehören nicht in den Unterricht.',
    followUpQuestions: [
      'Wie können Smartphones beim Lernen helfen?',
      'Wann stören sie?',
      'Welche Regeln wären sinnvoll?',
    ],
  },
  {
    id: 'b1-t2-014',
    level: 'B1',
    teil: 2,
    title: 'Kinder und soziale Medien',
    positionA: 'Soziale Medien helfen Kindern, Kontakte zu pflegen.',
    positionB:
      'Kinder sollten soziale Medien erst ab einem höheren Alter nutzen.',
    followUpQuestions: [
      'Ab welchem Alter sind soziale Medien sinnvoll?',
      'Welche Gefahren gibt es?',
      'Wie können Eltern unterstützen?',
    ],
  },
  {
    id: 'b1-t2-015',
    level: 'B1',
    teil: 2,
    title: 'Nachrichten im Internet',
    positionA: 'Online findet man Nachrichten schnell und kostenlos.',
    positionB:
      'Zeitungen und öffentlich-rechtliche Angebote sind zuverlässiger.',
    followUpQuestions: [
      'Wo informieren Sie sich?',
      'Wie erkennt man falsche Nachrichten?',
      'Welche Themen interessieren Sie?',
    ],
  },
  {
    id: 'b1-t2-016',
    level: 'B1',
    teil: 2,
    title: 'Handyfreie Zeit',
    positionA: 'Jeden Tag sollte es feste Zeiten ohne Handy geben.',
    positionB: 'Jeder kann selbst entscheiden, wann er sein Handy benutzt.',
    followUpQuestions: [
      'Wie oft benutzen Sie Ihr Handy?',
      'Wann sollte das Handy ausgeschaltet sein?',
      'Was machen Sie gern ohne Bildschirm?',
    ],
  },
  {
    id: 'b1-t2-017',
    level: 'B1',
    teil: 2,
    title: 'Online einkaufen',
    positionA: 'Online einzukaufen ist bequem und bietet viel Auswahl.',
    positionB:
      'Im Geschäft bekommt man Beratung und kann Produkte direkt sehen.',
    followUpQuestions: [
      'Wo kaufen Sie lieber ein?',
      'Was bestellen Sie nicht online?',
      'Wie wichtig ist Beratung?',
    ],
  },
  {
    id: 'b1-t2-018',
    level: 'B1',
    teil: 2,
    title: 'Gebrauchte Sachen kaufen',
    positionA: 'Gebrauchte Produkte sind günstig und gut für die Umwelt.',
    positionB: 'Neue Produkte sind zuverlässiger und haben eine Garantie.',
    followUpQuestions: [
      'Was würden Sie gebraucht kaufen?',
      'Welche Erfahrungen haben Sie damit?',
      'Warum werfen Menschen brauchbare Dinge weg?',
    ],
  },
  {
    id: 'b1-t2-019',
    level: 'B1',
    teil: 2,
    title: 'Bargeld oder Karte',
    positionA: 'Mit Karte zu bezahlen ist schnell und praktisch.',
    positionB: 'Mit Bargeld behält man seine Ausgaben besser im Blick.',
    followUpQuestions: [
      'Wie bezahlen Sie meistens?',
      'Welche Zahlungsart ist sicherer?',
      'Sollte Bargeld erhalten bleiben?',
    ],
  },
  {
    id: 'b1-t2-020',
    level: 'B1',
    teil: 2,
    title: 'Werbung',
    positionA: 'Werbung informiert über neue und nützliche Produkte.',
    positionB: 'Werbung beeinflusst Menschen und schafft unnötige Wünsche.',
    followUpQuestions: [
      'Welche Werbung bemerken Sie?',
      'Hat Werbung Sie schon zu einem Kauf bewegt?',
      'Wo sollte Werbung begrenzt werden?',
    ],
  },
  {
    id: 'b1-t2-021',
    level: 'B1',
    teil: 2,
    title: 'Wohnung in der Stadt',
    positionA:
      'In der Stadt sind Arbeit, Kultur und Geschäfte schnell erreichbar.',
    positionB: 'Auf dem Land lebt man ruhiger und näher an der Natur.',
    followUpQuestions: [
      'Wo wohnen Sie lieber?',
      'Was ist Ihnen an einem Wohnort wichtig?',
      'Welche Nachteile hat das Stadtleben?',
    ],
  },
  {
    id: 'b1-t2-022',
    level: 'B1',
    teil: 2,
    title: 'Allein oder in einer Wohngemeinschaft',
    positionA:
      'In einer Wohngemeinschaft ist man nicht allein und teilt Kosten.',
    positionB: 'Eine eigene Wohnung bietet mehr Ruhe und Privatsphäre.',
    followUpQuestions: [
      'Welche Wohnform kennen Sie?',
      'Was muss man in einer WG regeln?',
      'Wie wichtig ist Privatsphäre?',
    ],
  },
  {
    id: 'b1-t2-023',
    level: 'B1',
    teil: 2,
    title: 'Haustiere in der Wohnung',
    positionA: 'Haustiere bereichern das Leben und geben Gesellschaft.',
    positionB: 'In kleinen Wohnungen sind Tiere oft nicht gut aufgehoben.',
    followUpQuestions: [
      'Haben Sie ein Haustier?',
      'Welche Verantwortung bedeutet ein Tier?',
      'Welche Tiere eignen sich für Wohnungen?',
    ],
  },
  {
    id: 'b1-t2-024',
    level: 'B1',
    teil: 2,
    title: 'Nachbarschaft',
    positionA: 'Gute Nachbarn sollten regelmäßig Kontakt miteinander haben.',
    positionB: 'Freundliche Distanz verhindert Probleme in der Nachbarschaft.',
    followUpQuestions: [
      'Kennen Sie Ihre Nachbarn?',
      'Wobei können Nachbarn helfen?',
      'Wie löst man Konflikte im Haus?',
    ],
  },
  {
    id: 'b1-t2-025',
    level: 'B1',
    teil: 2,
    title: 'Familienfeiern',
    positionA: 'Große Familienfeiern stärken den Zusammenhalt.',
    positionB: 'Kleine Treffen sind persönlicher und weniger anstrengend.',
    followUpQuestions: [
      'Wie feiern Sie mit Ihrer Familie?',
      'Was macht eine Feier angenehm?',
      'Wer sollte die Organisation übernehmen?',
    ],
  },
  {
    id: 'b1-t2-026',
    level: 'B1',
    teil: 2,
    title: 'Freundschaften im Internet',
    positionA:
      'Online kann man echte Freundschaften über große Entfernungen pflegen.',
    positionB: 'Für eine enge Freundschaft muss man sich persönlich treffen.',
    followUpQuestions: [
      'Wie halten Sie Kontakt zu Freunden?',
      'Kann eine Onlinefreundschaft genauso eng sein?',
      'Was ist in einer Freundschaft wichtig?',
    ],
  },
  {
    id: 'b1-t2-027',
    level: 'B1',
    teil: 2,
    title: 'Gemeinsame Mahlzeiten',
    positionA: 'Familien sollten mindestens einmal täglich gemeinsam essen.',
    positionB: 'Unterschiedliche Tagespläne machen feste Mahlzeiten unnötig.',
    followUpQuestions: [
      'Essen Sie oft mit anderen?',
      'Warum sind gemeinsame Mahlzeiten wichtig?',
      'Wer kocht bei Ihnen?',
    ],
  },
  {
    id: 'b1-t2-028',
    level: 'B1',
    teil: 2,
    title: 'Kinderbetreuung',
    positionA: 'Kleine Kinder profitieren früh von einer Kindertagesstätte.',
    positionB: 'Kleine Kinder sollten möglichst lange zu Hause betreut werden.',
    followUpQuestions: [
      'Welche Betreuung ist gut für Kinder?',
      'Welche Vorteile bietet eine Kita?',
      'Wie können Familien unterstützt werden?',
    ],
  },
  {
    id: 'b1-t2-029',
    level: 'B1',
    teil: 2,
    title: 'Sport im Verein',
    positionA:
      'Im Verein trainiert man regelmäßig und lernt neue Leute kennen.',
    positionB: 'Individuell Sport zu machen ist flexibler und günstiger.',
    followUpQuestions: [
      'Welchen Sport machen Sie?',
      'Was bietet ein Sportverein?',
      'Wie motivieren Sie sich zum Training?',
    ],
  },
  {
    id: 'b1-t2-030',
    level: 'B1',
    teil: 2,
    title: 'Fitnessstudio',
    positionA: 'Ein Fitnessstudio bietet Geräte und Training bei jedem Wetter.',
    positionB: 'Bewegung draußen ist angenehmer und kostet nichts.',
    followUpQuestions: [
      'Wo treiben Sie lieber Sport?',
      'Was motiviert zum regelmäßigen Training?',
      'Wie viel Bewegung braucht man?',
    ],
  },
  {
    id: 'b1-t2-031',
    level: 'B1',
    teil: 2,
    title: 'Gesunde Ernährung',
    positionA: 'Gesundes Essen muss täglich geplant und frisch gekocht werden.',
    positionB:
      'Auch mit wenig Zeit kann man sich ohne strenge Regeln ausgewogen ernähren.',
    followUpQuestions: [
      'Was bedeutet gesunde Ernährung für Sie?',
      'Wie oft kochen Sie?',
      'Was erschwert gesundes Essen?',
    ],
  },
  {
    id: 'b1-t2-032',
    level: 'B1',
    teil: 2,
    title: 'Vegetarisches Essen',
    positionA: 'Weniger Fleisch ist gut für Gesundheit, Tiere und Umwelt.',
    positionB:
      'Fleisch gehört für viele Menschen zu einer ausgewogenen Ernährung.',
    followUpQuestions: [
      'Wie oft essen Sie Fleisch?',
      'Welche vegetarischen Gerichte mögen Sie?',
      'Sollte es mehr fleischfreie Angebote geben?',
    ],
  },
  {
    id: 'b1-t2-033',
    level: 'B1',
    teil: 2,
    title: 'Fertiggerichte',
    positionA: 'Fertiggerichte sind eine praktische Lösung bei wenig Zeit.',
    positionB: 'Selbst gekochtes Essen schmeckt besser und ist gesünder.',
    followUpQuestions: [
      'Wann nutzen Sie Fertiggerichte?',
      'Was kochen Sie schnell?',
      'Wie wichtig sind Zutaten?',
    ],
  },
  {
    id: 'b1-t2-034',
    level: 'B1',
    teil: 2,
    title: 'Arztbesuch per Video',
    positionA: 'Eine Videosprechstunde spart Wege und Wartezeit.',
    positionB:
      'Eine gute Untersuchung ist nur persönlich in der Praxis möglich.',
    followUpQuestions: [
      'Würden Sie eine Videosprechstunde nutzen?',
      'Für welche Beschwerden eignet sie sich?',
      'Was ist beim Arztbesuch wichtig?',
    ],
  },
  {
    id: 'b1-t2-035',
    level: 'B1',
    teil: 2,
    title: 'Stress im Alltag',
    positionA: 'Ein genauer Tagesplan hilft gegen Stress.',
    positionB: 'Mehr freie Zeit ohne feste Pläne ist die beste Erholung.',
    followUpQuestions: [
      'Was verursacht bei Ihnen Stress?',
      'Wie erholen Sie sich?',
      'Welche Rolle spielt Zeitplanung?',
    ],
  },
  {
    id: 'b1-t2-036',
    level: 'B1',
    teil: 2,
    title: 'Früh aufstehen',
    positionA: 'Wer früh aufsteht, kann den Tag besser nutzen.',
    positionB: 'Menschen arbeiten zu unterschiedlichen Tageszeiten am besten.',
    followUpQuestions: [
      'Wann beginnt Ihr Tag?',
      'Wann sind Sie besonders produktiv?',
      'Wie wichtig ist genug Schlaf?',
    ],
  },
  {
    id: 'b1-t2-037',
    level: 'B1',
    teil: 2,
    title: 'Hobbys',
    positionA: 'Ein festes Hobby ist wichtig als Ausgleich zum Alltag.',
    positionB:
      'Man kann seine Freizeit spontan und ohne festes Hobby genießen.',
    followUpQuestions: [
      'Welche Hobbys haben Sie?',
      'Wie finden Menschen ein passendes Hobby?',
      'Wie viel Zeit sollte man dafür haben?',
    ],
  },
  {
    id: 'b1-t2-038',
    level: 'B1',
    teil: 2,
    title: 'Bücher oder Filme',
    positionA: 'Bücher lassen mehr Raum für Fantasie und Details.',
    positionB: 'Filme erzählen Geschichten lebendig und in kurzer Zeit.',
    followUpQuestions: [
      'Lesen Sie lieber oder sehen Sie Filme?',
      'Welches Buch oder welchen Film empfehlen Sie?',
      'Wo erleben Sie Geschichten am liebsten?',
    ],
  },
  {
    id: 'b1-t2-039',
    level: 'B1',
    teil: 2,
    title: 'Kino oder Streaming',
    positionA: 'Im Kino sind Bild, Ton und Atmosphäre besonders.',
    positionB: 'Streaming zu Hause ist bequemer und günstiger.',
    followUpQuestions: [
      'Wie sehen Sie Filme?',
      'Was gehört zu einem guten Filmabend?',
      'Hat das Kino eine Zukunft?',
    ],
  },
  {
    id: 'b1-t2-040',
    level: 'B1',
    teil: 2,
    title: 'Musikveranstaltungen',
    positionA: 'Livekonzerte bieten ein besonderes gemeinsames Erlebnis.',
    positionB: 'Musik zu Hause zu hören ist entspannter und viel günstiger.',
    followUpQuestions: [
      'Welche Musik hören Sie?',
      'Besuchen Sie Konzerte?',
      'Was macht Live-Musik besonders?',
    ],
  },
  {
    id: 'b1-t2-041',
    level: 'B1',
    teil: 2,
    title: 'Museen kostenlos',
    positionA:
      'Museen sollten kostenlos sein, damit alle Kultur erleben können.',
    positionB:
      'Eintrittspreise sind nötig, um gute Ausstellungen zu finanzieren.',
    followUpQuestions: [
      'Besuchen Sie Museen?',
      'Wer sollte Kultur bezahlen?',
      'Wie werden Museen interessanter?',
    ],
  },
  {
    id: 'b1-t2-042',
    level: 'B1',
    teil: 2,
    title: 'Feste in der Stadt',
    positionA: 'Stadtfeste bringen Menschen zusammen und beleben den Ort.',
    positionB: 'Große Feste verursachen Lärm, Müll und hohe Kosten.',
    followUpQuestions: [
      'Welche Feste kennen Sie?',
      'Was macht ein gutes Stadtfest aus?',
      'Wie kann man Störungen reduzieren?',
    ],
  },
  {
    id: 'b1-t2-043',
    level: 'B1',
    teil: 2,
    title: 'Ehrenamt',
    positionA: 'Jeder sollte einen Teil seiner Freizeit freiwillig helfen.',
    positionB: 'Hilfe ist wichtig, aber nicht jeder hat Zeit für ein Ehrenamt.',
    followUpQuestions: [
      'Haben Sie schon freiwillig geholfen?',
      'Welche Bereiche brauchen Unterstützung?',
      'Was motiviert Menschen zum Ehrenamt?',
    ],
  },
  {
    id: 'b1-t2-044',
    level: 'B1',
    teil: 2,
    title: 'Gemeinschaftsgarten',
    positionA:
      'Gemeinschaftsgärten verbessern das Viertel und verbinden Menschen.',
    positionB: 'Öffentliche Flächen sollten für Parks und Sport frei bleiben.',
    followUpQuestions: [
      'Gärtnern Sie gern?',
      'Was kann ein Gemeinschaftsgarten bieten?',
      'Wie teilt man die Arbeit gerecht?',
    ],
  },
  {
    id: 'b1-t2-045',
    level: 'B1',
    teil: 2,
    title: 'Müll vermeiden',
    positionA: 'Verbraucher müssen Produkte mit wenig Verpackung wählen.',
    positionB:
      'Hersteller und Politik tragen die Hauptverantwortung für weniger Müll.',
    followUpQuestions: [
      'Wie vermeiden Sie Müll?',
      'Welche Verpackungen sind unnötig?',
      'Wer kann am meisten verändern?',
    ],
  },
  {
    id: 'b1-t2-046',
    level: 'B1',
    teil: 2,
    title: 'Plastiktüten verbieten',
    positionA: 'Ein Verbot reduziert schnell unnötigen Plastikmüll.',
    positionB:
      'Information und freiwillige Änderungen sind besser als Verbote.',
    followUpQuestions: [
      'Benutzen Sie Stofftaschen?',
      'Wo ist Plastik schwer zu ersetzen?',
      'Welche Regeln helfen der Umwelt?',
    ],
  },
  {
    id: 'b1-t2-047',
    level: 'B1',
    teil: 2,
    title: 'Regionale Lebensmittel',
    positionA:
      'Regionale Produkte sind frischer und unterstützen lokale Betriebe.',
    positionB: 'Preis und Qualität sind wichtiger als die Herkunft.',
    followUpQuestions: [
      'Wo kaufen Sie Lebensmittel?',
      'Was bedeutet regional?',
      'Dürfen regionale Produkte mehr kosten?',
    ],
  },
  {
    id: 'b1-t2-048',
    level: 'B1',
    teil: 2,
    title: 'Kleidung und Mode',
    positionA: 'Mode ist eine wichtige Möglichkeit, Persönlichkeit zu zeigen.',
    positionB:
      'Kleidung sollte vor allem praktisch, langlebig und günstig sein.',
    followUpQuestions: [
      'Wie wichtig ist Mode für Sie?',
      'Wie oft kaufen Sie Kleidung?',
      'Was macht gute Kleidung aus?',
    ],
  },
  {
    id: 'b1-t2-049',
    level: 'B1',
    teil: 2,
    title: 'Reparieren statt wegwerfen',
    positionA: 'Kaputte Geräte sollten möglichst repariert werden.',
    positionB: 'Neue Geräte sind oft günstiger, sicherer und energiesparender.',
    followUpQuestions: [
      'Was haben Sie schon repariert?',
      'Warum sind Reparaturen manchmal teuer?',
      'Welche Geräte sollten länger halten?',
    ],
  },
  {
    id: 'b1-t2-050',
    level: 'B1',
    teil: 2,
    title: 'Urlaubsflüge',
    positionA: 'Flugreisen ermöglichen schnell den Besuch ferner Länder.',
    positionB: 'Für den Klimaschutz sollten Menschen seltener fliegen.',
    followUpQuestions: [
      'Wie oft fliegen Sie?',
      'Welche Alternativen gibt es?',
      'Sollten Flüge teurer sein?',
    ],
  },
  {
    id: 'b1-t2-051',
    level: 'B1',
    teil: 2,
    title: 'Deutsch am Arbeitsplatz',
    positionA:
      'Am Arbeitsplatz sollte möglichst nur Deutsch gesprochen werden.',
    positionB: 'Mehrere Sprachen können Teams und Kunden helfen.',
    followUpQuestions: [
      'Welche Sprachen nutzen Sie bei der Arbeit?',
      'Wann ist eine gemeinsame Sprache wichtig?',
      'Wie können Betriebe beim Deutschlernen helfen?',
    ],
  },
  {
    id: 'b1-t2-052',
    level: 'B1',
    teil: 2,
    title: 'Pünktlichkeit',
    positionA: 'Pünktlichkeit zeigt Respekt und ist immer wichtig.',
    positionB:
      'Bei privaten Treffen sollten kleine Verspätungen kein Problem sein.',
    followUpQuestions: [
      'Wie wichtig ist Pünktlichkeit für Sie?',
      'Wann ist eine Verspätung verständlich?',
      'Was tun Sie, wenn Sie zu spät kommen?',
    ],
  },
  {
    id: 'b1-t2-053',
    level: 'B1',
    teil: 2,
    title: 'Mittagspause gemeinsam verbringen',
    positionA: 'Gemeinsame Pausen verbessern das Verhältnis im Team.',
    positionB: 'In der Pause braucht man Ruhe und Zeit für sich.',
    followUpQuestions: [
      'Wie verbringen Sie Ihre Pause?',
      'Sollten Teams zusammen essen?',
      'Was gehört zu einer guten Pause?',
    ],
  },
  {
    id: 'b1-t2-054',
    level: 'B1',
    teil: 2,
    title: 'Arbeitskleidung',
    positionA: 'Einheitliche Kleidung wirkt professionell und praktisch.',
    positionB: 'Beschäftigte sollten ihre Kleidung selbst wählen dürfen.',
    followUpQuestions: [
      'Gibt es in Ihrem Beruf Arbeitskleidung?',
      'Wann ist sie notwendig?',
      'Wer sollte sie bezahlen?',
    ],
  },
  {
    id: 'b1-t2-055',
    level: 'B1',
    teil: 2,
    title: 'Bewerbungsgespräch online',
    positionA: 'Onlinegespräche sparen Bewerbenden und Firmen Zeit.',
    positionB: 'Persönlich bekommt man einen besseren Eindruck voneinander.',
    followUpQuestions: [
      'Hatten Sie schon ein Bewerbungsgespräch?',
      'Wie bereitet man sich online vor?',
      'Was ist für den ersten Eindruck wichtig?',
    ],
  },
  {
    id: 'b1-t2-056',
    level: 'B1',
    teil: 2,
    title: 'Geschenke',
    positionA: 'Persönliche Geschenke zeigen Aufmerksamkeit und Freude.',
    positionB: 'Gemeinsame Zeit ist wertvoller als gekaufte Dinge.',
    followUpQuestions: [
      'Was schenken Sie gern?',
      'Was war Ihr schönstes Geschenk?',
      'Sind Geldgeschenke unpersönlich?',
    ],
  },
  {
    id: 'b1-t2-057',
    level: 'B1',
    teil: 2,
    title: 'Geburtstag groß feiern',
    positionA: 'Ein Geburtstag ist ein guter Anlass für eine große Feier.',
    positionB: 'Ein ruhiger Tag mit wenigen vertrauten Menschen ist schöner.',
    followUpQuestions: [
      'Wie feiern Sie Ihren Geburtstag?',
      'Was kostet eine gute Feier?',
      'Welche Aufgaben gehören zur Organisation?',
    ],
  },
  {
    id: 'b1-t2-058',
    level: 'B1',
    teil: 2,
    title: 'Urlaubsfotos teilen',
    positionA: 'Fotos in sozialen Medien lassen Freunde an Reisen teilhaben.',
    positionB:
      'Private Reiseerlebnisse und Fotos gehören nicht öffentlich ins Internet.',
    followUpQuestions: [
      'Teilen Sie Urlaubsfotos?',
      'Welche Bilder sollten privat bleiben?',
      'Warum fotografieren Menschen auf Reisen?',
    ],
  },
  {
    id: 'b1-t2-059',
    level: 'B1',
    teil: 2,
    title: 'Wochenende planen',
    positionA: 'Mit einem Plan kann man das Wochenende besser nutzen.',
    positionB: 'Am Wochenende sollte man spontan entscheiden und sich erholen.',
    followUpQuestions: [
      'Planen Sie Ihr Wochenende?',
      'Was machen Sie bei schlechtem Wetter?',
      'Wie finden Sie Zeit für Erholung?',
    ],
  },
  {
    id: 'b1-t2-060',
    level: 'B1',
    teil: 2,
    title: 'Neue Menschen kennenlernen',
    positionA: 'Kurse und Vereine sind der beste Weg, neue Kontakte zu finden.',
    positionB: 'Freundschaften entstehen am besten spontan im Alltag.',
    followUpQuestions: [
      'Wo lernen Sie neue Menschen kennen?',
      'Was erleichtert ein erstes Gespräch?',
      'Wie bleibt man in Kontakt?',
    ],
  },

  // ─── B2 ──────────────────────────────────────────────────────────────────
  //
  // telc B2 Teil 2 is a Diskussion: a controversial societal question, read as
  // a short press text and then argued with a partner. The register is a step
  // up from B1's everyday choices — policy and principle rather than personal
  // preference — and the first card mirrors the theme of Uebungstest 1 so the
  // level is anchored to a real paper.
  //
  // Ten to start. A Live Room pairs two students, so the controversy is
  // carried as the two sides they argue.
  {
    id: 'b2-t2-001',
    level: 'B2',
    teil: 2,
    title: 'Getrennte Schulen für Mädchen und Jungen',
    positionA:
      'Getrennter Unterricht gibt Mädchen in Naturwissenschaften mehr Raum und bessere Chancen.',
    positionB:
      'Koedukation bereitet auf eine gemischte Gesellschaft vor; Trennung verstärkt Rollenbilder.',
    followUpQuestions: [
      'Welche Erfahrungen haben Sie mit gemischten Klassen gemacht?',
      'Woran könnte Chancengleichheit im Unterricht sonst scheitern?',
      'Welche Lösung halten Sie für realistisch?',
    ],
  },
  {
    id: 'b2-t2-002',
    level: 'B2',
    teil: 2,
    title: 'Homeoffice oder Präsenzpflicht',
    positionA:
      'Wer seine Arbeit von zu Hause erledigen kann, sollte selbst entscheiden dürfen.',
    positionB:
      'Ohne gemeinsame Präsenz leiden Zusammenarbeit, Einarbeitung und Zusammenhalt.',
    followUpQuestions: [
      'Was geht verloren, wenn ein Team sich kaum noch sieht?',
      'Wie ließe sich beides sinnvoll verbinden?',
      'Wer sollte diese Entscheidung treffen?',
    ],
  },
  {
    id: 'b2-t2-003',
    level: 'B2',
    teil: 2,
    title: 'Tempolimit auf Autobahnen',
    positionA:
      'Ein allgemeines Tempolimit senkt Unfallzahlen und Emissionen sofort und ohne Kosten.',
    positionB:
      'Der Nutzen ist gering, und die freie Geschwindigkeitswahl ist eine Frage der Eigenverantwortung.',
    followUpQuestions: [
      'Welche Argumente überzeugen Sie am meisten?',
      'Wie wird das in Ihrem Herkunftsland geregelt?',
      'Welche Massnahmen wären wirksamer?',
    ],
  },
  {
    id: 'b2-t2-004',
    level: 'B2',
    teil: 2,
    title: 'Handyverbot an Schulen',
    positionA:
      'Ein Verbot während der Schulzeit schützt Konzentration und das soziale Miteinander.',
    positionB:
      'Schule muss den verantwortungsvollen Umgang mit Medien lehren, nicht verbieten.',
    followUpQuestions: [
      'Wo verläuft die Grenze zwischen Schutz und Bevormundung?',
      'Welche Rolle sollten die Eltern spielen?',
      'Wie ließe sich ein Verbot überhaupt durchsetzen?',
    ],
  },
  {
    id: 'b2-t2-005',
    level: 'B2',
    teil: 2,
    title: 'Bedingungsloses Grundeinkommen',
    positionA:
      'Ein Grundeinkommen sichert Existenz und Würde und macht Menschen unabhängiger.',
    positionB:
      'Es ist kaum finanzierbar und schwächt die Bereitschaft zu arbeiten.',
    followUpQuestions: [
      'Was würde sich an Ihrer eigenen Lebensplanung ändern?',
      'Wie ließe sich so etwas finanzieren?',
      'Welche Gruppen würden am meisten profitieren?',
    ],
  },
  {
    id: 'b2-t2-006',
    level: 'B2',
    teil: 2,
    title: 'Studiengebühren',
    positionA:
      'Wer studiert, profitiert persönlich davon und kann sich angemessen beteiligen.',
    positionB:
      'Gebühren halten gerade ärmere Begabte vom Studium ab; Bildung ist eine Gemeinschaftsaufgabe.',
    followUpQuestions: [
      'Wie ist der Hochschulzugang in Ihrem Land organisiert?',
      'Welche Folgen hat Chancengleichheit für eine Gesellschaft?',
      'Gäbe es einen Mittelweg?',
    ],
  },
  {
    id: 'b2-t2-007',
    level: 'B2',
    teil: 2,
    title: 'Videoüberwachung im öffentlichen Raum',
    positionA:
      'Kameras an belebten Orten verhindern Straftaten und helfen bei der Aufklärung.',
    positionB:
      'Dauerhafte Beobachtung greift in die Privatsphäre ein, ohne die Ursachen zu lösen.',
    followUpQuestions: [
      'Fühlen Sie sich durch Kameras sicherer oder beobachtet?',
      'Wer sollte Zugriff auf solche Aufnahmen haben?',
      'Welche Alternativen sehen Sie?',
    ],
  },
  {
    id: 'b2-t2-008',
    level: 'B2',
    teil: 2,
    title: 'Höhere Steuern auf Fleisch',
    positionA:
      'Wenn Fleisch seine wahren Umweltkosten trägt, ändert sich der Konsum spürbar.',
    positionB:
      'Eine solche Steuer trifft vor allem Haushalte mit wenig Geld und bevormundet beim Essen.',
    followUpQuestions: [
      'Wie stark beeinflussen Preise Ihr eigenes Einkaufsverhalten?',
      'Welche Verantwortung tragen Erzeuger und Handel?',
      'Welche Massnahme wäre gerechter?',
    ],
  },
  {
    id: 'b2-t2-009',
    level: 'B2',
    teil: 2,
    title: 'Soziale Netzwerke erst ab 16 Jahren',
    positionA:
      'Eine Altersgrenze schützt Jugendliche vor Druck, Sucht und Mobbing.',
    positionB:
      'Verbote sind leicht zu umgehen; Begleitung und Medienbildung wirken besser.',
    followUpQuestions: [
      'Ab welchem Alter halten Sie Netzwerke für vertretbar?',
      'Wer trägt die Verantwortung: Plattform, Eltern oder Staat?',
      'Was hat Ihnen selbst als Jugendlicher geholfen?',
    ],
  },
  {
    id: 'b2-t2-010',
    level: 'B2',
    teil: 2,
    title: 'Soziales Pflichtjahr',
    positionA:
      'Ein verpflichtendes Jahr stärkt den Zusammenhalt und öffnet neue Perspektiven.',
    positionB:
      'Pflicht widerspricht dem Gedanken des Engagements und verzögert Ausbildung und Beruf.',
    followUpQuestions: [
      'Würden Sie sich freiwillig engagieren?',
      'Welche Bereiche bräuchten solche Hilfe am dringendsten?',
      'Wie ließe sich Engagement anders fördern?',
    ],
  },
];

export function findSpeakingTopicById(id: string): SpeakingTopic | undefined {
  return SPEAKING_TOPICS.find((topic) => topic.id === id);
}

/** Public catalogue for Mit Elena (id + display fields only). */
export function listElenaTopics(level?: SpeakingLevel): Array<{
  id: string;
  level: SpeakingLevel;
  teil: 2;
  title: string;
  positionA: string;
  positionB: string;
  followUpQuestions: string[];
}> {
  const rows =
    level == null
      ? SPEAKING_TOPICS
      : SPEAKING_TOPICS.filter((topic) => topic.level === level);
  return rows.map((topic) => ({ ...topic }));
}
