/**
 * src/lib/calc.js
 * ---------------------------------------------------------------------------
 * كل المنطق الحسابي لرحلة فلوسك — دوال نقية (pure functions) قابلة للاختبار.
 * مفيش أي رقم hardcoded هنا. كل الأرقام بتيجي من كائن `data` اللي مصدره
 * src/data/economic-data.json.
 *
 * ============================ افتراضات حسابية ============================
 * (دي الافتراضات اللي اتبنى عليها الكود — موثّقة عشان تتراجع قبل النشر)
 *
 * 1) cpi_index = الرقم القياسي للأسعار (price index). بنستخدم النسبة بين
 *    سنتين، فاختيار سنة الأساس مش بيأثر على النتيجة طول ما السلسلة متّسقة.
 *    سعر الهدف في سنة قديمة = goalToday * cpi[year] / cpi[latestYear].
 *
 * 2) certificate_rate = العائد السنوي للشهادة ككسر عشري (0.18 يعني 18%).
 *    التركيب: لكل سنة y من startYear لحد (latestYear - 1) بنضرب في
 *    (1 + certificate_rate[y]) — أي العائد المكتسب خلال كل سنة لحد النهارده.
 *
 * 3) gold_gram_egp = متوسط سعر جرام الذهب عيار 24 بالجنيه في السنة دي.
 *    الذهب أداة حفظ قيمة: بنحوّل المبلغ القديم جرامات وقتها، وبنقيّم
 *    الجرامات دي بسعر النهارده. مفيش أي افتراض عائد — قيمة فعلية بس.
 *
 * 4) الإسقاط المستقبلي = متوسط التضخم للسنوات الأخيرة المحسوب من نفس الداتا
 *    (مش رقم مخترع). توضيحي بحت: بيمثّل إن سعر الهدف بيتحرّك لقدام بينما
 *    الكاش واقف. مفيش أي رقم عائد ذهب مستقبلي إطلاقاً.
 * =========================================================================
 */

/** بيرجّع سنين الداتا مرتبة تصاعدياً كأرقام. */
export function getYears(data) {
  return Object.keys(data.yearly)
    .map(Number)
    .filter((y) => !Number.isNaN(y))
    .sort((a, b) => a - b);
}

/** أحدث سنة في الداتا (السنة "النهارده" بالنسبة للحسابات). */
export function getLatestYear(data) {
  const years = getYears(data);
  if (years.length === 0) throw new Error('economic-data: مفيش سنين في الداتا');
  return years[years.length - 1];
}

/** أقدم سنة متاحة في الداتا. */
export function getEarliestYear(data) {
  const years = getYears(data);
  if (years.length === 0) throw new Error('economic-data: مفيش سنين في الداتا');
  return years[0];
}

/**
 * بيتأكد إن الداتا صالحة للحساب.
 * بيرجّع { usable, reason } — usable=false لو placeholder أو فيه قيم ناقصة.
 */
export function getDataStatus(data) {
  if (!data || !data.meta || !data.yearly) {
    return { usable: false, reason: 'الداتا غير موجودة أو غير مكتملة' };
  }
  if (data.meta.is_placeholder === true) {
    return { usable: false, reason: 'البيانات تجريبية (is_placeholder = true)' };
  }
  const years = getYears(data);
  for (const y of years) {
    const row = data.yearly[y];
    if (
      row.cpi_index == null ||
      row.gold_gram_egp == null ||
      row.certificate_rate == null
    ) {
      return { usable: false, reason: `بيانات ناقصة في سنة ${y}` };
    }
  }
  return { usable: true, reason: null };
}

/** اختصار: هل ممكن نعرض نتائج نهائية؟ */
export function isDataUsable(data) {
  return getDataStatus(data).usable;
}

/**
 * سعر الهدف في سنة معيّنة بناءً على التضخم (عكس التضخم من سعر النهارده).
 * goalAtYear = goalToday * cpi[year] / cpi[latestYear]
 */
export function goalPriceAtYear(goalToday, year, data) {
  const latestYear = getLatestYear(data);
  const cpiYear = num(data.yearly[year]?.cpi_index, `cpi_index[${year}]`);
  const cpiLatest = num(
    data.yearly[latestYear]?.cpi_index,
    `cpi_index[${latestYear}]`
  );
  return (goalToday * cpiYear) / cpiLatest;
}

/**
 * مسار الكاش الخامل:
 * المبلغ اللي كان يشتري الهدف سنة startYear (goalAtStart) فضل كاش زي ما هو،
 * النهارده بيشتري نسبة = goalAtStart / goalToday من الهدف.
 */
