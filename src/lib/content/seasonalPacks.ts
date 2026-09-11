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
  {
    id: 'nayrouz',
    title: 'عيد النيروز',
    description: '30 سؤال عن النيروز والتقويم القبطي والأسرار والمجامع',
    blurbEn: 'Nayrouz — 30 Coptic New Year & faith questions',
    questions: [
      {
        prompt: 'كلمة «نيروز» في أصلها الفارسي تعني:',
        answers: [
          { text: 'عيد الشهداء', correct: false },
          { text: 'اليوم الجديد', correct: true },
          { text: 'بداية الحصاد', correct: false },
          { text: 'عيد القيامة', correct: false },
        ],
      },
      {
        prompt: 'تحتفل الكنيسة القبطية بعيد النيروز في:',
        answers: [
          { text: '29 مسرى', correct: false },
          { text: '1 بابه', correct: false },
          { text: '1 توت', correct: true },
          { text: '17 توت', correct: false },
        ],
      },
      {
        prompt: 'عيد النيروز هو رأس السنة:',
        answers: [
          { text: 'المصرية القديمة فقط', correct: false },
          { text: 'القبطية للشهداء', correct: true },
          { text: 'الميلادية', correct: false },
          { text: 'اليهودية', correct: false },
        ],
      },
      {
        prompt: 'لماذا يبدأ التقويم القبطي من عصر الإمبراطور دقلديانوس؟',
        answers: [
          { text: 'لأنه أعاد بناء الكنائس', correct: false },
          { text: 'لأنه أعلن المسيحية ديانة رسمية', correct: false },
          { text: 'لتذكار الشهداء الذين استشهدوا في عهده', correct: true },
          { text: 'لأنه وضع التقويم المصري', correct: false },
        ],
      },
      {
        prompt: 'السنة التي بدأ فيها عصر الشهداء هي:',
        answers: [
          { text: '33 م', correct: false },
          { text: '70 م', correct: false },
          { text: '284 م', correct: true },
          { text: '325 م', correct: false },
        ],
      },
      {
        prompt: 'الإمبراطور المرتبط ببداية «تقويم الشهداء» هو:',
        answers: [
          { text: 'قسطنطين', correct: false },
          { text: 'دقلديانوس', correct: true },
          { text: 'نيرون', correct: false },
          { text: 'ثيؤدسيوس', correct: false },
        ],
      },
      {
        prompt: 'ما العلاقة الأساسية بين عيد النيروز والشهداء؟',
        answers: [
          { text: 'لأن جميع الشهداء استشهدوا في يوم النيروز', correct: false },
          {
            text: 'لأن الكنيسة تذكارًا لشهادة الشهداء جعلت بداية السنة القبطية مرتبطة بعصرهم',
            correct: true,
          },
          { text: 'لأن النيروز هو عيد استشهاد مارمرقس', correct: false },
          { text: 'لأن الشهداء هم الذين وضعوا التقويم', correct: false },
        ],
      },
      {
        prompt: 'أي من الآتي هو أول شهر في السنة القبطية؟',
        answers: [
          { text: 'بابه', correct: false },
          { text: 'مسرى', correct: false },
          { text: 'توت', correct: true },
          { text: 'كيهك', correct: false },
        ],
      },
      {
        prompt: 'أي من الآتي هو ترتيب الشهور القبطية الصحيح؟',
        answers: [
          { text: 'توت – بابه – هاتور – كيهك', correct: true },
          { text: 'توت – هاتور – بابه – كيهك', correct: false },
          { text: 'بابه – توت – كيهك – هاتور', correct: false },
          { text: 'مسرى – توت – بابه – هاتور', correct: false },
        ],
      },
      {
        prompt: 'الشهر الصغير في التقويم القبطي يُسمى:',
        answers: [
          { text: 'النسيء', correct: true },
          { text: 'برمهات', correct: false },
          { text: 'أبيب', correct: false },
          { text: 'مسرى', correct: false },
        ],
      },
      {
        prompt: 'عدد أيام الشهر الصغير في السنة العادية هو:',
        answers: [
          { text: '3', correct: false },
          { text: '4', correct: false },
          { text: '5', correct: true },
          { text: '6', correct: false },
        ],
      },
      {
        prompt: 'في السنة الكبيسة يصبح عدد أيام الشهر الصغير:',
        answers: [
          { text: '4', correct: false },
          { text: '5', correct: false },
          { text: '6', correct: true },
          { text: '7', correct: false },
        ],
      },
      {
        prompt: 'أي نجم ارتبط بالتقويم المصري القديم الذي سار عليه التقويم القبطي؟',
        answers: [
          { text: 'الشعرى اليمانية «سبدت»', correct: true },
          { text: 'نجم القطب', correct: false },
          { text: 'سهيل', correct: false },
          { text: 'الجوزاء', correct: false },
        ],
      },
      {
        prompt: 'أي من الآتي يُعتبر من أبعاد الاحتفال بالنيروز بحسب السنكسار؟',
        answers: [
          { text: 'بدء حياة جديدة مرضية لله', correct: true },
          { text: 'الاحتفال بالانتصارات العسكرية', correct: false },
          { text: 'بداية موسم الصوم الكبير', correct: false },
          { text: 'الاحتفال بالزواج', correct: false },
        ],
      },
      {
        prompt: 'ما الآية التي يستخدمها السنكسار للتعبير عن فكرة التجديد في بداية السنة؟',
        answers: [
          { text: '«أنا هو القيامة والحياة»', correct: false },
          { text: '«إن كان أحد في المسيح فهو خليقة جديدة»', correct: true },
          { text: '«الرب راعيَّ فلا يعوزني شيء»', correct: false },
          { text: '«طوبى لصانعي السلام»', correct: false },
        ],
      },
      {
        prompt: 'إذا وقع عيد النيروز يوم أحد، ماذا يحدث لقراءات الآحاد؟',
        answers: [
          { text: 'تُلغى قراءات النيروز', correct: false },
          {
            text: 'تُقرأ قراءات النيروز وتُرحّل قراءات الآحاد الأربعة إلى الآحاد التالية من شهر توت',
            correct: true,
          },
          { text: 'تُقرأ قراءات الصليب', correct: false },
          { text: 'تُقرأ قراءات القيامة', correct: false },
        ],
      },
      {
        prompt: 'الفترة من 1 إلى 16 توت في طقس النيروز تكون:',
        answers: [
          { text: 'صيامية', correct: false },
          { text: 'حزينة', correct: false },
          { text: 'فرايحيّة', correct: true },
          { text: 'شعانينية', correct: false },
        ],
      },
      {
        prompt: 'أي من الآتي من ألحان/مردات النيروز المذكورة في طقسه؟',
        answers: [
          { text: 'الليلويا فاي بيبي', correct: true },
          { text: 'لحن إبؤورو فقط', correct: false },
          { text: 'لحن بيك إثرونوس فقط', correct: false },
          { text: 'لحن آريو هوش', correct: false },
        ],
      },
      {
        prompt: 'في أي يوم من شهر توت يأتي عيد الصليب المجيد؟',
        answers: [
          { text: '1 توت', correct: false },
          { text: '7 توت', correct: false },
          { text: '16 توت', correct: false },
          { text: '17 توت', correct: true },
        ],
      },
      {
        prompt: 'ما الفكرة الروحية التي تربط فرح النيروز بالشهداء؟',
        answers: [
          { text: 'أن الاستشهاد كان نهاية الإيمان', correct: false },
          {
            text: 'أن آلام الشهداء وشهادتهم للمسيح تحولت إلى سبب للفرح والمجد',
            correct: true,
          },
          { text: 'أن الشهداء كانوا يحتفلون بالأعياد فقط', correct: false },
          { text: 'أن الشهادة كانت مجرد حدث تاريخي', correct: false },
        ],
      },
      {
        prompt: 'أي مجمع مسكوني واجه بدعة أريوس بشكل أساسي؟',
        answers: [
          { text: 'مجمع أفسس', correct: false },
          { text: 'مجمع نيقية', correct: true },
          { text: 'مجمع القسطنطينية', correct: false },
          { text: 'مجمع أورشليم', correct: false },
        ],
      },
      {
        prompt: 'في أي سنة انعقد مجمع نيقية؟',
        answers: [
          { text: '284 م', correct: false },
          { text: '325 م', correct: true },
          { text: '381 م', correct: false },
          { text: '431 م', correct: false },
        ],
      },
      {
        prompt: 'من الشخصية التي ارتبط اسمها بالدفاع القوي عن إيمان الكنيسة في مجمع نيقية؟',
        answers: [
          { text: 'القديس أثناسيوس الرسولي', correct: true },
          { text: 'القديس يوحنا المعمدان', correct: false },
          { text: 'القديس موسى الأسود', correct: false },
          { text: 'القديس الأنبا أنطونيوس', correct: false },
        ],
      },
      {
        prompt: 'المجمع الذي واجه بدعة نسطور هو:',
        answers: [
          { text: 'نيقية', correct: false },
          { text: 'القسطنطينية', correct: false },
          { text: 'أفسس', correct: true },
          { text: 'خلقيدونية', correct: false },
        ],
      },
      {
        prompt: 'عدد أسرار الكنيسة المقدسة في الكنيسة القبطية الأرثوذكسية هو:',
        answers: [
          { text: '5', correct: false },
          { text: '6', correct: false },
          { text: '7', correct: true },
          { text: '8', correct: false },
        ],
      },
      {
        prompt: 'أي سر يُعتبر «باب الأسرار»؟',
        answers: [
          { text: 'التوبة والاعتراف', correct: false },
          { text: 'المعمودية', correct: true },
          { text: 'الميرون', correct: false },
          { text: 'الكهنوت', correct: false },
        ],
      },
      {
        prompt: 'أي مجموعة من الأسرار التالية لا تُعاد بحسب تعليم الكنيسة؟',
        answers: [
          { text: 'المعمودية والميرون والكهنوت', correct: true },
          { text: 'التوبة والتناول والزيجة', correct: false },
          { text: 'التناول ومسحة المرضى والزيجة', correct: false },
          { text: 'التوبة والاعتراف ومسحة المرضى', correct: false },
        ],
      },
      {
        prompt: 'ما السر الذي يرتبط بحلول الروح القدس وتثبيت المؤمن؟',
        answers: [
          { text: 'المعمودية', correct: false },
          { text: 'الميرون', correct: true },
          { text: 'التوبة', correct: false },
          { text: 'الزيجة', correct: false },
        ],
      },
      {
        prompt: 'مدة صوم يونان هي:',
        answers: [
          { text: 'يوم واحد', correct: false },
          { text: 'يومان', correct: false },
          { text: 'ثلاثة أيام', correct: true },
          { text: 'سبعة أيام', correct: false },
        ],
      },
      {
        prompt: 'لماذا يُسمّى عيد النيروز أيضًا «عيد الشهداء»؟',
        answers: [
          { text: 'لأن أول شهيد قبطي استشهد في يوم النيروز', correct: false },
          {
            text: 'لأن الكنيسة جعلت بداية تقويمها تذكارًا لشهداء عصر دقلديانوس',
            correct: true,
          },
          { text: 'لأن جميع الشهداء استشهدوا في شهر توت', correct: false },
          { text: 'لأن دقلديانوس كان أول شهيد في الكنيسة', correct: false },
        ],
      },
    ],
  },
];
