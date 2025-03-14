import { STSProgression, DoubleProgression, RPTTopSetDependent, RPTIndividualProgression } from './progression';

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

    it('handles empty sets', () => {
      expect(progression.calculate1RM([])).toBe(0);
    });
  });

  describe('getNextSuggestion', () => {
    it('generates valid progression suggestions', () => {
      const suggestions = progression.getNextSuggestion(100, 2.5);
      expect(suggestions.length).toBeGreaterThan(0);
    });
  });
});

describe('DoubleProgression', () => {
  let progression: DoubleProgression;

  beforeEach(() => {
    progression = new DoubleProgression();
  });

  describe('getNextSuggestion', () => {
    it('handles initial weight suggestion', () => {
      const suggestions = progression.getNextSuggestion(0, 2.5);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        sets: 3,
        reps: 8,
        weight: 2.5
      });
    });

    it('provides progression options for existing weight', () => {
      const suggestions = progression.getNextSuggestion(50, 2.5);
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].weight).toBe(50);
      expect(suggestions[1].weight).toBe(52.5);
    });
  });
});

describe('RPTTopSetDependent', () => {
  let progression: RPTTopSetDependent;

  beforeEach(() => {
    progression = new RPTTopSetDependent(3, 6, 10);
  });

  describe('getNextSuggestion', () => {
    it('handles initial weight suggestion', () => {
      const suggestions = progression.getNextSuggestion(0, 2.5);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        sets: 3,
        reps: 6,
        weight: 2.5
      });
    });

    it('provides progression options with correct weight increases', () => {
      const suggestions = progression.getNextSuggestion(100, 2.5);
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].weight).toBe(100);
      expect(suggestions[1].weight).toBe(102.5);
    });
  });
});

describe('RPTIndividualProgression', () => {
  let progression: RPTIndividualProgression;

  beforeEach(() => {
    progression = new RPTIndividualProgression(3, 6, 10);
  });

  describe('getNextSuggestion', () => {
    it('handles initial weight suggestion', () => {
      const suggestions = progression.getNextSuggestion(0, 2.5);
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]).toEqual({
        sets: 3,
        reps: 6,
        weight: 2.5
      });
    });

    it('provides progression options for each set', () => {
      const suggestions = progression.getNextSuggestion(100, 2.5);
      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].weight).toBe(100);
      expect(suggestions[1].weight).toBe(102.5);
    });
  });
});