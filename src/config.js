/**
 * src/config.js
 * إعدادات الـ CTA والـ attribution (Direct Install).
 * مصدر الحقيقة للتحويل هو Adjust — مش فيسبوك ولا Play Store مباشرة.
 *
 * مهم: installUrl المفروض يكون **Adjust click URL** (اللي بيعمل tracking للحملة
 * وبعدها بيوجّه لـ Play Store)، مش رابط Play Store مباشر — إلا لو رابط Play Store
 * مستخدم كـ fallback **جوّه** إعداد Adjust نفسه.
 */
export const CTA = {
  label: 'افتح حسابك في سبيكة',
  // FILL: Adjust click URL — مثال:
  // https://app.adjust.com/XXXXXX?campaign=elli_maak&adgroup=...&creative=...
  // (Play Store URL يتحط كـ fallback جوّه Adjust، مش هنا)
  installUrl: 'https://sabika.go.link/l9zxN',
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
