import { useMemo, useState } from 'react';
import data from './data/economic-data.json';
import { CTA, isInstallUrlReady } from './config.js';
import { GOALS, getGoal } from './goals.js';
import {
  getDataStatus,
  getYears,
  getLatestYear,
  computeJourney,
  projectFuture,
} from './lib/calc.js';
import { formatEGP, formatPct } from './lib/format.js';
import PlaceholderWarning from './components/PlaceholderWarning.jsx';
import Disclaimer from './components/Disclaimer.jsx';
import PathBar from './components/PathBar.jsx';
import ShareCard from './components/ShareCard.jsx';

const STEPS = ['goal', 'price', 'year', 'past', 'future', 'card', 'cta'];

export default function App() {
  const dataStatus = useMemo(() => getDataStatus(data), []);
  const usable = dataStatus.usable;
  const years = useMemo(() => getYears(data), []);
  const latestYear = useMemo(() => getLatestYear(data), []);

  const [stepIdx, setStepIdx] = useState(0);
  const [goalId, setGoalId] = useState(null);
  const [price, setPrice] = useState('');
  const [startYear, setStartYear] = useState(years[0]);

  const step = STEPS[stepIdx];
  const goal = getGoal(goalId);
  const goalToday = Number(price) || 0;

  // بنحسب الرحلة بس لو الداتا صالحة والمدخلات تمام (عشان calc بيرمي على null).
  const journey = useMemo(() => {
    if (!usable || !goalToday || !startYear) return null;
    try {
      return computeJourney(goalToday, startYear, data);
    } catch {
      return null;
    }
  }, [usable, goalToday, startYear]);

  const future = useMemo(() => {
    if (!usable || !goalToday) return null;
    try {
      return projectFuture(goalToday, data, { yearsAhead: 5, lookback: 3 });
    } catch {
      return null;
    }
  }, [usable, goalToday]);

  const goalLabel =
    goal && goal.id !== 'custom' ? goal.label : 'هدفك';

  const next = () => setStepIdx((i) => Math.min(i + 1, STEPS.length - 1));
  const back = () => setStepIdx((i) => Math.max(i - 1, 0));

  const canNext = () => {
    if (step === 'goal') return !!goalId;
    if (step === 'price') return goalToday > 0;
    if (step === 'year') return !!startYear;
    return true;
  };

  return (
    <div className="app">
      <header className="brand">
        <span className="brand__logo">سبيكة</span>
        <span className="brand__tag">رحلة فلوسك مع هدف واحد</span>
      </header>

      <div className="progress" aria-hidden>
        {STEPS.map((s, i) => (
          <span
            key={s}
            className={`progress__dot ${
              i < stepIdx ? 'is-done' : i === stepIdx ? 'is-active' : ''
            }`}
          />
        ))}
      </div>

      {step === 'goal' && (
        <GoalStep goalId={goalId} onPick={(id) => {
          setGoalId(id);
          const g = getGoal(id);
          if (g && g.defaultPrice) setPrice(String(g.defaultPrice));
        }} />
      )}

      {step === 'price' && (
        <PriceStep goal={goal} price={price} setPrice={setPrice} />
      )}

      {step === 'year' && (
        <YearStep years={years} startYear={startYear} setStartYear={setStartYear} />
      )}

      {step === 'past' && (
        <PastStep
          usable={usable}
          reason={dataStatus.reason}
          journey={journey}
          startYear={startYear}
          goalLabel={goalLabel}
        />
      )}

      {step === 'future' && (
        <FutureStep
          usable={usable}
          reason={dataStatus.reason}
          future={future}
          latestYear={latestYear}
        />
      )}

      {step === 'card' && (
        <CardStep
          usable={usable}
          reason={dataStatus.reason}
          journey={journey}
          goalLabel={goalLabel}
        />
      )}

      {step === 'cta' && <CtaStep />}

      {/* أزرار التنقل (مخفية في خطوة الـ CTA النهائية) */}
      {step !== 'cta' && (
        <div className="actions">
          {stepIdx > 0 && (
            <button className="btn btn--ghost" onClick={back}>
              رجوع
            </button>
          )}
          <button className="btn btn--primary" onClick={next} disabled={!canNext()}>
            {step === 'card' ? 'يلا نكمّل' : 'كمّل'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ الخطوات ------------------------------ */

function GoalStep({ goalId, onPick }) {
  return (
    <div className="step">
      <h1 className="step__title">هدفك إيه؟</h1>
      <p className="step__sub">اختار حاجة واحدة بتجمّع عشانها — وخلّينا نشوف رحلة فلوسك ناحيتها.</p>
      <div className="goal-grid">
        {GOALS.map((g) => (
          <button
            key={g.id}
            className={`goal-btn ${goalId === g.id ? 'is-selected' : ''}`}
            onClick={() => onPick(g.id)}
          >
            <span className="goal-btn__emoji" aria-hidden>{g.emoji}</span>
            {g.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PriceStep({ goal, price, setPrice }) {
  return (
    <div className="step">
      <h1 className="step__title">سعره النهارده كام؟</h1>
      <p className="step__sub">
        قرّب بقدر ما تقدر — {goal && goal.id !== 'custom' ? `سعر ${goal.label}` : 'سعر هدفك'} النهارده بالجنيه.
      </p>
      <div className="field">
        <label className="field__label" htmlFor="price">السعر بالجنيه المصري</label>
        <input
          id="price"
          className="input"
          type="number"
          inputMode="numeric"
          placeholder="مثلاً 500000"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
      </div>
    </div>
  );
}

function YearStep({ years, startYear, setStartYear }) {
  return (
    <div className="step">
      <h1 className="step__title">نرجع بالزمن لسنة كام؟</h1>
      <p className="step__sub">تخيّل إنك جمّعت المبلغ ده من السنة دي — هنشوف بقى لحد النهارده.</p>
      <div className="years">
        {years.slice(0, -1).map((y) => (
          <button
            key={y}
            className={`year-btn ${startYear === y ? 'is-selected' : ''}`}
            onClick={() => setStartYear(y)}
          >
            {y}
          </button>
        ))}
      </div>
    </div>
  );
}

function PastStep({ usable, reason, journey, startYear, goalLabel }) {
  return (
    <div className="step">
      <h1 className="step__title">من سنة {startYear} لحد النهارده</h1>
      <p className="step__sub">
        المبلغ اللي كان يشتري {goalLabel} كامل سنة {startYear} — يشتري قدّ إيه منه النهارده في كل مسار؟
      </p>

      {!usable && <PlaceholderWarning reason={reason} />}

      {usable && journey && (
        <>
          <div className="paths">
            <PathBar result={journey.paths.cash} />
            <PathBar result={journey.paths.certificate} />
            <PathBar result={journey.paths.gold} />
          </div>
          <p className="step__sub" style={{ marginTop: 18, marginBottom: 0 }}>
            الكاش وقف مكانه، الهدف اتحرّك لقدام. الذهب لاحق الهدف كأداة حفظ قيمة.
          </p>
          <Disclaimer />
        </>
      )}
    </div>
  );
}

function FutureStep({ usable, reason, future, latestYear }) {
  return (
    <div className="step">
      <h1 className="step__title">وبكرة؟ الهدف بيكمّل مشوار</h1>
      <p className="step__sub">
        طول ما الأسعار بتتحرّك لقدام، الكاش الواقف بيغطّي نسبة أقل من الهدف سنة ورا سنة. المسافة دي بتكبر.
      </p>

      {!usable && <PlaceholderWarning reason={reason} />}

      {usable && future && (
        <>
          <div className="future-chart">
            {future.points
              .filter((p) => p.yearOffset % 1 === 0)
              .map((p) => (
                <div className="future-row" key={p.yearOffset}>
                  <span className="future-row__label">
                    {p.yearOffset === 0 ? 'النهارده' : `+${p.yearOffset} سنة`}
                  </span>
                  <div className="future-row__track">
                    <span className="future-row__goal" />
                    <span
                      className="future-row__cash"
                      style={{ width: `${Math.max(p.cashCovers, 0) * 100}%` }}
                    />
                  </div>
                  <span className="future-row__label" style={{ width: 'auto' }}>
                    {formatPct(p.cashCovers)}
                  </span>
                </div>
              ))}
          </div>
          <p className="step__sub" style={{ marginTop: 16, marginBottom: 0 }}>
            الإطار الذهبي = الهدف الماشي. الجزء الرمادي = اللي الكاش الواقف لسه بيغطّيه منه.
          </p>
          <Disclaimer />
        </>
      )}
    </div>
  );
}

function CardStep({ usable, reason, journey, goalLabel }) {
  const goldShare = journey?.paths.gold.share;
  return (
    <div className="step">
      {usable && journey ? (
        <>
          <p className="aha">
            <span className="hl">اللي معاك لسه معاك؟</span>
            <br />
            الذهب حافظ على {formatPct(goldShare)} من قيمة هدفك.
          </p>
          <ShareCard journey={journey} goalLabel={goalLabel} disabled={!usable} />
          <Disclaimer />
        </>
      ) : (
        <>
          <h1 className="step__title">الكارت لسه مش جاهز</h1>
          <PlaceholderWarning reason={reason} />
          <p className="step__sub">
            مينفعش نطلّع كارت للمشاركة بأرقام تجريبية. املا البيانات الحقيقية الأول.
          </p>
        </>
      )}
    </div>
  );
}

function CtaStep() {
  const ready = isInstallUrlReady();
  const open = () => {
    if (ready) window.open(CTA.installUrl, '_blank', 'noopener');
  };
  return (
    <div className="step" style={{ justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>🪙</div>
      <h1 className="step__title">خلّي فلوسك تلاحق هدفك</h1>
      <p className="step__sub">
        ابدأ تحوّل جزء من مدخراتك ذهب جوّه سبيكة — أداة حفظ قيمة قدام التضخم.
      </p>
      <div style={{ marginTop: 'auto', width: '100%', paddingTop: 24 }}>
        {!ready && (
          <div className="placeholder-warning">
            <strong>⚠️ رابط التثبيت مش متظبط</strong>
            حط الـ Adjust install URL في <code>src/config.js</code> قبل النشر.
          </div>
        )}
        <button className="btn btn--cta" onClick={open} disabled={!ready}>
          {CTA.label}
        </button>
        <Disclaimer />
      </div>
    </div>
  );
}
