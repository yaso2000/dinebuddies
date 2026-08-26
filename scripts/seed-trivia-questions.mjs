import dotenv from 'dotenv';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
dotenv.config();

initializeApp({
  credential: cert({
    projectId: 'dinebuddies',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: String(process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  }),
});
const db = getFirestore();

// [ar_q, en_q, [ar_opts], [en_opts], correctIndex, difficulty]
const DECK = [
  ['من أي دولة أصل طبق السوشي؟', 'Which country is sushi originally from?', ['اليابان', 'الصين', 'كوريا', 'تايلاند'], ['Japan', 'China', 'Korea', 'Thailand'], 0, 1],
  ['ما المكوّن الأساسي في الحُمّص؟', 'What is the main ingredient in hummus?', ['العدس', 'الحمص', 'الفول', 'الفاصوليا'], ['Lentils', 'Chickpeas', 'Fava beans', 'Kidney beans'], 1, 1],
  ['أي توابل تُعطي الكاري لونه الأصفر؟', 'Which spice gives curry its yellow color?', ['الكمون', 'الكزبرة', 'الكركم', 'الفلفل'], ['Cumin', 'Coriander', 'Turmeric', 'Pepper'], 2, 1],
  ['من أي دولة أصل البيتزا؟', 'Which country is pizza originally from?', ['إيطاليا', 'اليونان', 'فرنسا', 'إسبانيا'], ['Italy', 'Greece', 'France', 'Spain'], 0, 1],
  ['ما الحبّة المستخدمة في تحضير الريزوتو؟', 'Which grain is used to make risotto?', ['القمح', 'الأرز', 'الشعير', 'الذرة'], ['Wheat', 'Rice', 'Barley', 'Corn'], 1, 1],
  ['ما الفاكهة التي تُصنع منها الجواكامولي؟', 'Guacamole is made mainly from which fruit?', ['المانجو', 'الأفوكادو', 'الموز', 'الطماطم'], ['Mango', 'Avocado', 'Banana', 'Tomato'], 1, 1],
  ['أي نوع جبن يُستخدم عادة في التيراميسو؟', 'Which cheese is typically used in tiramisu?', ['شيدر', 'ماسكاربوني', 'فيتا', 'موزاريلا'], ['Cheddar', 'Mascarpone', 'Feta', 'Mozzarella'], 1, 2],
  ['من أي دولة أصل التاكو؟', 'Which country is the taco originally from?', ['المكسيك', 'إسبانيا', 'البيرو', 'البرازيل'], ['Mexico', 'Spain', 'Peru', 'Brazil'], 0, 1],
  ['ما البهار الأغلى في العالم بالوزن؟', 'Which spice is the most expensive by weight?', ['الزعفران', 'الهيل', 'الفانيلا', 'القرفة'], ['Saffron', 'Cardamom', 'Vanilla', 'Cinnamon'], 0, 2],
  ['ما أساس صلصة البيستو؟', 'What is the base of pesto sauce?', ['الطماطم', 'الريحان', 'الثوم', 'الفلفل'], ['Tomato', 'Basil', 'Garlic', 'Pepper'], 1, 1],
  ['من أي حبوب تُصنع القهوة؟', 'Coffee is made from the beans of which plant?', ['الكاكاو', 'البُن', 'الشعير', 'الصويا'], ['Cacao', 'Coffee', 'Barley', 'Soy'], 1, 1],
  ['ما الطبق الياباني: عجينة مقلية بالخضار والمأكولات البحرية؟', 'Which Japanese dish is battered, deep-fried veg/seafood?', ['رامن', 'تمبورا', 'سوشي', 'أودون'], ['Ramen', 'Tempura', 'Sushi', 'Udon'], 1, 2],
  ['ما اللحم التقليدي في البرغر الكلاسيكي؟', 'What is the traditional meat in a classic burger?', ['دجاج', 'لحم بقري', 'سمك', 'ديك رومي'], ['Chicken', 'Beef', 'Fish', 'Turkey'], 1, 1],
  ['من أي دولة يُنسب الكرواسون؟', 'The croissant is associated with which country?', ['فرنسا', 'النمسا', 'إيطاليا', 'ألمانيا'], ['France', 'Austria', 'Italy', 'Germany'], 0, 2],
  ['ما الخضار الأساسي في الكيمتشي الكوري؟', 'What vegetable is the base of Korean kimchi?', ['الخيار', 'الملفوف', 'الجزر', 'الفجل'], ['Cucumber', 'Cabbage', 'Carrot', 'Radish'], 1, 2],
  ['ما نوع المعكرونة الطويلة الرفيعة؟', 'Which is a long, thin pasta?', ['بيني', 'سباغيتي', 'فوسيلي', 'لازانيا'], ['Penne', 'Spaghetti', 'Fusilli', 'Lasagna'], 1, 1],
  ['ما المشروب المصنوع من أوراق مخمّرة؟', 'Which drink is made from fermented leaves?', ['القهوة', 'الشاي الأسود', 'الكاكاو', 'العصير'], ['Coffee', 'Black tea', 'Cocoa', 'Juice'], 1, 1],
  ['في أي منطقة يشيع الفلافل؟', 'Falafel is popular across which region?', ['الشرق الأوسط', 'اسكندنافيا', 'جنوب أمريكا', 'شرق آسيا'], ['Middle East', 'Scandinavia', 'South America', 'East Asia'], 0, 1],
  ['ما المكوّن الذي يجعل العجين ينتفخ؟', 'Which ingredient makes dough rise?', ['السكر', 'الخميرة', 'الملح', 'الزيت'], ['Sugar', 'Yeast', 'Salt', 'Oil'], 1, 1],
  ['ما الفاكهة المعروفة برائحتها القوية في آسيا؟', 'Which fruit is famous for its strong smell in Asia?', ['المانجو', 'الدوريان', 'الأناناس', 'البابايا'], ['Mango', 'Durian', 'Pineapple', 'Papaya'], 1, 2],
];

async function run() {
  let n = 0;
  for (let i = 0; i < DECK.length; i += 1) {
    const [ar, en, optsAr, optsEn, correct, diff] = DECK[i];
    const id = `ft_${String(i + 1).padStart(3, '0')}`;
    await db.collection('trivia_questions').doc(id).set({
      category: 'food', type: 'quiz', difficulty: diff || 1, correctIndex: correct,
      text: { ar, en }, options: { ar: optsAr, en: optsEn }, active: true,
    });
    n += 1;
  }
  console.log('seeded trivia questions:', n);
  process.exit(0);
}
run().catch((e) => { console.error(e); process.exit(1); });
