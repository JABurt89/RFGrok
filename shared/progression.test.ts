import { STSProgression } from './progression';

describe('STSProgression', () => {
  let progression: STSProgression;

  beforeEach(() => {
    progression = new STSProgression();
  });

  describe('calculate1RM', () => {
    it('calculates 1RM correctly for 3 sets of 8 reps at 77.50kg', () => {
      const sets = Array(3).fill({ weight: 77.50, reps: 8 });
      expect(progression.calculate1RM(sets)).toBe(97.65);
    });

    it('calculates 1RM correctly for single set', () => {
      const sets = [{ weight: 100, reps: 5 }];
      const expected = 100 * (1 + 0.025 * 5) * (1 + 0.025 * 0);
      expect(progression.calculate1RM(sets)).toBe(Number(expected.toFixed(2)));
    });

    it('applies set bonus correctly', () => {
      const sets = Array(5).fill({ weight: 60, reps: 6 });
      // 1RM = W × (1 + 0.025 × R) × (1 + 0.025 × (S – 1))
      const expected = 60 * (1 + 0.025 * 6) * (1 + 0.025 * 4);
      expect(progression.calculate1RM(sets)).toBe(Number(expected.toFixed(2)));
    });

    it('handles extra set reps correctly', () => {
      const sets = Array(3).fill({ weight: 80, reps: 10 });
      // C = W × (1 + 0.025 × R) × (1 + 0.025 × (S – 1))
      const C = 80 * (1 + 0.025 * 10) * (1 + 0.025 * 2);
      // F_full = W × (1 + 0.025 × R) × (1 + 0.025 × S)
      const F_full = 80 * (1 + 0.025 * 10) * (1 + 0.025 * 3);
      // 1RM = C + (F / R) × (F_full – C)
      const extraReps = 5;
      const expected = C + (extraReps / 10) * (F_full - C);
      expect(progression.calculate1RM(sets, extraReps)).toBe(Number(expected.toFixed(2)));
    });

    it('returns 0 for empty sets', () => {
      expect(progression.calculate1RM([])).toBe(0);
    });
  });

  describe('getNextSuggestion', () => {
    it('generates valid progression suggestions', () => {
      const suggestions = progression.getNextSuggestion(100, 2.5);

      expect(suggestions.length).toBeGreaterThan(0);
      suggestions.forEach(suggestion => {
        expect(suggestion.sets).toBeGreaterThanOrEqual(3);
        expect(suggestion.sets).toBeLessThanOrEqual(5);
        expect(suggestion.reps).toBeGreaterThanOrEqual(5);
        expect(suggestion.reps).toBeLessThanOrEqual(8);
        expect(suggestion.calculated1RM).toBeGreaterThan(100);
      });
    });

    it('respects weight increment', () => {
      const increment = 2.5;
      const suggestions = progression.getNextSuggestion(100, increment);

      suggestions.forEach(suggestion => {
        const remainder = suggestion.weight % increment;
        expect(remainder).toBeLessThan(0.01); // Account for floating point precision
      });
    });
  });
});