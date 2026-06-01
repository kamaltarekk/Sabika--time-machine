/**
 * تحذير بسيط يظهر للمستخدم طول ما البيانات تجريبية أو ناقصة.
 * نص واحد مفهوم — بدون أي تفاصيل تقنية (مفيش أسماء ملفات أو flags).
 * التفاصيل التقنية بتروح console فقط (شوف App.jsx → devIssues).
 */
export default function PlaceholderWarning() {
  return (
    <div className="placeholder-warning" role="alert">
      البيانات تجريبية — النتائج غير جاهزة للنشر.
    </div>
  );
}
