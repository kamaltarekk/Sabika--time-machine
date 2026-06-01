/**
 * تحذير أحمر بارز يظهر طول ما البيانات تجريبية (is_placeholder = true) أو ناقصة.
 * بيمنع توليد الكارت ويوضّح إن النتائج مش للنشر.
 */
export default function PlaceholderWarning({ reason }) {
  return (
    <div className="placeholder-warning" role="alert">
      <strong>⚠️ البيانات تجريبية — لا تُنشر</strong>
      الأرقام المعروضة مش حقيقية لسه. لازم تتملا{' '}
      <code>src/data/economic-data.json</code> بمصادر حقيقية ويتحوّل{' '}
      <code>is_placeholder</code> لـ <code>false</code> قبل أي نشر.
      {reason ? <div style={{ marginTop: 6, opacity: 0.85 }}>({reason})</div> : null}
    </div>
  );
}
