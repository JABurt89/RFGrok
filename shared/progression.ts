// Types for progression schemes
export interface ExerciseSet {
  reps: number;
  weight: number;
}

export interface ProgressionSuggestion {
  sets: number;
  reps: number;
  weight: number;
  calculated1RM: number;
}

export interface ProgressionScheme {
  calculate1RM(sets: ExerciseSet[], extraSetReps?: number): number;
  getNextSuggestion(last1RM: number, increment: number): ProgressionSuggestion[];
}

export class STSProgression implements ProgressionScheme {
  private minSets: number;
  private maxSets: number;
  private minReps: number;
  private maxReps: number;

  constructor(
    minSets: number = 3,
    maxSets: number = 5,
    minReps: number = 5,
    maxReps: number = 8
  ) {
    this.minSets = minSets;
    this.maxSets = maxSets;
    this.minReps = minReps;
    this.maxReps = maxReps;
  }

  calculate1RM(sets: ExerciseSet[], extraSetReps?: number): number {
    if (sets.length === 0) return 0;

    const lastSet = sets[sets.length - 1];
    const baseRM = lastSet.weight * (36 / (37 - lastSet.reps));
    const withSetBonus = baseRM * (1 + 0.025 * (sets.length - 1));

    if (typeof extraSetReps === 'number') {
      const finalSetRM = lastSet.weight * (36 / (37 - lastSet.reps)) * (1 + 0.025 * sets.length);
      return Number((withSetBonus + (extraSetReps / lastSet.reps) * (finalSetRM - withSetBonus)).toFixed(2));
    }

    return Number(withSetBonus.toFixed(2));
  }

  getNextSuggestion(last1RM: number, increment: number): ProgressionSuggestion[] {
    const suggestions: ProgressionSuggestion[] = [];

    for (let sets = this.minSets; sets <= this.maxSets; sets++) {
      for (let reps = this.minReps; reps <= this.maxReps; reps++) {
        const targetWithoutSetBonus = last1RM / (1 + 0.025 * (sets - 1));
        const targetWeight = targetWithoutSetBonus * ((37 - reps) / 36);

        // Generate weight options around the target
        for (let i = -2; i <= 2; i++) {
          const adjustedWeight = targetWeight + (i * increment);
          const roundedWeight = Number(
            (Math.round(adjustedWeight / increment) * increment).toFixed(2)
          );

          const calculated1RM = this.calculate1RM([{ reps, weight: roundedWeight }], 0);

          if (calculated1RM > last1RM) {
            suggestions.push({
              sets,
              reps,
              weight: roundedWeight,
              calculated1RM: Number(calculated1RM.toFixed(2))
            });
          }
        }
      }
    }

    return suggestions.sort((a, b) => a.calculated1RM - b.calculated1RM).slice(0, 10);
  }
}
