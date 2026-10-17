/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MODELLTEST_PERIOD_EPOCH_MS } from '../modelltests/seven-day-period';
import { VocabService } from './vocab.service';

describe('VocabService', () => {
  const now = new Date(MODELLTEST_PERIOD_EPOCH_MS);
  let prisma: {
    modelltest: { findUnique: jest.Mock };
    vocabOccurrence: { findMany: jest.Mock };
    vocabEntry: { findUnique: jest.Mock; findMany: jest.Mock };
    vocabProgress: {
      findMany: jest.Mock;
      count: jest.Mock;
      upsert: jest.Mock;
    };
  };
  let trainingAccess: { weeklyModelltestNumber: jest.Mock };
  let service: VocabService;

  const entry = {
    id: '11111111-1111-4111-8111-111111111111',
    lemma: 'Antrag',
    article: 'der',
    pos: 'noun',
    gender: 'mask',
    plural: 'Anträge',
    cefr_level: 'B1',
    auxiliary: null,
    separable: null,
    partizip_ii: null,
    comparative: null,
    superlative: null,
    governs_case: null,
    senses: [
      {
        id: '22222222-2222-4222-8222-222222222222',
        sort_order: 0,
        meaning_fr: 'demande',
        meaning_en: 'application',
        example_de: 'Ich stelle einen Antrag.',
        example_fr: 'Je dépose une demande.',
        example_en: 'I submit an application.',
        note_fr: null,
        note_en: null,
      },
    ],
    verb_forms: [],
  };

  beforeEach(() => {
    prisma = {
      modelltest: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'mt-1',
          number: 2,
          title: 'Modelltest 2',
        }),
      },
      vocabOccurrence: {
        findMany: jest.fn().mockResolvedValue([{ vocab_entry_id: entry.id }]),
      },
      vocabEntry: {
        findMany: jest.fn().mockResolvedValue([entry]),
        findUnique: jest.fn().mockResolvedValue(entry),
      },
      vocabProgress: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        upsert: jest.fn().mockResolvedValue({ status: 'learning' }),
      },
    };
    trainingAccess = {
      weeklyModelltestNumber: jest.fn().mockResolvedValue(2),
    };
    service = new VocabService(prisma, trainingAccess as any);
  });

  it('getOfTheWeek groups pack by nature', async () => {
    const dto = await service.getOfTheWeek('student-1', now);
    expect(dto.modelltestNumber).toBe(2);
    expect(dto.lang).toBe('fr');
    expect(dto.nouns).toHaveLength(1);
    expect(dto.nouns[0].lemma).toBe('Antrag');
    expect(dto.nouns[0].senses[0].meaningFr).toBe('demande');
    expect(dto.nouns[0].senses[0].meaning).toBe('demande');
    expect(dto.verbs).toHaveLength(0);
  });

  it('getOfTheWeek localizes senses when lang=en', async () => {
    const dto = await service.getOfTheWeek('student-1', now, { lang: 'en' });
    expect(dto.lang).toBe('en');
    expect(dto.nouns[0].senses[0].meaning).toBe('application');
    expect(dto.nouns[0].senses[0].exampleGloss).toBe(
      'I submit an application.',
    );
  });

  it('getOfTheWeek nulls glosses when lang=de', async () => {
    const dto = await service.getOfTheWeek('student-1', now, { lang: 'de' });
    expect(dto.lang).toBe('de');
    expect(dto.nouns[0].senses[0].meaning).toBeNull();
    expect(dto.nouns[0].senses[0].exampleGloss).toBeNull();
    expect(dto.nouns[0].senses[0].exampleDe).toBe('Ich stelle einen Antrag.');
  });

  it('getEntry returns conjugation null for nouns', async () => {
    const card = await service.getEntry('student-1', entry.id);
    expect(card.conjugation).toBeNull();
    expect(card.article).toBe('der');
    expect(card.lang).toBe('fr');
  });

  it('search requires a query', async () => {
    await expect(service.search('   ')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('search returns catalogue hits', async () => {
    const rows = await service.search('Ant');
    expect(prisma.vocabEntry.findMany).toHaveBeenCalled();
    expect(rows[0].lemma).toBe('Antrag');
  });

  it('updateProgress 404s for unknown entry', async () => {
    prisma.vocabEntry.findUnique.mockResolvedValue(null);
    await expect(
      service.updateProgress('student-1', entry.id, { status: 'known' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
