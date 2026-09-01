import { SEASONAL_PACKS } from '@/lib/content/seasonalPacks';

export type PackAnswer = { text: string; correct: boolean };

export type PackQuestion = {
  prompt: string;
  answers: PackAnswer[];
};

export type ContentPackId =
  | 'sunday-school'
  | 'general-ar'
  | 'warmup'
  | 'advent'
  | 'christmas'
  | 'easter';

export interface ContentPack {
  id: ContentPackId;
  title: string;
  description: string;
  blurbEn: string;
  questions: PackQuestion[];
}

export const CONTENT_PACKS: ContentPack[] = [
  {
    id: 'sunday-school',
    title: 'مدارس الأحد',
    description: '11 سؤال من الكتاب نبدأ بيهم اللعبة',
    blurbEn: 'Sunday school — 11 Bible questions',
    questions: [
      { prompt: 'ماهى المعجزة التى تدخلت فيها العذراء لإتمامها ؟', answers: [{ text: 'إقامة ابن أرملة نايين', correct: false }, { text: 'إشباع الجموع', correct: false }, { text: 'عرس قانا الجليل', correct: true }, { text: 'إقامة ابنة يايرس', correct: false }] },
      { prompt: 'ترتيب سفر العدد هو .....', answers: [{ text: '5', correct: false }, { text: '3', correct: false }, { text: '7', correct: false }, { text: '4', correct: true }] },
      { prompt: 'من الذى بشر العذراء ؟', answers: [{ text: 'الملاك جبرائيل', correct: true }, { text: 'الملاك سوريال', correct: false }, { text: 'الملاك روفائيل', correct: false }, { text: 'الملاك ميخائيل', correct: false }] },
      { prompt: 'هوذا العذراء تحبل و تلد ابناً و تدعو اسمه عمانوئيل نبوة جاءت فى ......', answers: [{ text: 'إرميا', correct: false }, { text: 'حزقيال', correct: false }, { text: 'دانيال', correct: false }, { text: 'إشعياء', correct: true }] },
      { prompt: 'ما هى الرسالة التي تسمى برسالة الفرح ؟', answers: [{ text: 'كورنثوس الثانية', correct: false }, { text: 'فيلبى', correct: true }, { text: 'فليمون', correct: false }, { text: 'تيموثاوس الأولى', correct: false }] },
      { prompt: 'فى أى جبل رأى موسى العليقة المحترقة ؟', answers: [{ text: 'أراراط', correct: false }, { text: 'حوريب', correct: true }, { text: 'الزيتون', correct: false }, { text: 'سيناء', correct: false }] },
      { prompt: 'أين كان يوحنا عندما أوحى إليه بسفر الرؤيا ؟', answers: [{ text: 'جزيرة مالطة', correct: false }, { text: 'جزيرة قبرص', correct: false }, { text: 'جزيرة كريت', correct: false }, { text: 'جزيرة بطمس', correct: true }] },
      { prompt: 'ما هو أول وعد من الله للبشر ؟', answers: [{ text: 'نسل المرأة يسحق رأس الحية', correct: true }, { text: 'أكرم أباك و أمك', correct: false }, { text: 'دخول أرض كنعان', correct: false }, { text: 'هاتوا العشور و جربونى', correct: false }] },
      { prompt: 'من الذى سمى يوحنا المعمدان بهذا الإسم ؟', answers: [{ text: 'زكريا', correct: false }, { text: 'الملاك', correct: true }, { text: 'المسيح', correct: false }, { text: 'أليصابات', correct: false }] },
      { prompt: 'ما هى أول طوبى نطق بها السيد المسيح ؟', answers: [{ text: 'طوبى للمساكين بالروح', correct: true }, { text: 'طوبى للودعاء', correct: false }, { text: 'طوبى للباكين و العطاشى إلى البر', correct: false }, { text: 'طوبى للحزانى', correct: false }] },
      { prompt: 'من هو الراعي الصغير الذي قتل أسدآ ؟', answers: [{ text: 'شمشون', correct: false }, { text: 'عاموس', correct: false }, { text: 'جدعون', correct: false }, { text: 'داود', correct: true }] },
    ],
  },
  {
    id: 'general-ar',
    title: 'معلومات عامة',
    description: '19 سؤال رياضة وعلوم وجغرافيا',
    blurbEn: 'General knowledge — sport, science, geography',
    questions: [
      { prompt: 'من هو المنتخب الذى فاز ببطولة كأس العالم مرتين متتاليتين ؟', answers: [{ text: 'البرازيل', correct: false }, { text: 'ألمانيا', correct: false }, { text: 'إيطاليا', correct: false }, { text: 'فرنسا', correct: false }, { text: 'البرازيل و إيطاليا', correct: true }] },
      { prompt: 'عدد أفراد فريق كرة الماء ؟', answers: [{ text: '6 لاعبين', correct: false }, { text: '5 لاعبين', correct: false }, { text: '8 لاعبين', correct: false }, { text: '7 لاعبين', correct: true }] },
      { prompt: 'تشتهر مصارعة الثيران في أي دولة؟', answers: [{ text: 'فرنسا', correct: false }, { text: 'إسبانيا', correct: true }, { text: 'كوستاريكا', correct: false }, { text: 'إيطاليا', correct: false }] },
      { prompt: 'أى الوحدات التالية هى الأكبر ؟', answers: [{ text: 'جيجا', correct: false }, { text: 'تيرا', correct: true }, { text: 'بايت', correct: false }, { text: 'ميجا', correct: false }] },
      { prompt: 'أين تقع غابات الأمازون ؟', answers: [{ text: 'آسيا', correct: false }, { text: 'أمريكا', correct: true }, { text: 'أوروبا', correct: false }, { text: 'أستراليا', correct: false }] },
      { prompt: 'ما هى القارة العجوز ؟', answers: [{ text: 'أوروبا', correct: true }, { text: 'إفريقيا', correct: false }, { text: 'أستراليا', correct: false }, { text: 'آسيا', correct: false }] },
      { prompt: 'الدولة التى إستضافت كأس العالم سنة 1990؟', answers: [{ text: 'ألمانيا', correct: false }, { text: 'البرتغال', correct: false }, { text: 'إيطاليا', correct: true }, { text: 'البرازيل', correct: false }] },
      { prompt: 'مكتشف قاعدة طفو الأجسام هو', answers: [{ text: 'أرشميدس', correct: true }, { text: 'نيوتن', correct: false }, { text: 'أينشتاين', correct: false }, { text: 'أديسون', correct: false }] },
      { prompt: 'أى من الغازات التالية يستخدم في إطفاء الحرائق ؟', answers: [{ text: 'ثانى أكسيد الكربون', correct: true }, { text: 'الأكسجين', correct: false }, { text: 'الهيدروجين', correct: false }, { text: 'النيتروجين', correct: false }] },
      { prompt: 'ما هى عدد فقرات جسم الإنسان ؟', answers: [{ text: '33 فقرة', correct: true }, { text: '30 فقرة', correct: false }, { text: '28 فقرة', correct: false }, { text: '32 فقرة', correct: false }] },
      { prompt: 'من الذي استعمل أشعة الشمس كسلاح في الحرب و قضى بها على الأسطول الروماني ؟', answers: [{ text: 'أرشميدس', correct: true }, { text: 'نيوتن', correct: false }, { text: 'أديسون', correct: false }, { text: 'جاليليو', correct: false }] },
      { prompt: 'ما هى المادة المسؤلة عن تلون الجسم باللون الداكن ؟', answers: [{ text: 'الميلانين', correct: true }, { text: 'السيروتونين', correct: false }, { text: 'الدوبامين', correct: false }, { text: 'النيوماسيسين', correct: false }] },
      { prompt: 'ما هى أكبر جزيرة فى البحر المتوسط ؟', answers: [{ text: 'جزيرة صقلية', correct: true }, { text: 'جزيرة كريت', correct: false }, { text: 'جزيرة قبرص', correct: false }, { text: 'جزيرة مالطة', correct: false }] },
      { prompt: 'أعلى قمة جبل في إفريقيا ؟', answers: [{ text: 'كلمنجارو', correct: true }, { text: 'إفرست', correct: false }, { text: 'الألب', correct: false }, { text: 'هيمالايا', correct: false }] },
      { prompt: 'ما هى الدولة التى استضافت كأس العالم 1998 ؟', answers: [{ text: 'فرنسا', correct: true }, { text: 'البرازيل', correct: false }, { text: 'الأرجنتين', correct: false }, { text: 'ألمانيا', correct: false }] },
      { prompt: 'أين يقع مقر منظمة الصحة العالمية ؟', answers: [{ text: 'جنيف', correct: true }, { text: 'لندن', correct: false }, { text: 'روما', correct: false }, { text: 'نيويورك', correct: false }] },
      { prompt: 'ما هى عاصمة تايلاند ؟', answers: [{ text: 'بانكوك', correct: true }, { text: 'طوكيو', correct: false }, { text: 'بكين', correct: false }, { text: 'كييف', correct: false }] },
      { prompt: 'ما هو أضخم الحيوانات اللا فقارية ؟', answers: [{ text: 'الحبار', correct: true }, { text: 'الأخطبوط', correct: false }, { text: 'الإستاكوزا', correct: false }, { text: 'الحلزون', correct: false }] },
      { prompt: 'أبعد كوكب عن الأرض فى المذكورين', answers: [{ text: 'أورانوس', correct: true }, { text: 'المشترى', correct: false }, { text: 'زحل', correct: false }, { text: 'عطارد', correct: false }] },
    ],
  },
  {
    id: 'warmup',
    title: 'تسخين اللعبة',
    description: '8 أسئلة سريعة نفتح بيهم الغرفة',
    blurbEn: 'Warm-up — 8 fast openers',
    questions: [
      { prompt: 'عاصمة مصر إيه؟', answers: [{ text: 'القاهرة', correct: true }, { text: 'الإسكندرية', correct: false }, { text: 'أسوان', correct: false }, { text: 'الأقصر', correct: false }] },
      { prompt: 'الأسبوع فيه كام يوم؟', answers: [{ text: '5', correct: false }, { text: '6', correct: false }, { text: '7', correct: true }, { text: '8', correct: false }] },
      { prompt: 'مصر في أنهي قارة؟', answers: [{ text: 'آسيا', correct: false }, { text: 'أفريقيا', correct: true }, { text: 'أوروبا', correct: false }, { text: 'أستراليا', correct: false }] },
      { prompt: 'عاصمة السعودية إيه؟', answers: [{ text: 'جدة', correct: false }, { text: 'الرياض', correct: true }, { text: 'مكة', correct: false }, { text: 'الدمام', correct: false }] },
      { prompt: 'أكبر محيط على الأرض إيه؟', answers: [{ text: 'الأطلسي', correct: false }, { text: 'الهندي', correct: false }, { text: 'الهادئ', correct: true }, { text: 'المتجمد الشمالي', correct: false }] },
      { prompt: '5 + 2 بكام؟', answers: [{ text: '6', correct: false }, { text: '7', correct: true }, { text: '8', correct: false }, { text: '9', correct: false }] },
      { prompt: 'أول إنجيل في العهد الجديد إيه؟', answers: [{ text: 'مرقس', correct: false }, { text: 'لوقا', correct: false }, { text: 'يوحنا', correct: false }, { text: 'متى', correct: true }] },
      { prompt: 'لون مش موجود في علم مصر؟', answers: [{ text: 'أحمر', correct: false }, { text: 'أبيض', correct: false }, { text: 'أسود', correct: false }, { text: 'أزرق', correct: true }] },
    ],
  },
  ...SEASONAL_PACKS,
];

export function getContentPack(id: string): ContentPack | null {
  return CONTENT_PACKS.find((pack) => pack.id === id) ?? null;
}

export function isContentPackId(value: unknown): value is ContentPackId {
  return CONTENT_PACKS.some((pack) => pack.id === value);
}
