/**
 * src/config.js
 * إعدادات الـ CTA والـ attribution (Direct Install).
 * مصدر الحقيقة للتحويل هو Adjust — مش فيسبوك.
 *
 * الزرار النهائي بيفتح install URL واحد قابل للتبديل من هنا.
 * لو فيه Adjust click URL (بالـ trackers + UTM)، حطّه في installUrl.
 */
export const CTA = {
  label: 'افتح حسابك في سبيكة',
  // FILL: Adjust click URL (مفضّل) أو رابط Play Store + باراميترات UTM/Adjust tracker
  // مثال Adjust: https://app.adjust.com/XXXXXX?campaign=elli_maak&adgroup=...&creative=...
  // مثال Play Store: https://play.google.com/store/apps/details?id=com.sabika.app&referrer=utm_source%3D...
  installUrl: '<<<FILL: Adjust click URL أو Play Store URL + UTM>>>',
  packageName: 'com.sabika.app',
};

/** بيتأكد إن الـ installUrl اتظبط (مش placeholder). */
export function isInstallUrlReady() {
  return (
    typeof CTA.installUrl === 'string' &&
    CTA.installUrl.length > 0 &&
    !CTA.installUrl.includes('FILL')
  );
}
