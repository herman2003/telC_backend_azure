export interface ModelltestListItemDto {
  id: string;
  number: number;
  title: string;
}

export interface ModelltestExercisesDto {
  sprachbausteineT1: string[];
  sprachbausteineT2: string[];
  lesenT1: string[];
  lesenT2: string[];
  lesenT3: string[];
  writing: string[];
  listening: string[];
  speaking: string[];
}

export interface ModelltestDetailDto extends ModelltestListItemDto {
  exercises: ModelltestExercisesDto;
}

/** Start-only: current 7-day training Modelltest (not Prep Pass catalogue). */
export interface ModelltestOfTheWeekDto extends ModelltestListItemDto {
  /** Inclusive start of the current 7×24h UTC window (ISO-8601). */
  periodStart: string;
  /** Inclusive end of the current 7×24h UTC window (ISO-8601). */
  periodEnd: string;
}
