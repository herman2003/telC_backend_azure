import { examinerTopicFromGenericSection } from '../src/modules/speaking/services/generic-sprechen-topic';

describe('examinerTopicFromGenericSection', () => {
  it('maps A1 Teil 1 Sich vorstellen prompts', () => {
    const topic = examinerTopicFromGenericSection({
      label: 'Sprechen',
      instruction:
        'Stellen Sie sich mit Hilfe der Stichworte vor. Danach buchstabieren Sie etwas und nennen eine Nummer.',
      aufgabentyp: 'SICH_VORSTELLEN',
      material: {
        prompts: ['Name', 'Alter', 'Land'],
        examinerPrompts: [
          'Können Sie bitte Ihren Familiennamen buchstabieren?',
        ],
      },
    });

    expect(topic.title).toBe('Sprechen');
    expect(topic.description).toContain('Stichworte');
    expect(topic.points).toEqual([
      'Name',
      'Alter',
      'Land',
      'Können Sie bitte Ihren Familiennamen buchstabieren?',
    ]);
  });

  it('maps A1 Teil 2 rounds with topics and cards', () => {
    const topic = examinerTopicFromGenericSection({
      label: 'Sprechen',
      instruction: 'Ziehen Sie eine Karte…',
      aufgabentyp: 'FRAGEN_UND_ANTWORTEN',
      material: {
        rounds: [
          {
            topic: 'Essen und Trinken',
            cards: [{ key: '1', text: 'Frühstück' }],
          },
          {
            topic: 'Einkaufen',
            cards: [{ key: '1', text: 'Zeitung' }],
          },
        ],
      },
    });

    expect(topic.title).toBe('Essen und Trinken');
    expect(topic.points).toContain('Thema: Essen und Trinken');
    expect(topic.points).toContain('Frühstück');
    expect(topic.points).toContain('Zeitung');
  });

  it('maps A2 Teil 2 Alltagsgespräch topic + cards', () => {
    const topic = examinerTopicFromGenericSection({
      label: 'Sprechen',
      instruction: 'Stellen Sie abwechselnd Fragen…',
      aufgabentyp: 'ALLTAGSGESPRAECH',
      material: {
        topic: 'Tagesablauf',
        cards: [
          { key: 'was', text: 'Was …?' },
          { key: 'wo', text: 'Wo …?' },
        ],
      },
    });

    expect(topic.title).toBe('Tagesablauf');
    expect(topic.points).toEqual(['Was …?', 'Wo …?']);
  });

  it('maps A2 Teil 3 negotiate with participant cards', () => {
    const topic = examinerTopicFromGenericSection({
      label: 'Sprechen',
      instruction: 'Sie suchen ein neues Hobby…',
      aufgabentyp: 'ETWAS_AUSHANDELN',
      material: {
        topic: 'Ein neues Hobby',
        goal: 'Finden Sie zwei passende Aktivitäten.',
        participantCards: {
          A: ['Singen', 'Tanzen'],
          B: ['Musik machen'],
        },
      },
    });

    expect(topic.title).toBe('Ein neues Hobby');
    expect(topic.points[0]).toBe('Finden Sie zwei passende Aktivitäten.');
    expect(topic.points).toContain('A: Singen, Tanzen');
    expect(topic.points).toContain('B: Musik machen');
  });
});
