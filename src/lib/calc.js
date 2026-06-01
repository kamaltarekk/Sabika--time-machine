/**
 * src/lib/calc.js
 * ---------------------------------------------------------------------------
 * كل المنطق الحسابي لرحلة فلوسك — دوال نقية (pure functions) قابلة للاختبار.
 * مفيش أي رقم hardcoded هنا. كل الأرقام بتيجي من كائن `data` اللي مصدره
 * src/data/economic-data.json.
 *
 * ============================ نموذج البيانات ============================
 * - data.annual: السنوات المكتملة فقط (مثلاً 2018→2025).
 * - data.current: المرجع الحالي (CPI الحالي + سعر الذهب/الفضة الحالي من سبيكة).
 *   السنة الجارية مش بتتعامل كسنة مكتملة — بنستخدم data.current كـ "النهارده".
 * - meta.latest_complete_year: آخر سنة مكتملة (نهاية تركيب الشهادة).
 *
 * ============================ افتراضات حسابية ============================
 * 1) cpi_index = الرقم القياسي للأسعار (INDEX، مش نسبة تضخم). بنستخدم النسبة
 *    بين السنة و current، فسنة الأساس مش بتأثر طول ما السلسلة متّسقة.
 *    سعر الهدف في سنة قديمة = goalToday * cpi[year] / cpi[current].
 *
 * 2) certificate_rate = العائد السنوي ككسر عشري (0.18 = 18%). التركيب: لكل
 *    سنة مكتملة y من startYear لحد latest_complete_year (ضمناً) بنضرب في
 *    (1 + certificate_rate[y])، بافتراض إعادة استثمار العائد سنوياً.
 *
 * 3) gold_gram_egp = سعر جرام الذهب عيار 24 المرجعي من سبيكة بالجنيه.
 *    الذهب أداة حفظ قيمة: بنحوّل المبلغ القديم جرامات بسعر سنته، وبنقيّم
 *    الجرامات بسعر سبيكة الحالي. مفيش أي افتراض عائد — قيمة فعلية بس.
 *
 * 4) الإسقاط المستقبلي = متوسط التضخم لآخر 3 سنوات مكتملة محسوب من نفس الداتا.
 *    سيناريو توضيحي بحت — مفيش أي رقم عائد ذهب/فضة مستقبلي إطلاقاً.
 * =========================================================================
 */

// حدود التحقق (sanity thresholds)
const MIN_CPI_INDEX = 10; // أقل من كده غالباً اتدخل كنسبة تضخم بالغلط
const MAX_DECIMAL_RATE = 1; // 1 أو أكتر = اتكتب 18 بدل 0.18

// الحقول المطلوبة فعلياً للحسابات في v1 (الفضة future-ready، مش مطلوبة).
const REQUIRED_ANNUAL_FIELDS = ['cpi_index', 'gold_gram_egp', 'certificate_rate'];
const REQUIRED_CURRENT_FIELDS = ['cpi_index', 'gold_gram_egp'];

// القيم الصالحة لـ gold_source_type / silver_source_type.
const VALID_SOURCE_TYPES = ['external_reconstructed', 'sabika_reference'];

/** بيرجّع سنين الـ annual مرتبة تصاعدياً كأرقام. */
export function getYears(data) {
  return Object.keys(data?.annual ?? {})
    .map(Number)
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b);
}

/** آخر سنة مكتملة (من meta، مع fallback لأكبر سنة في annual). */
export function getLatestCompleteYear(data) {
  if (data?.meta?.latest_complete_year != null) {
    return Number(data.meta.latest_complete_year);
  }
  const years = getYears(data);
  if (years.length === 0) throw new Error('economic-data: مفيش سنين مكتملة');
  return years[years.length - 1];
}

/** أقدم سنة متاحة. */
export function getEarliestYear(data) {
  const years = getYears(data);
  if (years.length === 0) throw new Error('economic-data: مفيش سنين في الداتا');
  return years[0];
}

/** المرجع الحالي ("النهارده"). */
export function getCurrent(data) {
  if (!data?.current) throw new Error('economic-data: مفيش current reference');
  return data.current;
}

/* ------------------------------ التحقق ------------------------------ */

/**
 * بيتأكد إن الداتا صالحة للحساب والعرض.
 * بيرجّع { usable, reason, code }. usable=false يعني نعرض warning ونمنع الكارت.
 */
