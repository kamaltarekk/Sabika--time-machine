import { formatPct, formatEGP } from '../lib/format.js';

const META = {
  cash: { name: 'كاش خامل', emoji: '💵' },
  certificate: { name: 'شهادة بنكية', emoji: '🏦' },
  gold: { name: 'ذهب', emoji: '🪙' },
};

/**
 * شريط مسار واحد بيوضّح نسبة القيمة النهارده من الهدف.
 * بنقصّ عرض الشريط عند 100% بصرياً، بس النسبة الحقيقية بتتكتب كاملة.
 */
export default function PathBar({ result, note }) {
  const meta = META[result.key];
  const widthPct = Math.min(result.share, 1) * 100;
  return (
    <div className={`path path--${result.key}`}>
      <div className="path__head">
        <span className="path__name">
          <span aria-hidden>{meta.emoji}</span>
          {meta.name}
        </span>
        <span className="path__pct">{formatPct(result.share)}</span>
      </div>
      <div className="path__bar">
        <div className="path__fill" style={{ width: `${widthPct}%` }} />
      </div>
      <div className="path__note">
        {note ?? `قيمته النهارده ≈ ${formatEGP(result.valueToday)}`}
      </div>
    </div>
  );
}
