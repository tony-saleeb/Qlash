import type { ContentPack } from '@/lib/content/packs';

export const SEASONAL_PACKS: ContentPack[] = [
  {
    id: 'advent',
    title: 'زمن المجيء',
    description: '8 أسئلة لكيهك والمجيء — نفتح بيهم الأسبوع',
    blurbEn: 'Advent — 8 Sunday school questions',
    questions: [
      { prompt: 'كم أحدًا في زمن المجيء؟', answers: [{ text: '2', correct: false }, { text: '3', correct: false }, { text: '4', correct: true }, { text: '6', correct: false }] },
      { prompt: 'من الذي بشّر زكريا بميلاد يوحنا؟', answers: [{ text: 'الملاك ميخائيل', correct: false }, { text: 'الملاك جبرائيل', correct: true }, { text: 'الملاك روفائيل', correct: false }, { text: 'إيليا', correct: false }] },
      { prompt: 'من قال: «صوت صارخ في البرية»؟', answers: [{ text: 'إرميا', correct: false }, { text: 'حزقيال', correct: false }, { text: 'إشعياء', correct: true }, { text: 'دانيال', correct: false }] },
      { prompt: 'ماذا يعني اسم عمانوئيل؟', answers: [{ text: 'الله معنا', correct: true }, { text: 'الله يخلّص', correct: false }, { text: 'ابن داود', correct: false }, { text: 'نور العالم', correct: false }] },
      { prompt: 'من زارت العذراء بعد البشارة؟', answers: [{ text: 'حنة', correct: false }, { text: 'أليصابات', correct: true }, { text: 'مريم المجدلية', correct: false }, { text: 'سالومة', correct: false }] },
      { prompt: 'أين ظهر الملاك ليوسف وأمره أن يأخذ مريم؟', answers: [{ text: 'في الهيكل', correct: false }, { text: 'على الجبل', correct: false }, { text: 'في حلم', correct: true }, { text: 'عند البئر', correct: false }] },
      { prompt: 'من هو النبي الذي وُلد قبل المسيح بستة أشهر؟', answers: [{ text: 'إيليا', correct: false }, { text: 'يوحنا المعمدان', correct: true }, { text: 'إشعياء', correct: false }, { text: 'يونان', correct: false }] },
      { prompt: 'في أي مدينة كانت العذراء عند البشارة؟', answers: [{ text: 'بيت لحم', correct: false }, { text: 'أورشليم', correct: false }, { text: 'الناصرة', correct: true }, { text: 'أريحا', correct: false }] },
    ],
  },
  {
    id: 'christmas',
    title: 'عيد الميلاد',
    description: '8 أسئلة للميلاد والمجوس والهروب لمصر',
    blurbEn: 'Christmas — 8 Nativity questions',
    questions: [
      { prompt: 'أين وُلد السيد المسيح؟', answers: [{ text: 'الناصرة', correct: false }, { text: 'بيت لحم', correct: true }, { text: 'أورشليم', correct: false }, { text: 'كفرناحوم', correct: false }] },
      { prompt: 'في أي مكان وضعوه بعد الولادة؟', answers: [{ text: 'سرير', correct: false }, { text: 'مذود', correct: true }, { text: 'الهيكل', correct: false }, { text: 'سفينة', correct: false }] },
      { prompt: 'من هم الذين جاءوا من المشرق؟', answers: [{ text: 'الرعاة', correct: false }, { text: 'المجوس', correct: true }, { text: 'الكهنة', correct: false }, { text: 'الجند', correct: false }] },
      { prompt: 'بما أرشد المجوس؟', answers: [{ text: 'عمود سحاب', correct: false }, { text: 'صوت من السماء', correct: false }, { text: 'نجم', correct: true }, { text: 'حلم فرعون', correct: false }] },
      { prompt: 'ماذا قدم المجوس للطفل؟', answers: [{ text: 'خبز وسمك', correct: false }, { text: 'ذهب ولبان ومر', correct: true }, { text: 'زيت وعسل', correct: false }, { text: 'ثياب كهنوت', correct: false }] },
      { prompt: 'من أمر بقتل أطفال بيت لحم؟', answers: [{ text: 'بيلاطس', correct: false }, { text: 'قيصر', correct: false }, { text: 'هيرودس', correct: true }, { text: 'قيافا', correct: false }] },
      { prompt: 'إلى أين هربت العائلة المقدسة؟', answers: [{ text: 'بابل', correct: false }, { text: 'مصر', correct: true }, { text: 'روما', correct: false }, { text: 'نينوى', correct: false }] },
      { prompt: 'من أخبر الرعاة بالميلاد؟', answers: [{ text: 'الكهنة', correct: false }, { text: 'ملاك الرب', correct: true }, { text: 'المجوس', correct: false }, { text: 'يوحنا', correct: false }] },
    ],
  },
  {
    id: 'easter',
    title: 'القيامة',
    description: '8 أسئلة للقيامة والقبر الفارغ والصعود',
    blurbEn: 'Easter — 8 Resurrection questions',
    questions: [
      { prompt: 'في أي يوم قام المسيح من بين الأموات؟', answers: [{ text: 'الجمعة', correct: false }, { text: 'السبت', correct: false }, { text: 'الأحد', correct: true }, { text: 'الاثنين', correct: false }] },
      { prompt: 'من ذهبت إلى القبر باكرًا حسب الإنجيل؟', answers: [{ text: 'أليصابات', correct: false }, { text: 'مريم المجدلية', correct: true }, { text: 'حنة النبية', correct: false }, { text: 'المرأة السامرية', correct: false }] },
      { prompt: 'ماذا وجدوا في القبر؟', answers: [{ text: 'الجسد ملفوفًا', correct: false }, { text: 'القبر فارغًا', correct: true }, { text: 'الحراس نيامًا فقط', correct: false }, { text: 'كتاب الناموس', correct: false }] },
      { prompt: 'من شكّ حتى رأى أثر المسامير؟', answers: [{ text: 'بطرس', correct: false }, { text: 'يوحنا', correct: false }, { text: 'توما', correct: true }, { text: 'أندراوس', correct: false }] },
      { prompt: 'كم يومًا بين القيامة والصعود؟', answers: [{ text: '3', correct: false }, { text: '7', correct: false }, { text: '40', correct: true }, { text: '50', correct: false }] },
      { prompt: 'عيد العنصرة يأتي بعد القيامة بكم يومًا؟', answers: [{ text: '12', correct: false }, { text: '40', correct: false }, { text: '50', correct: true }, { text: '70', correct: false }] },
      { prompt: 'أين ظهر المسيح للتلاميذ والأبواب مغلقة؟', answers: [{ text: 'على الجبل', correct: false }, { text: 'في العلية', correct: true }, { text: 'عند البحر', correct: false }, { text: 'في الهيكل', correct: false }] },
      { prompt: 'من دحرج الحجر عن باب القبر في رواية الإنجيل؟', answers: [{ text: 'بطرس', correct: false }, { text: 'الجند', correct: false }, { text: 'ملاك الرب', correct: true }, { text: 'يوسف الرامي', correct: false }] },
    ],
  },
];
