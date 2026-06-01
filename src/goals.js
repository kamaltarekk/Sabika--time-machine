/**
 * أهداف جاهزة للاختيار. الأسعار مش مخزّنة هنا — المستخدم بيدخل سعر النهارده،
 * عشان نلتزم بقاعدة "مفيش أرقام hardcoded للقيم الاقتصادية".
 * defaultPrice مجرد اقتراح مبدئي للواجهة (placeholder)، المستخدم بيقدر يغيّره.
 */
export const GOALS = [
  { id: 'apartment', emoji: '🏠', label: 'شقة', defaultPrice: 2000000 },
  { id: 'car', emoji: '🚗', label: 'عربية', defaultPrice: 900000 },
  { id: 'marriage', emoji: '💍', label: 'جواز', defaultPrice: 500000 },
  { id: 'travel', emoji: '✈️', label: 'سفر', defaultPrice: 150000 },
  { id: 'custom', emoji: '🎯', label: 'مبلغ مخصص', defaultPrice: null },
];

export function getGoal(id) {
  return GOALS.find((g) => g.id === id) || null;
}
