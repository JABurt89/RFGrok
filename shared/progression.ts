// Types for progression schemes
export interface ExerciseSet {
  reps: number;
  weight: number;
  isFailure?: boolean;
}

export interface ProgressionSuggestion {
  sets: number;
  reps: number;
  weight: number;
  calculated1RM?: number;
  setWeights?: number[];  // For RPT schemes
  repTargets?: { min: number; max: number; }[];  // For RPT Individual
}

export interface ProgressionScheme {
  calculate1RM?(sets: ExerciseSet[], extraSetReps?: number): number;
  getNextSuggestion(lastWeight: number, increment: number, previousFailures?: number | boolean[]): ProgressionSuggestion[];
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

    return suggestions.sort((a, b) => a.calculated1RM! - b.calculated1RM!).slice(0, 10);
  }
}

export class DoubleProgression implements ProgressionScheme {
  private targetSets: number;
  private minReps: number;
  private maxReps: number;

  constructor(
    targetSets: number = 3,
    minReps: number = 8,
    maxReps: number = 12
  ) {
    this.targetSets = targetSets;
    this.minReps = minReps;
    this.maxReps = maxReps;
  }

  getNextSuggestion(lastWeight: number, increment: number): ProgressionSuggestion[] {
    const suggestions: ProgressionSuggestion[] = [];

    // If last weight is not provided, start with minimum increment
    if (!lastWeight) {
      return [{
        sets: this.targetSets,
        reps: this.minReps,
        weight: increment
      }];
    }

    // Basic weight suggestion - same weight or increase
    suggestions.push({
      sets: this.targetSets,
      reps: this.minReps,
      weight: lastWeight
    });

    // Increase weight if ready to progress
    suggestions.push({
      sets: this.targetSets,
      reps: this.minReps,
      weight: lastWeight + increment
    });

    return suggestions;
  }
}

export class RPTTopSetDependent implements ProgressionScheme {
  private sets: number;
  private minReps: number;
  private maxReps: number;
  private dropPercentages: number[];

  constructor(
    sets: number = 3,
    minReps: number = 6,
    maxReps: number = 8,
    dropPercentages: number[] = [0, 10, 10]
  ) {
    this.sets = sets;
    this.minReps = minReps;
    this.maxReps = maxReps;
    this.dropPercentages = dropPercentages;
  }

  getNextSuggestion(lastWeight: number, increment: number, consecutiveFailures: number = 0): ProgressionSuggestion[] {
    const suggestions: ProgressionSuggestion[] = [];

    // If no previous weight, start with minimum increment
    if (!lastWeight) {
      return [{
        sets: this.sets,
        reps: this.minReps,
        weight: increment,
        setWeights: Array(this.sets).fill(increment),
        repTargets: Array(this.sets).fill({ min: this.minReps, max: this.maxReps })
      }];
    }

    // Calculate base weight based on consecutive failures
    let baseWeight = lastWeight;
    if (consecutiveFailures >= 2) {
      // Reduce weight by 10% after two consecutive failures
      baseWeight = lastWeight * 0.9;
    }

    // Calculate weights for all sets based on top set and drop percentages
    const currentSetWeights = this.dropPercentages.map((dropPercent, idx) => {
      const dropFactor = 1 - (dropPercent / 100);
      return Number((baseWeight * dropFactor).toFixed(2));
    });

    // Current weight suggestion
    suggestions.push({
      sets: this.sets,
      reps: this.minReps,
      weight: baseWeight,
      setWeights: currentSetWeights,
      repTargets: Array(this.sets).fill({ min: this.minReps, max: this.maxReps })
    });

    // If no failures, provide progressive overload suggestion
    if (consecutiveFailures === 0) {
      const progressiveSetWeights = this.dropPercentages.map((dropPercent, idx) => {
        const dropFactor = 1 - (dropPercent / 100);
        return Number(((baseWeight + increment) * dropFactor).toFixed(2));
      });

      suggestions.push({
        sets: this.sets,
        reps: this.minReps,
        weight: baseWeight + increment,
        setWeights: progressiveSetWeights,
        repTargets: Array(this.sets).fill({ min: this.minReps, max: this.maxReps })
      });
    }

    return suggestions;
  }
}

export class RPTIndividualProgression implements ProgressionScheme {
  private sets: number;
  private setConfigs: Array<{ min: number; max: number; }>;

  constructor(
    sets: number = 3,
    setConfigs: Array<{ min: number; max: number; }> = [
      { min: 5, max: 7 },
      { min: 6, max: 8 },
      { min: 7, max: 9 }
    ]
  ) {
    this.sets = sets;
    this.setConfigs = setConfigs;
  }

  getNextSuggestion(lastWeight: number, increment: number, failureFlags?: boolean[]): ProgressionSuggestion[] {
    const suggestions: ProgressionSuggestion[] = [];

    // If no previous weight, start with minimum increment
    if (!lastWeight) {
      return [{
        sets: this.sets,
        reps: this.setConfigs[0].min,
        weight: increment,
        setWeights: Array(this.sets).fill(increment),
        repTargets: this.setConfigs
      }];
    }

    // Calculate weights for each set based on failure history
    const currentSetWeights = Array(this.sets).fill(lastWeight).map((weight, idx) => {
      if (failureFlags && failureFlags[idx] === true) {
        // Reduce weight by 10% for sets with two consecutive failures
        return Number((weight * 0.9).toFixed(2));
      }
      return weight;
    });

    // Current weight suggestion
    suggestions.push({
      sets: this.sets,
      reps: this.setConfigs[0].min,
      weight: lastWeight,
      setWeights: currentSetWeights,
      repTargets: this.setConfigs
    });

    // Progressive overload suggestion - only for sets without failures
    const progressiveSetWeights = currentSetWeights.map((weight, idx) => {
      if (!failureFlags || !failureFlags[idx]) {
        return Number((weight + increment).toFixed(2));
      }
      return weight;
    });

    if (progressiveSetWeights.some((w, i) => w !== currentSetWeights[i])) {
      suggestions.push({
        sets: this.sets,
        reps: this.setConfigs[0].min,
        weight: lastWeight + increment,
        setWeights: progressiveSetWeights,
        repTargets: this.setConfigs
      });
    }

    return suggestions;
  }
}