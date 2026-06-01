import { useState } from 'react';
import { formatPct, formatEGP } from '../lib/format.js';

/**
 * الكارت القابل للمشاركة.
 * - بيعرض معاينة HTML للنتيجة الشخصية ("اللي معاك لسه معاك؟").
 * - زرار "شارك الكارت" بيرسم الكارت على canvas (نسخة ستوري 9:16 أو مربعة)
 *   ويحوّله PNG ويشاركه عبر Web Share API، أو ينزّله لو المشاركة مش متاحة.
 * - ممنوع توليد الكارت طول ما البيانات تجريبية (بيتحكم فيه الـ parent عبر disabled).
 */
export default function ShareCard({ journey, goalLabel, disabled }) {
  const [ratio, setRatio] = useState('story'); // 'story' (9:16) أو 'square' (1:1)
  const [busy, setBusy] = useState(false);

  const { cash, certificate, gold } = journey.paths;

  async function handleShare() {
    if (disabled) return;
    setBusy(true);
    try {
      const blob = await renderCardPNG({ journey, goalLabel, ratio });
      const file = new File([blob], 'sabika-card.png', { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'سبيكة — اللي معاك لسه معاك؟',
          text: 'شوف رحلة فلوسك مع هدف واحد 👇',
        });
      } else {
        // fallback: تنزيل الصورة
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'sabika-card.png';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // المستخدم ممكن يلغي المشاركة — مش خطأ حقيقي
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
        <div className="share-card__brand">سبيكة</div>
        <div className="share-card__q">اللي معاك لسه معاك؟</div>
        <div className="share-card__rows">
          <ShareRow name="💵 كاش خامل" share={cash.share} />
          <ShareRow name="🏦 شهادة بنكية" share={certificate.share} />
          <ShareRow name="🪙 ذهب" share={gold.share} highlight />
        </div>
        <div className="share-card__foot">
          من سنة {journey.startYear} → هدفك: {goalLabel} (
          {formatEGP(journey.goalToday)})
        </div>
      </div>

      <div className="ratio-toggle">
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

function ShareRow({ name, share, highlight }) {
  return (
    <div className="share-row" style={highlight ? { background: 'rgba(212,175,55,0.14)' } : null}>
      <span className="share-row__name">{name}</span>
      <span className="share-row__val" style={highlight ? { color: 'var(--gold)' } : null}>
        {formatPct(share)}
      </span>
    </div>
  );
}

/* ----------------------- توليد PNG عبر canvas ----------------------- */

const COLORS = {
  bg1: '#1a1612',
  bg2: '#0f0d0a',
  gold: '#d4af37',
  goldSoft: '#e8c95f',
  text: '#f5efe3',
  dim: '#b8ad97',
  rowBg: 'rgba(255,255,255,0.04)',
  goldRowBg: 'rgba(212,175,55,0.14)',
};

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

    // خلفية متدرجة
    const grad = ctx.createLinearGradient(0, 0, dims.w, dims.h);
    grad.addColorStop(0, COLORS.bg1);
    grad.addColorStop(1, COLORS.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, dims.w, dims.h);

    // إطار ذهبي خفيف
    ctx.strokeStyle = 'rgba(212,175,55,0.35)';
    ctx.lineWidth = 4;
    ctx.strokeRect(24, 24, dims.w - 48, dims.h - 48);

    const cx = dims.w / 2;
    let y = ratio === 'square' ? 150 : 320;
    const font = (size, weight = '700') => `${weight} ${size}px Cairo, sans-serif`;

    // البراند
    ctx.fillStyle = COLORS.gold;
    ctx.font = font(64, '900');
    ctx.fillText('سبيكة', cx, y);
    y += 120;

    // السؤال
    ctx.fillStyle = COLORS.text;
    ctx.font = font(72, '800');
    ctx.fillText('اللي معاك لسه معاك؟', cx, y);
    y += 140;

    // الصفوف الثلاثة
    const rows = [
      { name: '💵 كاش خامل', share: journey.paths.cash.share, hl: false },
      { name: '🏦 شهادة بنكية', share: journey.paths.certificate.share, hl: false },
      { name: '🪙 ذهب', share: journey.paths.gold.share, hl: true },
    ];
    const rowW = dims.w - 200;
    const rowH = 150;
    const rowX = 100;
    rows.forEach((r) => {
      ctx.fillStyle = r.hl ? COLORS.goldRowBg : COLORS.rowBg;
      roundRect(ctx, rowX, y, rowW, rowH, 24);
      ctx.fill();

      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.text;
      ctx.font = font(48, '700');
      ctx.fillText(r.name, rowX + rowW - 40, y + rowH / 2 + 18);

      ctx.textAlign = 'left';
      ctx.fillStyle = r.hl ? COLORS.gold : COLORS.text;
      ctx.font = font(60, '900');
      ctx.fillText(formatPct(r.share), rowX + 40, y + rowH / 2 + 20);
      ctx.textAlign = 'center';

      y += rowH + 30;
    });

    y += 30;
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(36, '600');
    ctx.fillText(
      `من سنة ${journey.startYear} • هدفك: ${goalLabel}`,
      cx,
      y
    );
    y += 56;
    ctx.fillText(formatEGP(journey.goalToday), cx, y);

    // disclaimer أسفل الكارت
    ctx.fillStyle = COLORS.dim;
    ctx.font = font(28, '400');
    ctx.fillText('للأغراض التوضيحية فقط — الأداء الماضي لا يضمن المستقبل', cx, dims.h - 70);

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
