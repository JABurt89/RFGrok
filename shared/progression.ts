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
    // Base 1RM calculation using Brzycki formula with set bonus
    const baseRM = lastSet.weight * (36 / (37 - lastSet.reps));
    const withSetBonus = Math.round(baseRM * (1 + 0.025 * (sets.length - 1)) * 100) / 100;

    if (typeof extraSetReps === 'number') {
      // Calculate final set RM with the additional set bonus
      const finalSetRM = lastSet.weight * (36 / (37 - lastSet.reps)) * (1 + 0.025 * sets.length);
      // Linear interpolation between current and next set based on extra reps ratio
      return Number((withSetBonus + (extraSetReps / lastSet.reps) * (finalSetRM - withSetBonus)).toFixed(2));
    }

    return withSetBonus;
  }

  getNextSuggestion(last1RM: number, increment: number): ProgressionSuggestion[] {
    const suggestions: ProgressionSuggestion[] = [];

    for (let sets = this.minSets; sets <= this.maxSets; sets++) {
      for (let reps = this.minReps; reps <= this.maxReps; reps++) {
        // Remove set bonus to get the base weight needed
        const targetWithoutSetBonus = Math.round((last1RM / (1 + 0.025 * (sets - 1))) * 100) / 100;
        // Convert from 1RM to working weight using Brzycki formula
        const targetWeight = Math.round((targetWithoutSetBonus * ((37 - reps) / 36)) * 100) / 100;

        // Generate weight options around the target
        for (let i = -2; i <= 2; i++) {
          const adjustedWeight = targetWeight + (i * increment);
          const roundedWeight = Number(
            (Math.round(adjustedWeight / increment) * increment).toFixed(2)
          );

          // Calculate actual 1RM with this weight
          const calculated1RM = this.calculate1RM(Array(sets).fill({ reps, weight: roundedWeight }));

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