export function cashPath(goalToday, startYear, data, goalAtStartOverride = null) {
  const goalAtStart =
    goalAtStartOverride != null
      ? goalAtStartOverride
      : goalPriceAtYear(goalToday, startYear, data);
  const valueToday = goalAtStart; // كاش واقف — مفيش تغيّر اسمي
  return buildResult('cash', goalAtStart, valueToday, goalToday);
}

/**
 * مسار الشهادة البنكية:
 * goalAtStart مركّب بعائد الشهادات سنة بسنة لحد النهارده.
 */
export function certificatePath(
  goalToday,
  startYear,
  data,
  goalAtStartOverride = null
) {
  const latestYear = getLatestYear(data);
  const goalAtStart =
    goalAtStartOverride != null
      ? goalAtStartOverride
      : goalPriceAtYear(goalToday, startYear, data);

  let valueToday = goalAtStart;
  for (let y = startYear; y < latestYear; y++) {
    const rate = num(
      data.yearly[y]?.certificate_rate,
      `certificate_rate[${y}]`
    );
    valueToday *= 1 + rate;
  }
  return buildResult('certificate', goalAtStart, valueToday, goalToday);
}

/**
 * مسار الذهب (حفظ قيمة):
 * goalAtStart اتحوّل جرامات سنة startYear، الجرامات قيمتها النهارده.
 */
export function goldPath(goalToday, startYear, data, goalAtStartOverride = null) {
  const latestYear = getLatestYear(data);
  const goalAtStart =
    goalAtStartOverride != null
      ? goalAtStartOverride
      : goalPriceAtYear(goalToday, startYear, data);

  const goldStart = num(
    data.yearly[startYear]?.gold_gram_egp,
    `gold_gram_egp[${startYear}]`
  );
  const goldToday = num(
    data.yearly[latestYear]?.gold_gram_egp,
    `gold_gram_egp[${latestYear}]`
  );
  const grams = goalAtStart / goldStart;
  const valueToday = grams * goldToday;
  const result = buildResult('gold', goalAtStart, valueToday, goalToday);
  result.grams = grams;
  return result;
}

/**
 * بيحسب المسارات الثلاثة مرة واحدة.
 * بيرجّع { goalAtStart, paths: { cash, certificate, gold } }.
 */
export function computeJourney(goalToday, startYear, data, goalAtStartOverride = null) {
  const goalAtStart =
    goalAtStartOverride != null
      ? goalAtStartOverride
      : goalPriceAtYear(goalToday, startYear, data);

  return {
    goalToday,
    startYear,
    latestYear: getLatestYear(data),
    goalAtStart,
    paths: {
      cash: cashPath(goalToday, startYear, data, goalAtStart),
      certificate: certificatePath(goalToday, startYear, data, goalAtStart),
      gold: goldPath(goalToday, startYear, data, goalAtStart),
    },
  };
}

/**
 * متوسط التضخم السنوي للسنوات الأخيرة، محسوب من سلسلة cpi نفسها.
 * lookback = عدد السنوات الأخيرة اللي ناخد متوسطها (افتراضي 3).
 * بيرجّع كسر عشري (0.25 يعني 25%).
 */
export function averageInflation(data, lookback = 3) {
  const years = getYears(data);
  const rates = [];
  for (let i = years.length - 1; i >= 1 && rates.length < lookback; i--) {
    const cur = data.yearly[years[i]]?.cpi_index;
    const prev = data.yearly[years[i - 1]]?.cpi_index;
    if (cur == null || prev == null || prev === 0) continue;
    rates.push(cur / prev - 1);
  }
  if (rates.length === 0) {
    throw new Error('averageInflation: مفيش بيانات cpi كفاية للحساب');
  }
  return rates.reduce((a, b) => a + b, 0) / rates.length;
}

/**
 * الإسقاط المستقبلي — توضيحي فقط.
 * بيرجّع المسافة اللي بتكبر بين الكاش الواقف (goalToday) والهدف الماشي.
 * مفيش أي رقم عائد ذهب مستقبلي — ده مقصود ومحمي بقيود البراند.
 *
 * بيرجّع array لكل سنة فيها:
 *   { yearOffset, goalPrice, cashCovers (نسبة الكاش من الهدف) }
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
  return { avgInflation: avgInfl, yearsAhead, points };
}

/* ------------------------------- helpers -------------------------------- */

/**
 * بيبني نتيجة مسار موحّدة:
 *  - share: نسبة القيمة النهارده من سعر الهدف النهارده (0..1، ممكن > 1)
 *  - sharePct: نفس النسبة كـ %
 *  - coversFull: هل بيغطي الهدف كامل؟
 */
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
