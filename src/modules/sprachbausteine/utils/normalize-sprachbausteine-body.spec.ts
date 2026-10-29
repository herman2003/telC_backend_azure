import { normalizeSprachbausteineBody } from './normalize-sprachbausteine-body';

describe('normalizeSprachbausteineBody', () => {
  it('leaves already-normalized -id- tokens unchanged', () => {
    expect(
      normalizeSprachbausteineBody('Hallo -21- Welt -22-.', ['21', '22']),
    ).toBe('Hallo -21- Welt -22-.');
  });

  it('rewrites {{id}} to -id-', () => {
    expect(
      normalizeSprachbausteineBody('denn {{21}} wollte ich {{22}}.', [
        '21',
        '22',
      ]),
    ).toBe('denn -21- wollte ich -22-.');
  });

  it('rewrites sequential _____ blanks using gap ids in order', () => {
    expect(
      normalizeSprachbausteineBody(
        'Firma, _____ Software baut. Am Tag _____ ich nervös.',
        ['21', '22'],
      ),
    ).toBe('Firma, -21- Software baut. Am Tag -22- ich nervös.');
  });

  it('assigns unused gap ids to _____ when mixed with {{id}}', () => {
    expect(
      normalizeSprachbausteineBody('A {{31}} B _____ C', ['31', '32']),
    ).toBe('A -31- B -32- C');
  });
});