export function getDataStatus(data) {
  if (!data || !data.meta || !data.annual || !data.current) {
    return { usable: false, code: 'STRUCTURE', reason: 'الداتا غير موجودة أو غير مكتملة' };
  }
  if (data.meta.is_placeholder === true) {
    return { usable: false, code: 'PLACEHOLDER', reason: 'البيانات تجريبية (is_placeholder = true)' };
  }
  if (data.meta.latest_complete_year == null) {
    return { usable: false, code: 'NO_LATEST_YEAR', reason: 'latest_complete_year غير موجود' };
  }

  const years = getYears(data);
  if (years.length === 0) {
    return { usable: false, code: 'NO_YEARS', reason: 'مفيش سنوات في annual' };
  }

  // كل سنة مكتملة: الحقول المطلوبة موجودة وصالحة
  for (const y of years) {
    const row = data.annual[y];
    for (const f of REQUIRED_ANNUAL_FIELDS) {
      if (row?.[f] == null) {
        return { usable: false, code: 'NULL_DATA', reason: `بيانات ناقصة: annual.${y}.${f}` };
      }
    }
    const cpiCheck = checkCpiIndex(row.cpi_index, `annual.${y}.cpi_index`);
    if (cpiCheck) return cpiCheck;
    const rateCheck = checkRate(row.certificate_rate, `annual.${y}.certificate_rate`);
    if (rateCheck) return rateCheck;
    // gold_source_type لازم يكون قيمة صالحة لو موجود
    if (row.gold_source_type != null && !VALID_SOURCE_TYPES.includes(row.gold_source_type)) {
      return {
        usable: false,
        code: 'BAD_SOURCE_TYPE',
        reason: `annual.${y}.gold_source_type قيمة غير صالحة: "${row.gold_source_type}"`,
      };
    }
  }

  // المرجع الحالي
  for (const f of REQUIRED_CURRENT_FIELDS) {
    if (data.current?.[f] == null) {
      return { usable: false, code: 'CURRENT_MISSING', reason: `بيانات current ناقصة: current.${f}` };
    }
  }
  const curCpiCheck = checkCpiIndex(data.current.cpi_index, 'current.cpi_index');
  if (curCpiCheck) return curCpiCheck;

  return { usable: true, code: 'OK', reason: null };
}

/** اختصار: هل ممكن نعرض نتائج نهائية ونولّد الكارت؟ */
export function isDataUsable(data) {
  return getDataStatus(data).usable;
}

/**
 * بيرجّع gold_source_type لسنة معيّنة ('external_reconstructed' | 'sabika_reference' | null).
 * الـ UI بيستخدمه لعرض النص المناسب في ملاحظة المصدر.
 */
export function getGoldSourceType(data, year) {
  return data?.annual?.[year]?.gold_source_type ?? null;
}

/** بيتأكد إن قيمة معيّنة من annual متاحة للسنة المطلوبة (قبل الحساب). */
export function hasYearData(data, year) {
  const row = data?.annual?.[year];
  if (!row) return false;
  return REQUIRED_ANNUAL_FIELDS.every((f) => row[f] != null);
}

function checkCpiIndex(value, label) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    return { usable: false, code: 'BAD_CPI', reason: `قيمة غير صالحة: ${label}` };
  }
  // index لازم يكون رقم كبير نسبياً؛ < 10 غالباً اتدخل كنسبة تضخم (0.18 / 18)
  if (n < MIN_CPI_INDEX) {
    return {
      usable: false,
      code: 'CPI_LOOKS_LIKE_RATE',
      reason: `${label} شكله نسبة تضخم مش رقم قياسي (index). لازم يكون ≥ ${MIN_CPI_INDEX}.`,
    };
  }
  return null;
}

function checkRate(value, label) {
  const n = Number(value);
  if (Number.isNaN(n)) {
    return { usable: false, code: 'BAD_RATE', reason: `قيمة غير صالحة: ${label}` };
  }
  // كسر عشري؛ 1 أو أكتر يعني اتكتب 18 بدل 0.18
  if (n >= MAX_DECIMAL_RATE) {
    return {
      usable: false,
      code: 'RATE_LOOKS_LIKE_PERCENT',
      reason: `${label} لازم يكون كسر عشري (0.18 = 18%)، مش ${n}.`,
    };
  }
  if (n < 0) {
    return { usable: false, code: 'BAD_RATE', reason: `${label} سالب` };
  }
  return null;
}

/* ------------------------------ الحسابات ------------------------------ */

/**
 * سعر الهدف في سنة معيّنة بناءً على التضخم (عكس التضخم من سعر النهارده).
 * goalAtYear = goalToday * cpi[year] / cpi[current]
 */
export function goalPriceAtYear(goalToday, year, data) {
  const cpiYear = num(data.annual[year]?.cpi_index, `annual.${year}.cpi_index`);
  const cpiNow = num(getCurrent(data).cpi_index, 'current.cpi_index');
  return (goalToday * cpiYear) / cpiNow;
}

/**
 * مسار الكاش الخامل:
 * المبلغ اللي كان يشتري الهدف سنة startYear (goalAtStart) فضل كاش زي ما هو،
 * النهارده بيشتري نسبة = goalAtStart / goalToday من الهدف.
 */
export function cashPath(goalToday, startYear, data, goalAtStartOverride = null) {
  const goalAtStart =
    goalAtStartOverride != null ? goalAtStartOverride : goalPriceAtYear(goalToday, startYear, data);
  return buildResult('cash', goalAtStart, goalAtStart, goalToday);
}

