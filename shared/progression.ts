import { z } from "zod";

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
}

export interface ProgressionScheme {
  calculate1RM?(sets: ExerciseSet[], extraSetReps?: number): number;
  getNextSuggestion(lastWeight: number, increment: number, consecutiveFailures?: number | boolean[]): ProgressionSuggestion[];
}

export class RPTTopSetDependent implements ProgressionScheme {
  private sets: number;
  private minReps: number;
  private maxReps: number;
  private dropPercentages: number[];

  constructor(sets: number = 3, minReps: number = 6, maxReps: number = 8, dropPercentages: number[] = [0, 10, 10]) {
    this.sets = sets;
    this.minReps = minReps;
    this.maxReps = maxReps;
    this.dropPercentages = dropPercentages;
  }

  getNextSuggestion(lastWeight: number, increment: number, consecutiveFailures: number = 0): ProgressionSuggestion[] {
    const baseWeight = lastWeight || increment;
    const topSetWeight = consecutiveFailures >= 2 ? Math.max(increment, baseWeight * 0.9) : baseWeight;

    const suggestions: ProgressionSuggestion[] = [];
    for (let i = 0; i < this.sets; i++) {
      const weight = topSetWeight * (1 - (this.dropPercentages[i] || 0) / 100);
      suggestions.push({
        sets: 1, // One suggestion per set
        reps: this.minReps,
        weight,
        calculated1RM: weight * (1 + 0.025 * this.minReps)
      });
    }
    return suggestions;
  }
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
    const C = Math.round(W * (1 + 0.025 * R) * (1 + 0.025 * (S - 1)) * 100) / 100;

    if (typeof extraSetReps === 'number' && extraSetReps > 0) {
      // For extra partial set:
      // F_full = W × (1 + 0.025 × R) × (1 + 0.025 × S)
      const F_full = Math.round(W * (1 + 0.025 * R) * (1 + 0.025 * S) * 100) / 100;
      // 1RM = C + (F / R) × (F_full – C)
      const interpolated = C + (extraSetReps / R) * (F_full - C);
      return Math.round(interpolated * 100) / 100;
    }

    return C;
  }

  getNextSuggestion(last1RM: number, increment: number, startingWeight: number = 20): ProgressionSuggestion[] {
    const suggestions: ProgressionSuggestion[] = [];
    const effectiveLast1RM = last1RM || startingWeight * (1 + 0.025 * 8 * 3); // Default 1RM if none exists

    for (let sets = this.minSets; sets <= this.maxSets; sets++) {
      for (let reps = this.minReps; reps <= this.maxReps; reps++) {
        const baseW = effectiveLast1RM / ((1 + 0.025 * reps) * (1 + 0.025 * (sets - 1)));
        const roundedWeight = Math.max(
          startingWeight,
          Number((Math.round(baseW / increment) * increment).toFixed(2))
        );
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
    return suggestions.sort((a, b) => a.calculated1RM! - b.calculated1RM!).slice(0, 5);
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
    if (!lastWeight) {
      return [{
        sets: this.targetSets,
        reps: this.minReps,
        weight: increment
      }];
    }

    return [{
      sets: this.targetSets,
      reps: this.minReps,
      weight: lastWeight + increment
    }];
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
    this.setConfigs = this.validateSetConfigs(sets, setConfigs);
  }

  private validateSetConfigs(sets: number, configs: Array<{ min: number; max: number; }>) {
    if (configs.length !== sets) {
      const lastConfig = configs[configs.length - 1] || { min: 6, max: 8 };
      return Array(sets).fill(null).map((_, i) => configs[i] || { ...lastConfig });
    }
    return configs;
  }

  getNextSuggestion(lastWeight: number, increment: number, failureFlags?: boolean[]): ProgressionSuggestion[] {
    const baseWeight = lastWeight || increment;

    return [{
      sets: this.sets,
      reps: this.setConfigs[0].min,
      weight: baseWeight,
      calculated1RM: baseWeight * (1 + 0.025 * this.setConfigs[0].min)
    }];
  }
}