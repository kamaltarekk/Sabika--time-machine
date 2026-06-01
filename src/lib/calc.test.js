import { describe, it, expect } from 'vitest';
import {
  getYears,
  getLatestCompleteYear,
  getEarliestYear,
  getCurrent,
  getDataStatus,
  isDataUsable,
  hasYearData,
  goalPriceAtYear,
  cashPath,
  certificatePath,
  goldPath,
  computeJourney,
  averageInflation,
  projectFuture,
} from './calc.js';

// fixture بأرقام توضيحية مصطنعة (مش بيانات حقيقية) عشان نختبر المنطق بس.
// مصمّمة تطلع نتائج يدوية يسهل التحقق منها.
const fixture = {
  meta: { is_placeholder: false, latest_complete_year: 2020, current_period: '2021-Q1' },
  annual: {
    2018: { cpi_index: 100, gold_gram_egp: 500, silver_price_egp: 8, certificate_rate: 0.1, cbe_rate_sanity_check: 0.12 },
    2019: { cpi_index: 110, gold_gram_egp: 550, silver_price_egp: 9, certificate_rate: 0.1, cbe_rate_sanity_check: 0.12 },
    2020: { cpi_index: 121, gold_gram_egp: 600, silver_price_egp: 10, certificate_rate: 0.1, cbe_rate_sanity_check: 0.12 },
  },
  current: { cpi_index: 121, gold_gram_egp: 605, silver_price_egp: 12, certificate_rate: 0.1, cbe_rate_sanity_check: 0.12 },
};

const clone = (o) => JSON.parse(JSON.stringify(o));

describe('helpers على السنين والمرجع الحالي', () => {
  it('getYears بترجّع سنين annual مرتبة', () => {
    expect(getYears(fixture)).toEqual([2018, 2019, 2020]);
  });
  it('getLatestCompleteYear من meta', () => {
    expect(getLatestCompleteYear(fixture)).toBe(2020);
  });
  it('getEarliestYear', () => {
    expect(getEarliestYear(fixture)).toBe(2018);
  });
  it('getCurrent بترجّع المرجع الحالي', () => {
    expect(getCurrent(fixture).cpi_index).toBe(121);
  });
  it('hasYearData', () => {
    expect(hasYearData(fixture, 2018)).toBe(true);
    expect(hasYearData(fixture, 1999)).toBe(false);
  });
});

describe('CPI reverse calculation', () => {
  it('بيعكس التضخم من سعر النهارده باستخدام current.cpi', () => {
    // goalToday=12100, cpi[2018]/cpi[current] = 100/121 → 10000
    expect(goalPriceAtYear(12100, 2018, fixture)).toBeCloseTo(10000, 6);
  });
});

describe('cash path', () => {
  it('الكاش واقف: نسبته = goalAtStart / goalToday', () => {
    const r = cashPath(12100, 2018, fixture);
    expect(r.goalAtStart).toBeCloseTo(10000, 6);
    expect(r.valueToday).toBeCloseTo(10000, 6);
    expect(r.share).toBeCloseTo(10000 / 12100, 6);
    expect(r.coversFull).toBe(false);
  });
});

describe('certificate compounding', () => {
  it('بيركّب العائد من startYear لـ latest_complete_year ضمناً', () => {
    // goalAtStart=10000، 3 سنوات (2018,2019,2020) بمعدل 0.1 → 10000*1.1^3 = 13310
    const r = certificatePath(12100, 2018, fixture);
    expect(r.valueToday).toBeCloseTo(13310, 4);
    expect(r.share).toBeCloseTo(13310 / 12100, 6);
    expect(r.coversFull).toBe(true);
  });
});

describe('gold grams conversion', () => {
  it('بيحوّل جرامات بسعر سنته ويقيّمها بسعر سبيكة الحالي', () => {
    // goalAtStart=10000, gold[2018]=500 → 20 جرام، × current 605 = 12100
    const r = goldPath(12100, 2018, fixture);
    expect(r.grams).toBeCloseTo(20, 6);
    expect(r.valueToday).toBeCloseTo(12100, 4);
    expect(r.share).toBeCloseTo(1, 6);
  });
});

describe('computeJourney', () => {
  it('بيرجّع المسارات الثلاثة بنفس goalAtStart', () => {
    const j = computeJourney(12100, 2018, fixture);
    expect(j.goalAtStart).toBeCloseTo(10000, 6);
    expect(j.latestCompleteYear).toBe(2020);
    expect(j.paths.cash.goalAtStart).toBeCloseTo(j.paths.gold.goalAtStart, 6);
  });
});

describe('future projection from last 3 years CPI', () => {
  it('متوسط التضخم والمسافة بتكبر', () => {
    const f = projectFuture(10000, fixture, { yearsAhead: 2, lookback: 3 });
    expect(f.avgInflation).toBeCloseTo(0.1, 6);
    expect(f.points).toHaveLength(3);
    expect(f.points[0].cashCovers).toBeCloseTo(1, 6);
    expect(f.points[2].goalPrice).toBeCloseTo(12100, 6);
    expect(f.points[2].cashCovers).toBeLessThan(f.points[0].cashCovers);
  });
  it('averageInflation', () => {
    expect(averageInflation(fixture, 3)).toBeCloseTo(0.1, 6);
  });
});

describe('validation — getDataStatus / isDataUsable', () => {
  it('بتقبل الداتا الكاملة', () => {
    expect(isDataUsable(fixture)).toBe(true);
  });

  it('placeholder mode بيمنع النتائج والكارت', () => {
    const d = clone(fixture);
    d.meta.is_placeholder = true;
    const s = getDataStatus(d);
    expect(s.usable).toBe(false);
    expect(s.code).toBe('PLACEHOLDER');
  });

  it('بيمنع لو أي required data null', () => {
    const d = clone(fixture);
    d.annual[2019].gold_gram_egp = null;
    const s = getDataStatus(d);
    expect(s.usable).toBe(false);
    expect(s.code).toBe('NULL_DATA');
  });

  it('بيمنع لو cpi_index شكله نسبة تضخم (0.18 أو 18)', () => {
    const d = clone(fixture);
    d.annual[2020].cpi_index = 0.18;
    expect(getDataStatus(d).code).toBe('CPI_LOOKS_LIKE_RATE');

    const d2 = clone(fixture);
    d2.annual[2020].cpi_index = 5; // أقل من الحد
    expect(getDataStatus(d2).code).toBe('CPI_LOOKS_LIKE_RATE');
  });

  it('بيمنع لو certificate_rate اتكتب 18 بدل 0.18', () => {
    const d = clone(fixture);
    d.annual[2018].certificate_rate = 18;
    const s = getDataStatus(d);
    expect(s.usable).toBe(false);
    expect(s.code).toBe('RATE_LOOKS_LIKE_PERCENT');
  });

  it('بيمنع لو latest_complete_year مش موجود', () => {
    const d = clone(fixture);
    delete d.meta.latest_complete_year;
    expect(getDataStatus(d).code).toBe('NO_LATEST_YEAR');
  });

  it('بيمنع لو current data ناقصة', () => {
    const d = clone(fixture);
    d.current.gold_gram_egp = null;
    const s = getDataStatus(d);
    expect(s.usable).toBe(false);
    expect(s.code).toBe('CURRENT_MISSING');
  });

  it('الفضة null مش بتمنع (future-ready مش مطلوبة في v1)', () => {
    const d = clone(fixture);
    d.annual[2018].silver_price_egp = null;
    d.current.silver_price_egp = null;
    expect(isDataUsable(d)).toBe(true);
  });
});