/**
 * مسار الشهادة البنكية التمثيلية:
 * goalAtStart مركّب بعائد الشهادات سنة بسنة من startYear لحد latest_complete_year
 * (ضمناً)، بافتراض إعادة استثمار العائد سنوياً.
 */
export function certificatePath(goalToday, startYear, data, goalAtStartOverride = null) {
  const latest = getLatestCompleteYear(data);
  const goalAtStart =
    goalAtStartOverride != null ? goalAtStartOverride : goalPriceAtYear(goalToday, startYear, data);

  let valueToday = goalAtStart;
  for (let y = startYear; y <= latest; y++) {
    const rate = num(data.annual[y]?.certificate_rate, `annual.${y}.certificate_rate`);
    valueToday *= 1 + rate;
  }
  return buildResult('certificate', goalAtStart, valueToday, goalToday);
}

/**
 * مسار الذهب (حفظ قيمة):
 * goalAtStart اتحوّل جرامات بسعر سنة startYear، الجرامات قيمتها بسعر سبيكة الحالي.
 */
export function goldPath(goalToday, startYear, data, goalAtStartOverride = null) {
  const goalAtStart =
    goalAtStartOverride != null ? goalAtStartOverride : goalPriceAtYear(goalToday, startYear, data);

  const goldStart = num(data.annual[startYear]?.gold_gram_egp, `annual.${startYear}.gold_gram_egp`);
  const goldNow = num(getCurrent(data).gold_gram_egp, 'current.gold_gram_egp');
  const grams = goalAtStart / goldStart;
  const valueToday = grams * goldNow;
  const result = buildResult('gold', goalAtStart, valueToday, goalToday);
  result.grams = grams;
  // sourceType بيُحدّد النص المناسب في الـ UI (مصدر السعر: سبيكة أو خارجي مُرجَع).
  result.sourceType = data.annual[startYear]?.gold_source_type ?? null;
  return result;
}

/**
 * بيحسب المسارات الثلاثة مرة واحدة بنفس goalAtStart.
 */
export function computeJourney(goalToday, startYear, data, goalAtStartOverride = null) {
  const goalAtStart =
    goalAtStartOverride != null ? goalAtStartOverride : goalPriceAtYear(goalToday, startYear, data);

  return {
    goalToday,
    startYear,
    latestCompleteYear: getLatestCompleteYear(data),
    currentPeriod: data.meta?.current_period ?? null,
    goalAtStart,
    paths: {
      cash: cashPath(goalToday, startYear, data, goalAtStart),
      certificate: certificatePath(goalToday, startYear, data, goalAtStart),
      gold: goldPath(goalToday, startYear, data, goalAtStart),
    },
  };
}

/**
 * متوسط التضخم السنوي لآخر سنوات مكتملة، محسوب من سلسلة cpi نفسها.
 * lookback = عدد السنوات الأخيرة اللي ناخد متوسطها (افتراضي 3).
 * بيرجّع كسر عشري (0.25 = 25%).
 */
export function averageInflation(data, lookback = 3) {
  const years = getYears(data);
  const rates = [];
  for (let i = years.length - 1; i >= 1 && rates.length < lookback; i--) {
    const cur = data.annual[years[i]]?.cpi_index;
    const prev = data.annual[years[i - 1]]?.cpi_index;
    if (cur == null || prev == null || prev === 0) continue;
    rates.push(cur / prev - 1);
  }
  if (rates.length === 0) {
    throw new Error('averageInflation: مفيش بيانات cpi كفاية للحساب');
  }
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/**
 * الإسقاط المستقبلي — سيناريو توضيحي فقط.
 * بيرجّع المسافة اللي بتكبر بين الكاش الواقف (goalToday) والهدف الماشي.
 * مفيش أي رقم عائد ذهب/فضة مستقبلي — ده مقصود ومحمي بقيود البراند.
 */
export function projectFuture(goalToday, data, { yearsAhead = 5, lookback = 3 } = {}) {
  const avgInfl = averageInflation(data, lookback);
  const points = [];
  for (let k = 0; k <= yearsAhead; k++) {
    const goalPrice = goalToday * Math.pow(1 + avgInfl, k);
    points.push({
      yearOffset: k,
      goalPrice,
      cashCovers: goalToday / goalPrice, // نسبة الكاش الثابت من الهدف الماشي
    });
  }
  return { avgInflation: avgInfl, yearsAhead, lookback, points };
}

/* ------------------------------- helpers -------------------------------- */

function buildResult(key, goalAtStart, valueToday, goalToday) {
  const share = valueToday / goalToday;
  return {
    key,
    goalAtStart,
    valueToday,
    share,
    sharePct: share * 100,
    coversFull: share >= 1,
  };
}

/** بيتأكد إن القيمة رقم فعلي، وإلا بيرمي error واضح (مفيش fallback مخترع). */
function num(value, label) {
  if (value == null || Number.isNaN(Number(value))) {
    throw new Error(`economic-data: قيمة مفقودة أو غير صالحة → ${label}`);
  }
  return Number(value);
}
