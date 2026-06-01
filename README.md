# سبيكة — رحلة فلوسك مع هدف واحد

تول تفاعلي (Vite + React، client-side بالكامل) لبراند سبيكة. المستخدم يختار هدف
وسعره النهارده وسنة بداية، ويشوف رحلة فلوسه عبر **3 مسارات**: كاش خامل / شهادة
بنكية / ذهب — في الماضي، وسيناريو توضيحي للمستقبل، وكارت قابل للمشاركة، وينتهي
بـ CTA لفتح حساب في تطبيق سبيكة (Direct install عبر Adjust).

## التشغيل

```bash
npm install
npm run dev      # تطوير
npm run build    # بناء static
npm run preview  # معاينة البناء
npm test         # اختبارات calc.js (Vitest)
```

## البنية

```
public/assets/sabika-logo.png   ← لوجو سبيكة الرسمي (مستخرج من splash التطبيق)
src/
  data/economic-data.json       ← مصدر الحقيقة الوحيد للأرقام (placeholder دلوقتي)
  lib/calc.js                   ← المنطق الحسابي + التحقق، دوال نقية
  lib/calc.test.js              ← اختبارات Vitest (20 اختبار)
  lib/format.js                 ← تنسيق أرقام/نسب بالعربي
  config.js                     ← إعدادات الـ CTA / Adjust install URL
  goals.js                      ← الأهداف الجاهزة
  App.jsx                       ← الـ wizard خطوة بخطوة
  components/                   ← PathBar / ShareCard / Disclaimer / PlaceholderWarning
  styles.css                    ← ثيم سبيكة الفاتح (CSS variables)
```

## نموذج البيانات (economic-data.json)

- **`meta.latest_complete_year`** — آخر سنة مكتملة (مثلاً 2025). السنة الجارية
  **مش** بتتعامل كسنة كاملة.
- **`meta.current_period`** — وصف الفترة الحالية (مثلاً `2026-Q2`).
- **`annual`** — السنوات المكتملة فقط (2018→2025)، كل سنة فيها:
  `cpi_index`, `gold_gram_egp`, `silver_price_egp`, `certificate_rate`, `cbe_rate_sanity_check`.
- **`current`** — المرجع الحالي (CPI الحالي + سعر الذهب/الفضة الحالي من سبيكة) المستخدم مع `goalToday`.

### مهم جدًا عن أنواع الأرقام
- **`cpi_index` رقم قياسي (INDEX) مش نسبة تضخم.** لا تدخل `0.18` أو `18` هنا.
  (مثال صحيح: `135.4`). فيه validation بيرفض أي قيمة `< 10`.
- **`certificate_rate` و `cbe_rate_sanity_check` كسور عشرية.** `0.18 = 18%`.
  لا تدخل `18`. فيه validation بيرفض أي قيمة `>= 1`.
- **`gold_gram_egp` / `silver_price_egp`** أسعار سبيكة المرجعية بالجنيه.
  **مصدر السعر لازم يكون سبيكة** — مفيش fallback خارجي. لو ناقص، النتائج تتمنع.
- **الفضة `future-ready`**: موجودة في الـ schema بس **مش مسار في الواجهة v1**،
  فهي مش مطلوبة للتحقق (ممكن تفضل null).

> **ملاحظة v1:** مفيش scraping تلقائي من Sabika.app. الأسعار تتملا يدويًا أو من
> export داخلي موثوق داخل `economic-data.json`.

## الافتراضات الحسابية (مفصّلة في رأس `src/lib/calc.js`)

1. سعر الهدف قديماً = `goalToday × annual[year].cpi_index / current.cpi_index`.
2. الشهادة: تركيب `certificate_rate` من `startYear` لحد `latest_complete_year`
   **ضمناً**، بافتراض إعادة استثمار سنوي.
3. الذهب: تحويل المبلغ جرامات بسعر سنته، وتقييمها بسعر سبيكة الحالي. **مفيش افتراض عائد.**
4. المستقبل: متوسط تضخم آخر 3 سنوات مكتملة من نفس الداتا — **سيناريو توضيحي**، مفيش رقم عائد ذهب/فضة مستقبلي.

## التحقق (validation) — النتائج والكارت بيتمنعوا لو:

`is_placeholder = true` • أي حقل مطلوب `null` • `latest_complete_year` مش موجود •
`current` data ناقصة • `cpi_index` شكله نسبة تضخم (`< 10`) • `certificate_rate`
مكتوب `18` بدل `0.18` (`>= 1`) • سعر ذهب سبيكة ناقص للسنة المطلوبة •
`CTA.installUrl` لسه placeholder.

في أي من دول: warning أحمر "البيانات تجريبية — لا تُنشر" + زرار الكارت `disabled`.

## القيود المحمية في الكود

- ✅ صفر أرقام اقتصادية hardcoded — كله من `economic-data.json`.
- ✅ المقارنة ثلاثية دائمًا (كاش/شهادة/ذهب). الفضة مش مسار رابع في v1.
- ✅ مفيش نص يوعد بعائد مستقبلي؛ الذهب = حفظ قيمة.
- ✅ disclaimer دائم تحت النتيجة وتحت الإسقاط + ملاحظات منهجية تحت الذهب والشهادة.

## التصميم

ثيم فاتح مستوحى من تطبيق سبيكة (خلفية بيضا، كروت ناعمة rounded بظل خفيف، ذهبي
دافئ، زرار CTA ذهبي بنص داكن). الألوان في `:root` داخل `src/styles.css` **تقريبية**
وعليها `TODO` لاستبدالها بالألوان الرسمية.

## مسؤوليتك قبل النشر (أماكن `FILL` / `TODO`)

1. **`src/data/economic-data.json`**: CPI index + أسعار سبيكة للذهب (والفضة لاحقًا) +
   عائد شهادات NBE/Banque Misr التمثيلي + CBE sanity check + `current` + `sources` +
   `last_updated` + `current_period` → وحوّل `is_placeholder` لـ **`false`**.
2. **`src/config.js`**: الـ Adjust click URL في `CTA.installUrl`.
3. **`src/styles.css`**: استبدل الـ palette التقريبي بالألوان الرسمية (اختياري).
4. راجع نصوص الكارت، واختبر على موبايل حقيقي (RTL + المشاركة).

> اللوجو الرسمي (`public/assets/sabika-logo.png`) متحط بالفعل، مستخرج من splash
> التطبيق بخلفية شفافة. لو عندك نسخة vector أنضف (SVG)، استبدله بيها.
