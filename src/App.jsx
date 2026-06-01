import { useMemo, useState } from 'react';
import data from './data/economic-data.json';
import { CTA, isInstallUrlReady } from './config.js';
import { GOALS, getGoal } from './goals.js';
import {
  getDataStatus,
  getYears,
  getLatestCompleteYear,
  computeJourney,
  projectFuture,
} from './lib/calc.js';
import { formatEGP, formatPct } from './lib/format.js';
import PlaceholderWarning from './components/PlaceholderWarning.jsx';
import Disclaimer, { GoldPriceNote, CertificateNote } from './components/Disclaimer.jsx';
import PathBar from './components/PathBar.jsx';
import ShareCard from './components/ShareCard.jsx';

const LOGO_URL = `${import.meta.env.BASE_URL}assets/sabika-logo.svg`;
const STEPS = ['goal', 'price', 'year', 'past', 'future', 'card', 'cta'];

export default function App() {
  const dataStatus = useMemo(() => getDataStatus(data), []);
  const usable = dataStatus.usable;
  // اختيار السنوات بيتولّد من annual المتاحة — مش hardcoded.
  const years = useMemo(() => getYears(data), []);
  const latestCompleteYear = useMemo(() => {
    try {
      return getLatestCompleteYear(data);
    } catch {
      return null;
    }
  }, []);

  const [stepIdx, setStepIdx] = useState(0);
  const [goalId, setGoalId] = useState(null);
  const [price, setPrice] = useState('');
  const [startYear, setStartYear] = useState(years[0] ?? null);

  const step = STEPS[stepIdx];
  const goal = getGoal(goalId);
  const goalToday = Number(price) || 0;

  // الرحلة بتتحسب بس لو الداتا صالحة والمدخلات تمام (calc بيرمي على null).
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

  const goalLabel = goal && goal.id !== 'custom' ? goal.label : 'هدفك';

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
        <img className="brand__logo-img" src={LOGO_URL} alt="سبيكة" />
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
        <GoalStep
          goalId={goalId}
          onPick={(id) => {
            setGoalId(id);
            const g = getGoal(id);
            if (g && g.defaultPrice) setPrice(String(g.defaultPrice));
          }}
        />
      )}

      {step === 'price' && <PriceStep goal={goal} price={price} setPrice={setPrice} />}

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
        <FutureStep usable={usable} reason={dataStatus.reason} future={future} />
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
      <p className="step__sub">
        اختار حاجة واحدة بتجمّع عشانها — وخلّينا نشوف رحلة فلوسك ناحيتها بهدوء.
      </p>
      <div className="goal-grid">
        {GOALS.map((g) => (
          <button
            key={g.id}
            className={`goal-btn ${goalId === g.id ? 'is-selected' : ''}`}
            onClick={() => onPick(g.id)}
          >
            <span className="goal-btn__emoji" aria-hidden>
              {g.emoji}
            </span>
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
        <label className="field__label" htmlFor="price">
          السعر بالجنيه المصري
        </label>
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
      <p className="step__sub">
        تخيّل إنك جمّعت المبلغ ده من السنة دي — هنشوف بقى لحد النهارده.
      </p>
      <div className="years">
        {years.map((y) => (
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
        المبلغ اللي كان يكفّي {goalLabel} كامل سنة {startYear} — يغطّي قدّ إيه منه النهارده في كل مسار؟
      </p>

      {!usable && <PlaceholderWarning reason={reason} />}

      {usable && journey && (
        <>
          <div className="paths">
            <PathBar result={journey.paths.cash} note="الكاش فضل واقف مكانه." />
            <PathBar result={journey.paths.certificate} />
            <PathBar result={journey.paths.gold} />
          </div>
          <CertificateNote />
          <GoldPriceNote goldSourceType={journey.paths.gold.sourceType} />
          <p className="step__sub" style={{ marginTop: 16, marginBottom: 0 }}>
            الهدف اتحرّك لقدام، والكاش الواقف بقى يغطّي أقل. الذهب أداة حفظ قيمة تاريخيًا قدام التضخم.
          </p>
          <Disclaimer />
        </>
      )}
    </div>
  );
}

function FutureStep({ usable, reason, future }) {
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
            {future.points.map((p) => (
              <div className="future-row" key={p.yearOffset}>
                <span className="future-row__label">
                  {p.yearOffset === 0 ? 'النهارده' : `+${p.yearOffset} سنة`}
                </span>
                <div className="future-row__track">
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
          <p className="method-note">
            سيناريو توضيحي مبني على متوسط آخر 3 سنوات من البيانات، وليس توقعًا أو ضمانًا. الجزء
            الذهبي = الهدف الماشي، والجزء الرمادي = اللي الكاش الواقف لسه بيغطّيه منه.
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
            مينفعش نطلّع كارت للمشاركة بأرقام تجريبية أو ناقصة. لازم البيانات الحقيقية تتملا الأول.
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
    <div className="step cta-screen">
      <img className="cta-screen__logo" src={LOGO_URL} alt="سبيكة" />
      <h1 className="step__title">خلّي جزء من مدخراتك ذهب</h1>
      <p className="step__sub">
        ابدأ مع سبيكة — أداة بسيطة لحفظ القيمة قدام التضخم، خطوة بخطوة.
      </p>
      <div style={{ marginTop: 'auto', width: '100%', paddingTop: 22 }}>
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
