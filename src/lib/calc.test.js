import { describe, it, expect } from 'vitest';
import {
  getYears,
  getLatestYear,
  getEarliestYear,
  getDataStatus,
  isDataUsable,
  goalPriceAtYear,
  cashPath,
  certificatePath,
  goldPath,
  computeJourney,
  averageInflation,
  projectFuture,
} from './calc.js';

// fixture بأرقام توضيحية مصطنعة (مش بيانات حقيقية) عشان نختبر المنطق بس.
// أرقام مصممة تطلع نتائج يدوية يسهل التحقق منها.
const fixture = {
  meta: { is_placeholder: false },
  yearly: {
    2018: { cpi_index: 100, gold_gram_egp: 600, certificate_rate: 0.1 },
    2019: { cpi_index: 110, gold_gram_egp: 660, certificate_rate: 0.1 },
    2020: { cpi_index: 121, gold_gram_egp: 800, certificate_rate: 0.1 },
  },
};

// نسخة فيها placeholder
const placeholderData = {
  meta: { is_placeholder: true },
  yearly: {
    2018: { cpi_index: null, gold_gram_egp: null, certificate_rate: null },
  },
};

describe('helpers على السنين', () => {
  it('getYears بترجّع السنين مرتبة', () => {
    expect(getYears(fixture)).toEqual([2018, 2019, 2020]);
  });
  it('getLatestYear و getEarliestYear', () => {
    expect(getLatestYear(fixture)).toBe(2020);
    expect(getEarliestYear(fixture)).toBe(2018);
  });
});

describe('getDataStatus / isDataUsable', () => {
  it('بترفض الـ placeholder', () => {
    const s = getDataStatus(placeholderData);
    expect(s.usable).toBe(false);
    expect(isDataUsable(placeholderData)).toBe(false);
  });
  it('بتقبل الداتا الكاملة', () => {
    expect(isDataUsable(fixture)).toBe(true);
  });
  it('بترفض الداتا الناقصة', () => {
    const partial = {
      meta: { is_placeholder: false },
      yearly: {
        2018: { cpi_index: 100, gold_gram_egp: null, certificate_rate: 0.1 },
      },
    };
    expect(isDataUsable(partial)).toBe(false);
  });
});

describe('goalPriceAtYear', () => {
  it('بيعكس التضخم من سعر النهارده', () => {
    // goalToday=12100, cpi[2018]/cpi[2020] = 100/121
    expect(goalPriceAtYear(12100, 2018, fixture)).toBeCloseTo(10000, 6);
  });
  it('في السنة الأحدث بيرجّع نفس السعر', () => {
    expect(goalPriceAtYear(12100, 2020, fixture)).toBeCloseTo(12100, 6);
  });
});

describe('cashPath', () => {
  it('الكاش واقف: نسبته = goalAtStart / goalToday', () => {
    // goalAtStart=10000, goalToday=12100 → share ≈ 0.8264
    const r = cashPath(12100, 2018, fixture);
    expect(r.goalAtStart).toBeCloseTo(10000, 6);
    expect(r.valueToday).toBeCloseTo(10000, 6);
    expect(r.share).toBeCloseTo(10000 / 12100, 6);
    expect(r.coversFull).toBe(false);
  });
});

describe('certificatePath', () => {
  it('بيركّب العائد سنة بسنة من startYear لـ latestYear-1', () => {
    // goalAtStart=10000, سنتين تركيب (2018,2019) بمعدل 0.1
    // 10000 * 1.1 * 1.1 = 12100 → يغطي الهدف بالظبط
    const r = certificatePath(12100, 2018, fixture);
    expect(r.valueToday).toBeCloseTo(12100, 6);
    expect(r.share).toBeCloseTo(1, 6);
    expect(r.coversFull).toBe(true);
  });
});

describe('goldPath', () => {
  it('بيحوّل جرامات ويقيّمها بسعر النهارده', () => {
    // goalAtStart=10000, gold[2018]=600 → grams≈16.667
    // قيمة النهارده = 16.667 * 800 = 13333.3
    const r = goldPath(12100, 2018, fixture);
    expect(r.grams).toBeCloseTo(10000 / 600, 6);
    expect(r.valueToday).toBeCloseTo((10000 / 600) * 800, 4);
    expect(r.coversFull).toBe(true);
  });
});

describe('computeJourney', () => {
  it('بيرجّع المسارات الثلاثة بنفس goalAtStart', () => {
    const j = computeJourney(12100, 2018, fixture);
    expect(j.goalAtStart).toBeCloseTo(10000, 6);
    expect(j.paths.cash).toBeDefined();
    expect(j.paths.certificate).toBeDefined();
    expect(j.paths.gold).toBeDefined();
    // المسارات الثلاثة مبنية على نفس المبلغ الأصلي
    expect(j.paths.cash.goalAtStart).toBeCloseTo(j.paths.gold.goalAtStart, 6);
  });
});

describe('averageInflation', () => {
  it('بيحسب متوسط التضخم من سلسلة cpi', () => {
    // 110/100-1=0.1 ، 121/110-1=0.1 → المتوسط 0.1
    expect(averageInflation(fixture, 3)).toBeCloseTo(0.1, 6);
  });
});

describe('projectFuture', () => {
  it('بيرجّع نقط الإسقاط والمسافة بتكبر', () => {
    const f = projectFuture(10000, fixture, { yearsAhead: 2, lookback: 3 });
    expect(f.avgInflation).toBeCloseTo(0.1, 6);
    expect(f.points).toHaveLength(3); // k = 0..2
    expect(f.points[0].goalPrice).toBeCloseTo(10000, 6);
    expect(f.points[0].cashCovers).toBeCloseTo(1, 6);
    // سنة 2: 10000 * 1.1^2 = 12100 ، نسبة الكاش = 10000/12100
    expect(f.points[2].goalPrice).toBeCloseTo(12100, 6);
    expect(f.points[2].cashCovers).toBeCloseTo(10000 / 12100, 6);
    // المسافة بتكبر: cashCovers بينقص مع الزمن
    expect(f.points[2].cashCovers).toBeLessThan(f.points[0].cashCovers);
  });
});
