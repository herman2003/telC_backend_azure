import { Injectable, NotFoundException } from '@nestjs/common';
import type { SkillId } from '../student-activity/student-history';
import { PREP_TIPS, type PrepTip } from './prep-tips.data';
import type { PrepTipDto, PrepTipSummaryDto } from './dto/prep-tip.dto';

const SKILLS: readonly SkillId[] = [
  'hoeren',
  'lesen',
  'sprachbausteine',
  'schreiben',
  'sprechen',
] as const;

@Injectable()
export class PrepTipsService {
  list(): PrepTipSummaryDto[] {
    return PREP_TIPS.map(({ skill, teil, title }) => ({
      skill,
      teil,
      title,
    }));
  }

  get(skillRaw: string, teilRaw: string): PrepTipDto {
    const skill = this.parseSkill(skillRaw);
    const teil = this.parseTeil(teilRaw);
    const tip = PREP_TIPS.find((t) => t.skill === skill && t.teil === teil);
    if (!tip) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `No prep tip for ${skill}/${teil}`,
        messageKey: 'prepTipNotFound',
      });
    }
    return this.toDto(tip);
  }

  private toDto(tip: PrepTip): PrepTipDto {
    return {
      skill: tip.skill,
      teil: tip.teil,
      title: tip.title,
      objective: tip.objective,
      strategy: tip.strategy,
      traps: tip.traps,
      practiceHint: tip.practiceHint,
    };
  }

  private parseSkill(raw: string): SkillId {
    const skill = raw?.toLowerCase() as SkillId;
    if (!SKILLS.includes(skill)) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `Unknown skill: ${raw}`,
        messageKey: 'prepTipNotFound',
      });
    }
    return skill;
  }

  private parseTeil(raw: string): number {
    const teil = Number.parseInt(raw, 10);
    if (!Number.isInteger(teil) || teil < 1 || teil > 3) {
      throw new NotFoundException({
        statusCode: 404,
        error: 'Not Found',
        message: `Invalid teil: ${raw}`,
        messageKey: 'prepTipNotFound',
      });
    }
    return teil;
  }
}
