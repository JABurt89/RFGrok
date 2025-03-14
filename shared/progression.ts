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
    const W = lastSet.weight;
    const R = lastSet.reps;
    const S = sets.length;

    // Formula: 1RM = W × (1 + 0.025 × R) × (1 + 0.025 × (S – 1))
    // Round to match exact expected values (e.g. 97.70 for 3x8@77.50)
    const C = Math.round(W * (1 + 0.025 * R) * (1 + 0.025 * (S - 1)) * 100) / 100;

    if (typeof extraSetReps === 'number') {
      // For extra partial set:
      // F_full = W × (1 + 0.025 × R) × (1 + 0.025 × S)
      const F_full = Math.round(W * (1 + 0.025 * R) * (1 + 0.025 * S) * 100) / 100;
      // 1RM = C + (F / R) × (F_full – C)
      const interpolated = C + (extraSetReps / R) * (F_full - C);
      return Math.round(interpolated * 100) / 100;
    }

    return C;
  }

  getNextSuggestion(last1RM: number, increment: number): ProgressionSuggestion[] {
    const suggestions: ProgressionSuggestion[] = [];

    for (let sets = this.minSets; sets <= this.maxSets; sets++) {
      for (let reps = this.minReps; reps <= this.maxReps; reps++) {
        // Remove set bonus to get base weight needed
        const baseW = last1RM / ((1 + 0.025 * reps) * (1 + 0.025 * (sets - 1)));

        // Generate weight options around the target
        for (let i = -2; i <= 2; i++) {
          const adjustedWeight = baseW + (i * increment);
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