import { useState } from 'react';
import { formatPct, formatEGP } from '../lib/format.js';

const LOGO_URL = `${import.meta.env.BASE_URL}assets/sabika-logo.svg`;

/**
 * الكارت القابل للمشاركة — هوية سبيكة نظيفة (gold/white).
 * - معاينة HTML للنتيجة الشخصية ("اللي معاك لسه معاك؟") + المسارات الثلاثة.
 * - زرار "شارك الكارت" بيرسم الكارت على canvas (ستوري 9:16 أو مربع) ويحوّله PNG
 *   ويشاركه عبر Web Share API، أو ينزّله لو المشاركة مش متاحة.
 * - ممنوع توليد الكارت طول ما الداتا تجريبية/ناقصة (الـ parent بيمرّر disabled).
 */
export default function ShareCard({ journey, goalLabel, disabled }) {
  const [ratio, setRatio] = useState('story'); // 'story' (9:16) أو 'square' (1:1)
  const [busy, setBusy] = useState(false);

  const { cash, certificate, gold } = journey.paths;

  async function handleShare() {
    if (disabled) return;
    setBusy(true);
    try {
      await ensureFontsLoaded();
      const blob = await renderCardPNG({ journey, goalLabel, ratio });
      const file = new File([blob], 'sabika-card.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'سبيكة — اللي معاك لسه معاك؟',
          text: 'شوف رحلة فلوسك مع هدف واحد 👇',
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sabika-card.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        console.error('share failed', err);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="share-card" id="share-card-preview">
        <img className="share-card__logo" src={LOGO_URL} alt="سبيكة" />
        <div className="share-card__q">اللي معاك لسه معاك؟</div>
        <div className="share-card__rows">
          <ShareRow name="💵 كاش خامل" share={cash.share} />
          <ShareRow name="🏦 شهادة بنكية" share={certificate.share} />
          <ShareRow name="🪙 ذهب" share={gold.share} gold />
        </div>
        <div className="share-card__foot">
          من سنة {journey.startYear} • هدفك: {goalLabel} ({formatEGP(journey.goalToday)})
          <br />
          للأغراض التوضيحية فقط — الأداء الماضي لا يضمن المستقبل.
        </div>
      </div>

      <div className="ratio-toggle" role="tablist">
        <button
          className={ratio === 'story' ? 'is-active' : ''}
          onClick={() => setRatio('story')}
        >
          ستوري 9:16
        </button>
        <button
          className={ratio === 'square' ? 'is-active' : ''}
          onClick={() => setRatio('square')}
        >
          مربع 1:1
        </button>
      </div>

      <button className="btn btn--primary" onClick={handleShare} disabled={disabled || busy}>
        {busy ? 'بيتجهّز…' : 'شارك الكارت 📤'}
      </button>
    </div>
  );
}

function ShareRow({ name, share, gold }) {
  return (
    <div className={`share-row ${gold ? 'share-row--gold' : ''}`}>
      <span className="share-row__name">{name}</span>
      <span className="share-row__val">{formatPct(share)}</span>
    </div>
  );
}

/* ----------------------- توليد PNG عبر canvas ----------------------- */

const C = {
  bg1: '#ffffff',
  bg2: '#fffaf0',
  gold: '#ebc100',
  goldSoft: '#fff6d8',
  border: '#f0e3a8',
  text: '#3a3a3a',
  muted: '#8a8a8a',
  rowBg: '#f7f7f7',
};

/**
 * بيتأكد إن خط Cairo متحمّل قبل الرسم على الـ canvas — عشان الصورة المتشاركة
 * تطلع بالخط الصح مش fallback (مهم على الموبايل لأن الخط بيتحمّل async).
 */
async function ensureFontsLoaded() {
  if (typeof document === 'undefined' || !document.fonts || !document.fonts.load) return;
  try {
    await Promise.all([
      document.fonts.load('900 60px Cairo'),
      document.fonts.load('800 64px Cairo'),
      document.fonts.load('700 44px Cairo'),
      document.fonts.load('400 26px Cairo'),
    ]);
    await document.fonts.ready;
  } catch {
    // نكمّل بالخط الافتراضي بدل ما نوقف المشاركة
  }
}

/** بيرسم الكارت على canvas ويرجّع Blob لصورة PNG. */
function renderCardPNG({ journey, goalLabel, ratio }) {
  return new Promise((resolve) => {
    const dims = ratio === 'square' ? { w: 1080, h: 1080 } : { w: 1080, h: 1920 };
    const canvas = document.createElement('canvas');
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    ctx.direction = 'rtl';
    ctx.textAlign = 'center';

    // خلفية فاتحة
    const grad = ctx.createLinearGradient(0, 0, 0, dims.h);
    grad.addColorStop(0, C.bg1);
    grad.addColorStop(1, C.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dims.w, dims.h);

    // إطار ذهبي خفيف
    ctx.strokeStyle = C.border;
    ctx.lineWidth = 4;
    roundRect(ctx, 30, 30, dims.w - 60, dims.h - 60, 36);
    ctx.stroke();

    const cx = dims.w / 2;
    let y = ratio === 'square' ? 150 : 340;
    const font = (size, weight = '700') => `${weight} ${size}px Cairo, sans-serif`;

    // البراند (wordmark نصي — اللوجو الكامل في المعاينة HTML)
    ctx.fillStyle = C.gold;
    ctx.font = font(72, '900');
    ctx.fillText('سبيكة', cx, y);
    y += 120;

    // السؤال
    ctx.fillStyle = C.text;
    ctx.font = font(64, '800');
    ctx.fillText('اللي معاك لسه معاك؟', cx, y);
    y += 130;

    // الصفوف الثلاثة
    const rows = [
      { name: '💵 كاش خامل', share: journey.paths.cash.share, gold: false },
      { name: '🏦 شهادة بنكية', share: journey.paths.certificate.share, gold: false },
      { name: '🪙 ذهب', share: journey.paths.gold.share, gold: true },
    ];
    const rowW = dims.w - 200;
    const rowH = 150;
    const rowX = 100;
    rows.forEach((r) => {
      ctx.fillStyle = r.gold ? C.goldSoft : C.rowBg;
      roundRect(ctx, rowX, y, rowW, rowH, 26);
      ctx.fill();

      ctx.textAlign = 'right';
      ctx.fillStyle = C.text;
      ctx.font = font(46, '700');
      ctx.fillText(r.name, rowX + rowW - 44, y + rowH / 2 + 16);

      ctx.textAlign = 'left';
      ctx.fillStyle = r.gold ? C.gold : C.text;
      ctx.font = font(58, '900');
      ctx.fillText(formatPct(r.share), rowX + 44, y + rowH / 2 + 18);
      ctx.textAlign = 'center';

      y += rowH + 28;
    });

    y += 34;
    ctx.fillStyle = C.muted;
    ctx.font = font(36, '600');
    ctx.fillText(`من سنة ${journey.startYear} • هدفك: ${goalLabel}`, cx, y);
    y += 54;
    ctx.fillStyle = C.text;
    ctx.font = font(44, '800');
    ctx.fillText(formatEGP(journey.goalToday), cx, y);

    // disclaimer أسفل الكارت
    ctx.fillStyle = C.muted;
    ctx.font = font(26, '400');
    ctx.fillText('للأغراض التوضيحية فقط — الأداء الماضي لا يضمن المستقبل', cx, dims.h - 80);

    canvas.toBlob((blob) => resolve(blob), 'image/png');
  });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
