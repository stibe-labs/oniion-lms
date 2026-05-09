/**
 * Demo Exam Question Bank — Grade-Aware
 *
 * Topics and MCQ questions organized by grade band × subject.
 * Grade bands: primary (1-5), middle (6-7), secondary (8-10), senior (11-12).
 * 10 questions per combo, 1 mark each, 30 seconds per question.
 */

export interface DemoExamQuestion {
  question_text: string;
  options: string[];
  correct_answer: number; // 0-based index
  marks: number;
  topic: string;
}

type GradeBand = 'primary' | 'middle' | 'secondary' | 'senior';

function gradeBand(grade: string): GradeBand {
  const g = parseInt(grade, 10);
  if (g <= 5) return 'primary';
  if (g <= 7) return 'middle';
  if (g <= 10) return 'secondary';
  return 'senior';
}

// ═══════════════════════════════════════════════════════════════
// TOPICS per grade band × subject (shown in the demo form)
// ═══════════════════════════════════════════════════════════════

const TOPICS: Record<string, Record<GradeBand, string[]>> = {
  'Mathematics': {
    primary:   ['Numbers & Counting', 'Addition & Subtraction', 'Multiplication & Division', 'Shapes & Patterns', 'Measurement & Time'],
    middle:    ['Fractions & Decimals', 'Integers', 'Basic Algebra', 'Ratio & Proportion', 'Geometry Basics', 'Data Handling'],
    secondary: ['Algebra', 'Trigonometry', 'Geometry', 'Statistics & Probability', 'Coordinate Geometry', 'Quadratic Equations'],
    senior:    ['Calculus', 'Matrices & Determinants', 'Vectors', 'Complex Numbers', 'Probability & Statistics', 'Conic Sections'],
  },
  'Physics': {
    primary:   ['Light & Shadow', 'Push & Pull (Forces)', 'Sound', 'Magnets', 'Simple Machines'],
    middle:    ['Motion & Speed', 'Heat & Temperature', 'Light & Reflection', 'Electricity Basics', 'Force & Pressure'],
    secondary: ['Laws of Motion', 'Gravitation', 'Optics', 'Electricity & Magnetism', 'Wave Motion', 'Thermodynamics'],
    senior:    ['Electrostatics', 'Current Electricity', 'Electromagnetic Induction', 'Modern Physics', 'Optics — Wave Theory', 'Semiconductor Physics'],
  },
  'Chemistry': {
    primary:   ['Materials Around Us', 'Solids, Liquids & Gases', 'Water', 'Air', 'Food & Nutrition'],
    middle:    ['Elements & Compounds', 'Acids, Bases & Salts', 'Physical & Chemical Changes', 'Metals & Non-metals', 'Fiber to Fabric'],
    secondary: ['Periodic Table', 'Chemical Bonding', 'Acids, Bases & Salts', 'Carbon & Its Compounds', 'Chemical Reactions', 'Metals & Non-metals'],
    senior:    ['Organic Chemistry', 'Electrochemistry', 'Chemical Kinetics', 'Thermodynamics', 'Coordination Chemistry', 'P-Block Elements'],
  },
  'Biology': {
    primary:   ['Plants & Animals', 'Human Body Parts', 'Food & Health', 'Living & Non-living', 'Our Environment'],
    middle:    ['Cell Structure', 'Nutrition in Plants & Animals', 'Respiration & Excretion', 'Reproduction in Plants', 'Weather & Climate'],
    secondary: ['Cell Biology', 'Genetics & Heredity', 'Human Physiology', 'Ecology & Environment', 'Life Processes', 'Control & Coordination'],
    senior:    ['Molecular Biology', 'Genetics & Evolution', 'Biotechnology', 'Human Reproduction', 'Ecology & Biodiversity', 'Plant Physiology'],
  },
  'English': {
    primary:   ['Alphabet & Phonics', 'Simple Sentences', 'Nouns & Verbs', 'Reading Comprehension', 'Vocabulary Building'],
    middle:    ['Grammar — Tenses', 'Parts of Speech', 'Comprehension Passages', 'Essay Writing', 'Vocabulary & Idioms'],
    secondary: ['Advanced Grammar', 'Literature — Prose & Poetry', 'Comprehension & Summary', 'Essay & Letter Writing', 'Vocabulary & Usage'],
    senior:    ['Advanced Comprehension', 'Literature Analysis', 'Creative Writing', 'Grammar & Transformation', 'Report & Article Writing'],
  },
  'Social Science': {
    primary:   ['My Family & Neighbourhood', 'Our Helpers', 'Festivals of India', 'Maps & Directions', 'Our Country'],
    middle:    ['History — Medieval India', 'Geography — Our Environment', 'Civics — Government', 'Economics — Resources', 'Map Skills'],
    secondary: ['History — Modern India', 'Geography — Climate & Resources', 'Civics — Democracy & Constitution', 'Economics — Development', 'Globalization'],
    senior:    ['Indian History — National Movement', 'World Geography', 'Political Science', 'Indian Economy', 'International Relations'],
  },
  'Malayalam': {
    primary:   ['അക്ഷരമാല (Alphabet)', 'ലളിതവാക്യം (Simple Sentences)', 'കഥ വായന (Story Reading)', 'പദസമ്പത്ത് (Vocabulary)', 'എഴുത്ത് (Writing)'],
    middle:    ['വ്യാകരണം — ലിംഗം, വചനം', 'ഗദ്യം (Prose)', 'പദ്യം (Poetry)', 'ഉപന്യാസം (Essay)', 'പദപ്രയോഗം (Usage)'],
    secondary: ['വ്യാകരണം (Grammar)', 'ഗദ്യസാഹിത്യം (Prose Literature)', 'പദ്യസാഹിത്യം (Poetry)', 'ഉപന്യാസം (Essay)', 'കത്തെഴുത്ത് (Letter Writing)'],
    senior:    ['സാഹിത്യ വിമർശനം (Literary Criticism)', 'ഗദ്യം & പദ്യം (Prose & Poetry)', 'വ്യാകരണം — അലങ്കാരം (Rhetoric)', 'ലേഖനം (Article Writing)'],
  },
  'Arabic': {
    primary:   ['Arabic Alphabet (الحروف)', 'Basic Words (كلمات)', 'Greetings (تحيات)', 'Numbers (أرقام)', 'Colors (ألوان)'],
    middle:    ['Grammar — Nouns & Verbs (نحو)', 'Reading Comprehension', 'Writing Skills', 'Vocabulary', 'Conversation (محادثة)'],
    secondary: ['Grammar (نحو و صرف)', 'Reading Comprehension', 'Essay Writing', 'Vocabulary & Idioms', 'Translation Skills'],
    senior:    ['Advanced Grammar (نحو متقدم)', 'Literary Texts', 'Advanced Writing', 'Translation & Composition', 'Arabic Literature'],
  },
};

// ═══════════════════════════════════════════════════════════════
// QUESTIONS per grade band × subject
// ═══════════════════════════════════════════════════════════════

const Q: Record<string, Record<GradeBand, DemoExamQuestion[]>> = {
  'Mathematics': {
    primary: [
      { question_text: 'What comes after 49?', options: ['48', '50', '51', '59'], correct_answer: 1, marks: 1, topic: 'Numbers & Counting' },
      { question_text: '12 + 8 = ?', options: ['18', '19', '20', '21'], correct_answer: 2, marks: 1, topic: 'Addition & Subtraction' },
      { question_text: '25 − 9 = ?', options: ['14', '15', '16', '17'], correct_answer: 2, marks: 1, topic: 'Addition & Subtraction' },
      { question_text: '6 × 4 = ?', options: ['20', '22', '24', '26'], correct_answer: 2, marks: 1, topic: 'Multiplication & Division' },
      { question_text: 'How many sides does a triangle have?', options: ['2', '3', '4', '5'], correct_answer: 1, marks: 1, topic: 'Shapes & Patterns' },
      { question_text: '36 ÷ 6 = ?', options: ['5', '6', '7', '8'], correct_answer: 1, marks: 1, topic: 'Multiplication & Division' },
      { question_text: 'Which shape has 4 equal sides?', options: ['Rectangle', 'Triangle', 'Square', 'Circle'], correct_answer: 2, marks: 1, topic: 'Shapes & Patterns' },
      { question_text: 'How many minutes in one hour?', options: ['30', '50', '60', '100'], correct_answer: 2, marks: 1, topic: 'Measurement & Time' },
      { question_text: 'What is half of 20?', options: ['5', '8', '10', '15'], correct_answer: 2, marks: 1, topic: 'Numbers & Counting' },
      { question_text: '1 meter = how many centimeters?', options: ['10', '50', '100', '1000'], correct_answer: 2, marks: 1, topic: 'Measurement & Time' },
    ],
    middle: [
      { question_text: 'What is ¾ as a decimal?', options: ['0.25', '0.5', '0.75', '0.34'], correct_answer: 2, marks: 1, topic: 'Fractions & Decimals' },
      { question_text: '(−3) + (−5) = ?', options: ['2', '−2', '8', '−8'], correct_answer: 3, marks: 1, topic: 'Integers' },
      { question_text: 'If 3x = 15, what is x?', options: ['3', '4', '5', '6'], correct_answer: 2, marks: 1, topic: 'Basic Algebra' },
      { question_text: '12 : 16 in simplest form is:', options: ['3:4', '4:3', '6:8', '2:3'], correct_answer: 0, marks: 1, topic: 'Ratio & Proportion' },
      { question_text: 'How many degrees in a straight angle?', options: ['90°', '180°', '270°', '360°'], correct_answer: 1, marks: 1, topic: 'Geometry Basics' },
      { question_text: 'The mean of 4, 6, 8, 10 is:', options: ['6', '7', '8', '9'], correct_answer: 1, marks: 1, topic: 'Data Handling' },
      { question_text: '0.5 × 0.2 = ?', options: ['0.01', '0.1', '0.7', '1.0'], correct_answer: 1, marks: 1, topic: 'Fractions & Decimals' },
      { question_text: 'What is 20% of 150?', options: ['15', '20', '25', '30'], correct_answer: 3, marks: 1, topic: 'Ratio & Proportion' },
      { question_text: 'A triangle with all sides equal is called:', options: ['Isosceles', 'Scalene', 'Equilateral', 'Right-angled'], correct_answer: 2, marks: 1, topic: 'Geometry Basics' },
      { question_text: '(−4) × (−3) = ?', options: ['−12', '12', '−7', '7'], correct_answer: 1, marks: 1, topic: 'Integers' },
    ],
    secondary: [
      { question_text: 'If x + 5 = 12, what is x?', options: ['5', '6', '7', '8'], correct_answer: 2, marks: 1, topic: 'Algebra' },
      { question_text: 'What is sin(90°)?', options: ['0', '0.5', '1', '√2/2'], correct_answer: 2, marks: 1, topic: 'Trigonometry' },
      { question_text: 'The sum of angles in a triangle is:', options: ['90°', '180°', '270°', '360°'], correct_answer: 1, marks: 1, topic: 'Geometry' },
      { question_text: 'The probability of getting heads in a fair coin toss is:', options: ['0', '1/4', '1/2', '1'], correct_answer: 2, marks: 1, topic: 'Statistics & Probability' },
      { question_text: 'Distance between points (0,0) and (3,4) is:', options: ['3', '4', '5', '7'], correct_answer: 2, marks: 1, topic: 'Coordinate Geometry' },
      { question_text: 'Solve: x² − 9 = 0', options: ['x = 3', 'x = ±3', 'x = 9', 'x = −3'], correct_answer: 1, marks: 1, topic: 'Quadratic Equations' },
      { question_text: 'Simplify: 2³ × 2²', options: ['2⁵', '2⁶', '4⁵', '2¹'], correct_answer: 0, marks: 1, topic: 'Algebra' },
      { question_text: 'Area of a circle with radius r is:', options: ['2πr', 'πr²', 'πd', '2πr²'], correct_answer: 1, marks: 1, topic: 'Geometry' },
      { question_text: 'tan(45°) = ?', options: ['0', '1', '√3', '1/√3'], correct_answer: 1, marks: 1, topic: 'Trigonometry' },
      { question_text: 'Slope of a horizontal line is:', options: ['1', '−1', '0', 'Undefined'], correct_answer: 2, marks: 1, topic: 'Coordinate Geometry' },
    ],
    senior: [
      { question_text: 'What is the derivative of x²?', options: ['x', '2x', '2x²', 'x/2'], correct_answer: 1, marks: 1, topic: 'Calculus' },
      { question_text: '∫ 2x dx = ?', options: ['x²', 'x² + C', '2x² + C', 'x + C'], correct_answer: 1, marks: 1, topic: 'Calculus' },
      { question_text: 'If A is a 2×2 identity matrix, det(A) = ?', options: ['0', '1', '2', '−1'], correct_answer: 1, marks: 1, topic: 'Matrices & Determinants' },
      { question_text: 'The magnitude of vector (3, 4) is:', options: ['5', '7', '12', '25'], correct_answer: 0, marks: 1, topic: 'Vectors' },
      { question_text: 'i² = ? (where i = √−1)', options: ['1', '−1', 'i', '−i'], correct_answer: 1, marks: 1, topic: 'Complex Numbers' },
      { question_text: 'nCr is defined as:', options: ['n!/(r!(n-r)!)', 'n!/r!', 'n!/(n-r)!', 'r!/n!'], correct_answer: 0, marks: 1, topic: 'Probability & Statistics' },
      { question_text: 'The eccentricity of a circle is:', options: ['0', '1', '0.5', 'Undefined'], correct_answer: 0, marks: 1, topic: 'Conic Sections' },
      { question_text: 'd/dx (sin x) = ?', options: ['−cos x', 'cos x', 'sin x', '−sin x'], correct_answer: 1, marks: 1, topic: 'Calculus' },
      { question_text: 'The dot product of perpendicular vectors is:', options: ['1', '−1', '0', 'Undefined'], correct_answer: 2, marks: 1, topic: 'Vectors' },
      { question_text: 'lim(x→0) sin(x)/x = ?', options: ['0', '1', '∞', 'Does not exist'], correct_answer: 1, marks: 1, topic: 'Calculus' },
    ],
  },

  'Physics': {
    primary: [
      { question_text: 'What do we need to see things?', options: ['Sound', 'Light', 'Air', 'Water'], correct_answer: 1, marks: 1, topic: 'Light & Shadow' },
      { question_text: 'Pushing a door is an example of:', options: ['Force', 'Sound', 'Light', 'Heat'], correct_answer: 0, marks: 1, topic: 'Push & Pull (Forces)' },
      { question_text: 'Sound is produced by:', options: ['Light', 'Vibration', 'Heat', 'Color'], correct_answer: 1, marks: 1, topic: 'Sound' },
      { question_text: 'A magnet attracts:', options: ['Wood', 'Plastic', 'Iron', 'Rubber'], correct_answer: 2, marks: 1, topic: 'Magnets' },
      { question_text: 'A see-saw is a type of:', options: ['Magnet', 'Simple machine', 'Sound device', 'Light source'], correct_answer: 1, marks: 1, topic: 'Simple Machines' },
      { question_text: 'The shadow of an object is always:', options: ['Colored', 'Dark', 'Bright', 'Moving'], correct_answer: 1, marks: 1, topic: 'Light & Shadow' },
      { question_text: 'Which of these produces sound?', options: ['Book', 'Bell', 'Eraser', 'Chalk'], correct_answer: 1, marks: 1, topic: 'Sound' },
      { question_text: 'A magnet has how many poles?', options: ['1', '2', '3', '4'], correct_answer: 1, marks: 1, topic: 'Magnets' },
      { question_text: 'We use a lever to:', options: ['See far', 'Lift heavy things', 'Hear better', 'Keep warm'], correct_answer: 1, marks: 1, topic: 'Simple Machines' },
      { question_text: 'Pulling a toy car uses:', options: ['Sound', 'Light', 'Force', 'Electricity'], correct_answer: 2, marks: 1, topic: 'Push & Pull (Forces)' },
    ],
    middle: [
      { question_text: 'Speed is measured in:', options: ['kg', 'm/s', 'litres', '°C'], correct_answer: 1, marks: 1, topic: 'Motion & Speed' },
      { question_text: 'Heat flows from a hotter body to a:', options: ['Hotter body', 'Cooler body', 'Same temperature', 'None'], correct_answer: 1, marks: 1, topic: 'Heat & Temperature' },
      { question_text: 'The image in a plane mirror is:', options: ['Inverted', 'Upright & laterally inverted', 'Smaller', 'Bigger'], correct_answer: 1, marks: 1, topic: 'Light & Reflection' },
      { question_text: 'An electric circuit needs a:', options: ['Magnet', 'Battery', 'Thermometer', 'Ruler'], correct_answer: 1, marks: 1, topic: 'Electricity Basics' },
      { question_text: 'Pressure = Force ÷ ?', options: ['Mass', 'Area', 'Volume', 'Speed'], correct_answer: 1, marks: 1, topic: 'Force & Pressure' },
      { question_text: 'When an object is at rest, its speed is:', options: ['1', '0', '10', 'Undefined'], correct_answer: 1, marks: 1, topic: 'Motion & Speed' },
      { question_text: 'The S.I. unit of temperature is:', options: ['°C', '°F', 'Kelvin', 'Joule'], correct_answer: 2, marks: 1, topic: 'Heat & Temperature' },
      { question_text: 'Light travels in:', options: ['Curved lines', 'Zigzag', 'Straight lines', 'Circles'], correct_answer: 2, marks: 1, topic: 'Light & Reflection' },
      { question_text: 'A fuse protects a circuit from:', options: ['Water', 'Overloading', 'Cold', 'Sound'], correct_answer: 1, marks: 1, topic: 'Electricity Basics' },
      { question_text: 'Atmospheric pressure is caused by:', options: ['Sun', 'Weight of air', 'Wind', 'Gravity alone'], correct_answer: 1, marks: 1, topic: 'Force & Pressure' },
    ],
    secondary: [
      { question_text: 'What is the SI unit of force?', options: ['Joule', 'Newton', 'Watt', 'Pascal'], correct_answer: 1, marks: 1, topic: 'Laws of Motion' },
      { question_text: 'Acceleration due to gravity on Earth is approximately:', options: ['5.8 m/s²', '9.8 m/s²', '15 m/s²', '20 m/s²'], correct_answer: 1, marks: 1, topic: 'Gravitation' },
      { question_text: 'The speed of light in vacuum is:', options: ['3 × 10⁶ m/s', '3 × 10⁸ m/s', '3 × 10¹⁰ m/s', '3 × 10⁴ m/s'], correct_answer: 1, marks: 1, topic: 'Optics' },
      { question_text: 'Ohm\'s law states V = ?', options: ['IR', 'I/R', 'R/I', 'I²R'], correct_answer: 0, marks: 1, topic: 'Electricity & Magnetism' },
      { question_text: 'Which quantity is measured in Hertz?', options: ['Wavelength', 'Amplitude', 'Frequency', 'Speed'], correct_answer: 2, marks: 1, topic: 'Wave Motion' },
      { question_text: 'Heat flows from hot to cold body — this is the:', options: ['First law', 'Second law', 'Third law', 'Zeroth law'], correct_answer: 1, marks: 1, topic: 'Thermodynamics' },
      { question_text: 'Newton\'s 3rd law: every action has an equal and opposite:', options: ['Force', 'Reaction', 'Motion', 'Acceleration'], correct_answer: 1, marks: 1, topic: 'Laws of Motion' },
      { question_text: 'A convex lens is also called:', options: ['Diverging lens', 'Converging lens', 'Plane lens', 'Concave lens'], correct_answer: 1, marks: 1, topic: 'Optics' },
      { question_text: 'Formula for kinetic energy:', options: ['mgh', '½mv²', 'Fd', 'mv'], correct_answer: 1, marks: 1, topic: 'Laws of Motion' },
      { question_text: 'Which particle carries a negative charge?', options: ['Proton', 'Neutron', 'Electron', 'Photon'], correct_answer: 2, marks: 1, topic: 'Electricity & Magnetism' },
    ],
    senior: [
      { question_text: 'Coulomb\'s law force is proportional to:', options: ['1/r', '1/r²', 'r', 'r²'], correct_answer: 1, marks: 1, topic: 'Electrostatics' },
      { question_text: 'The SI unit of electric current is:', options: ['Volt', 'Ampere', 'Ohm', 'Watt'], correct_answer: 1, marks: 1, topic: 'Current Electricity' },
      { question_text: 'Faraday\'s law relates to:', options: ['Electrostatics', 'Magnetism', 'Electromagnetic induction', 'Optics'], correct_answer: 2, marks: 1, topic: 'Electromagnetic Induction' },
      { question_text: 'The photoelectric effect was explained by:', options: ['Newton', 'Faraday', 'Einstein', 'Bohr'], correct_answer: 2, marks: 1, topic: 'Modern Physics' },
      { question_text: 'In Young\'s double slit experiment, we observe:', options: ['Diffraction only', 'Interference pattern', 'Polarization', 'Refraction'], correct_answer: 1, marks: 1, topic: 'Optics — Wave Theory' },
      { question_text: 'In a p-n junction, the depletion region contains:', options: ['Free electrons', 'Holes', 'No charge carriers', 'Current'], correct_answer: 2, marks: 1, topic: 'Semiconductor Physics' },
      { question_text: 'Electric field inside a conductor is:', options: ['Maximum', 'Constant', 'Zero', 'Infinite'], correct_answer: 2, marks: 1, topic: 'Electrostatics' },
      { question_text: 'The unit of magnetic flux is:', options: ['Tesla', 'Weber', 'Henry', 'Gauss'], correct_answer: 1, marks: 1, topic: 'Electromagnetic Induction' },
      { question_text: 'de Broglie wavelength is associated with:', options: ['Light only', 'Matter particles', 'Sound', 'Heat'], correct_answer: 1, marks: 1, topic: 'Modern Physics' },
      { question_text: 'Power dissipated in a resistor: P = ?', options: ['V²/R', 'VR', 'V/R', 'IR²'], correct_answer: 0, marks: 1, topic: 'Current Electricity' },
    ],
  },
  'Chemistry': {
    primary: [
      { question_text: 'Water is a:', options: ['Solid', 'Liquid', 'Gas', 'Plasma'], correct_answer: 1, marks: 1, topic: 'Solids, Liquids & Gases' },
      { question_text: 'Which of these is a solid?', options: ['Milk', 'Air', 'Stone', 'Juice'], correct_answer: 2, marks: 1, topic: 'Materials Around Us' },
      { question_text: 'We breathe in:', options: ['Carbon dioxide', 'Nitrogen', 'Oxygen', 'Hydrogen'], correct_answer: 2, marks: 1, topic: 'Air' },
      { question_text: 'Which is the purest form of water?', options: ['Tap water', 'Rain water', 'Sea water', 'River water'], correct_answer: 1, marks: 1, topic: 'Water' },
      { question_text: 'Which food gives us energy?', options: ['Rice', 'Water', 'Salt', 'Vinegar'], correct_answer: 0, marks: 1, topic: 'Food & Nutrition' },
      { question_text: 'Ice is a form of:', options: ['Liquid water', 'Solid water', 'Gas', 'Plastic'], correct_answer: 1, marks: 1, topic: 'Solids, Liquids & Gases' },
      { question_text: 'Which material is transparent?', options: ['Wood', 'Stone', 'Glass', 'Cardboard'], correct_answer: 2, marks: 1, topic: 'Materials Around Us' },
      { question_text: 'Air is a:', options: ['Solid', 'Liquid', 'Mixture of gases', 'Pure gas'], correct_answer: 2, marks: 1, topic: 'Air' },
      { question_text: 'Which vitamin do we get from sunlight?', options: ['A', 'B', 'C', 'D'], correct_answer: 3, marks: 1, topic: 'Food & Nutrition' },
      { question_text: 'Steam is water in what form?', options: ['Solid', 'Liquid', 'Gas', 'Powder'], correct_answer: 2, marks: 1, topic: 'Water' },
    ],
    middle: [
      { question_text: 'The smallest unit of an element is:', options: ['Molecule', 'Atom', 'Cell', 'Electron'], correct_answer: 1, marks: 1, topic: 'Elements & Compounds' },
      { question_text: 'Lemon juice is:', options: ['Acidic', 'Basic', 'Neutral', 'Salty'], correct_answer: 0, marks: 1, topic: 'Acids, Bases & Salts' },
      { question_text: 'Burning of paper is a:', options: ['Physical change', 'Chemical change', 'No change', 'Reversible change'], correct_answer: 1, marks: 1, topic: 'Physical & Chemical Changes' },
      { question_text: 'Iron is a:', options: ['Non-metal', 'Metal', 'Metalloid', 'Gas'], correct_answer: 1, marks: 1, topic: 'Metals & Non-metals' },
      { question_text: 'Silk is obtained from:', options: ['Plants', 'Silkworms', 'Sheep', 'Cotton plant'], correct_answer: 1, marks: 1, topic: 'Fiber to Fabric' },
      { question_text: 'NaCl is the formula for:', options: ['Sugar', 'Baking soda', 'Salt', 'Vinegar'], correct_answer: 2, marks: 1, topic: 'Elements & Compounds' },
      { question_text: 'Soap is:', options: ['Acidic', 'Basic', 'Neutral', 'none'], correct_answer: 1, marks: 1, topic: 'Acids, Bases & Salts' },
      { question_text: 'Melting of ice is a:', options: ['Chemical change', 'Physical change', 'Both', 'Neither'], correct_answer: 1, marks: 1, topic: 'Physical & Chemical Changes' },
      { question_text: 'Which metal is liquid at room temperature?', options: ['Iron', 'Gold', 'Mercury', 'Copper'], correct_answer: 2, marks: 1, topic: 'Metals & Non-metals' },
      { question_text: 'Cotton comes from:', options: ['Animals', 'Plants', 'Rocks', 'Water'], correct_answer: 1, marks: 1, topic: 'Fiber to Fabric' },
    ],
    secondary: [
      { question_text: 'What is the chemical symbol for gold?', options: ['Ag', 'Au', 'Go', 'Gd'], correct_answer: 1, marks: 1, topic: 'Periodic Table' },
      { question_text: 'What type of bond forms between Na and Cl?', options: ['Covalent', 'Ionic', 'Metallic', 'Hydrogen'], correct_answer: 1, marks: 1, topic: 'Chemical Bonding' },
      { question_text: 'pH of a neutral solution is:', options: ['0', '7', '14', '1'], correct_answer: 1, marks: 1, topic: 'Acids, Bases & Salts' },
      { question_text: 'CH₄ is called:', options: ['Ethane', 'Methane', 'Propane', 'Butane'], correct_answer: 1, marks: 1, topic: 'Carbon & Its Compounds' },
      { question_text: 'Rusting of iron is a:', options: ['Physical change', 'Chemical change', 'Nuclear change', 'No change'], correct_answer: 1, marks: 1, topic: 'Chemical Reactions' },
      { question_text: 'How many elements are in the periodic table?', options: ['100', '108', '118', '120'], correct_answer: 2, marks: 1, topic: 'Periodic Table' },
      { question_text: 'Valency of carbon is:', options: ['2', '3', '4', '5'], correct_answer: 2, marks: 1, topic: 'Chemical Bonding' },
      { question_text: 'Vinegar contains:', options: ['Citric acid', 'Acetic acid', 'Sulfuric acid', 'HCl'], correct_answer: 1, marks: 1, topic: 'Acids, Bases & Salts' },
      { question_text: 'Gaining electrons is called:', options: ['Oxidation', 'Reduction', 'Sublimation', 'Condensation'], correct_answer: 1, marks: 1, topic: 'Chemical Reactions' },
      { question_text: 'Copper is used in wires because it is:', options: ['Magnetic', 'A good conductor', 'Very light', 'Transparent'], correct_answer: 1, marks: 1, topic: 'Metals & Non-metals' },
    ],
    senior: [
      { question_text: 'Benzene has how many carbon atoms?', options: ['4', '5', '6', '8'], correct_answer: 2, marks: 1, topic: 'Organic Chemistry' },
      { question_text: 'In electrolysis, cations move to the:', options: ['Anode', 'Cathode', 'Salt bridge', 'Wire'], correct_answer: 1, marks: 1, topic: 'Electrochemistry' },
      { question_text: 'Rate of reaction depends on:', options: ['Color', 'Concentration', 'Shape', 'Name'], correct_answer: 1, marks: 1, topic: 'Chemical Kinetics' },
      { question_text: 'An exothermic reaction:', options: ['Absorbs heat', 'Releases heat', 'No heat change', 'Absorbs light'], correct_answer: 1, marks: 1, topic: 'Thermodynamics' },
      { question_text: 'Coordination number in [Cu(NH₃)₄]²⁺ is:', options: ['2', '4', '6', '8'], correct_answer: 1, marks: 1, topic: 'Coordination Chemistry' },
      { question_text: 'Which is a noble gas?', options: ['Nitrogen', 'Oxygen', 'Neon', 'Chlorine'], correct_answer: 2, marks: 1, topic: 'P-Block Elements' },
      { question_text: 'IUPAC name of CH₃CHO is:', options: ['Methanol', 'Ethanal', 'Ethanol', 'Methanal'], correct_answer: 1, marks: 1, topic: 'Organic Chemistry' },
      { question_text: 'Nernst equation relates to:', options: ['Kinetics', 'Electrode potential', 'Thermodynamics', 'Nuclear'], correct_answer: 1, marks: 1, topic: 'Electrochemistry' },
      { question_text: 'A catalyst:', options: ['Is consumed', 'Changes equilibrium', 'Speeds up reaction', 'Adds heat'], correct_answer: 2, marks: 1, topic: 'Chemical Kinetics' },
      { question_text: 'Enthalpy change (ΔH) is negative for:', options: ['Endothermic', 'Exothermic', 'Both', 'Neither'], correct_answer: 1, marks: 1, topic: 'Thermodynamics' },
    ],
  },
  'Biology': {
    primary: [
      { question_text: 'Which part of a plant makes food?', options: ['Root', 'Stem', 'Leaf', 'Flower'], correct_answer: 2, marks: 1, topic: 'Plants & Animals' },
      { question_text: 'We use our eyes to:', options: ['Hear', 'See', 'Smell', 'Touch'], correct_answer: 1, marks: 1, topic: 'Human Body Parts' },
      { question_text: 'Milk gives us:', options: ['Calcium', 'Iron only', 'Nothing', 'Salt'], correct_answer: 0, marks: 1, topic: 'Food & Health' },
      { question_text: 'Which is a living thing?', options: ['Chair', 'Dog', 'Ball', 'Stone'], correct_answer: 1, marks: 1, topic: 'Living & Non-living' },
      { question_text: 'Trees give us:', options: ['Plastic', 'Oxygen', 'Salt', 'Metal'], correct_answer: 1, marks: 1, topic: 'Our Environment' },
      { question_text: 'A baby cat is called a:', options: ['Puppy', 'Kitten', 'Calf', 'Cub'], correct_answer: 1, marks: 1, topic: 'Plants & Animals' },
      { question_text: 'How many legs does an insect have?', options: ['4', '6', '8', '10'], correct_answer: 1, marks: 1, topic: 'Plants & Animals' },
      { question_text: 'Which organ pumps blood?', options: ['Brain', 'Lungs', 'Heart', 'Stomach'], correct_answer: 2, marks: 1, topic: 'Human Body Parts' },
      { question_text: 'Carrots are good for our:', options: ['Ears', 'Eyes', 'Teeth', 'Hair'], correct_answer: 1, marks: 1, topic: 'Food & Health' },
      { question_text: 'We should not throw trash in:', options: ['Dustbin', 'Rivers', 'Garbage bag', 'Recycle bin'], correct_answer: 1, marks: 1, topic: 'Our Environment' },
    ],
    middle: [
      { question_text: 'The basic unit of life is:', options: ['Atom', 'Molecule', 'Cell', 'Tissue'], correct_answer: 2, marks: 1, topic: 'Cell Structure' },
      { question_text: 'Plants make food by:', options: ['Respiration', 'Photosynthesis', 'Digestion', 'Excretion'], correct_answer: 1, marks: 1, topic: 'Nutrition in Plants & Animals' },
      { question_text: 'We inhale oxygen and exhale:', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Hydrogen'], correct_answer: 2, marks: 1, topic: 'Respiration & Excretion' },
      { question_text: 'Seeds grow into new:', options: ['Animals', 'Plants', 'Rocks', 'Water'], correct_answer: 1, marks: 1, topic: 'Reproduction in Plants' },
      { question_text: 'Clouds are formed by:', options: ['Dust', 'Evaporation of water', 'Smoke', 'Wind alone'], correct_answer: 1, marks: 1, topic: 'Weather & Climate' },
      { question_text: 'The nucleus controls the:', options: ['Cell wall', 'Cell activities', 'Plant color', 'nothing'], correct_answer: 1, marks: 1, topic: 'Cell Structure' },
      { question_text: 'Stomata are found on:', options: ['Roots', 'Leaves', 'Flowers', 'Fruits'], correct_answer: 1, marks: 1, topic: 'Nutrition in Plants & Animals' },
      { question_text: 'Kidneys are organs of:', options: ['Digestion', 'Respiration', 'Excretion', 'Circulation'], correct_answer: 2, marks: 1, topic: 'Respiration & Excretion' },
      { question_text: 'Pollination is helped by:', options: ['Wind & insects', 'Rocks', 'Metal', 'Sand'], correct_answer: 0, marks: 1, topic: 'Reproduction in Plants' },
      { question_text: 'A monsoon brings:', options: ['Snow', 'Rainfall', 'Earthquake', 'Drought'], correct_answer: 1, marks: 1, topic: 'Weather & Climate' },
    ],
    secondary: [
      { question_text: 'Powerhouse of the cell is:', options: ['Nucleus', 'Ribosome', 'Mitochondria', 'Golgi body'], correct_answer: 2, marks: 1, topic: 'Cell Biology' },
      { question_text: 'DNA stands for:', options: ['Deoxyribonucleic Acid', 'Deoxyribo Nucleic Atom', 'Diribonucleic Acid', 'none'], correct_answer: 0, marks: 1, topic: 'Genetics & Heredity' },
      { question_text: 'Which organ pumps blood?', options: ['Brain', 'Liver', 'Heart', 'Kidneys'], correct_answer: 2, marks: 1, topic: 'Human Physiology' },
      { question_text: 'The study of ecosystems is:', options: ['Cytology', 'Ecology', 'Zoology', 'Botany'], correct_answer: 1, marks: 1, topic: 'Ecology & Environment' },
      { question_text: 'Photosynthesis occurs in:', options: ['Mitochondria', 'Chloroplasts', 'Ribosomes', 'Vacuoles'], correct_answer: 1, marks: 1, topic: 'Life Processes' },
      { question_text: 'Brain is part of which system?', options: ['Circulatory', 'Nervous', 'Digestive', 'Respiratory'], correct_answer: 1, marks: 1, topic: 'Control & Coordination' },
      { question_text: 'How many chromosomes do humans have?', options: ['23', '44', '46', '48'], correct_answer: 2, marks: 1, topic: 'Genetics & Heredity' },
      { question_text: 'White blood cells fight:', options: ['Hunger', 'Infections', 'Sleep', 'Pain'], correct_answer: 1, marks: 1, topic: 'Human Physiology' },
      { question_text: 'The ozone layer protects from:', options: ['Rain', 'UV rays', 'Wind', 'Cold'], correct_answer: 1, marks: 1, topic: 'Ecology & Environment' },
      { question_text: 'Genes are made up of:', options: ['Proteins', 'Lipids', 'DNA', 'Carbohydrates'], correct_answer: 2, marks: 1, topic: 'Genetics & Heredity' },
    ],
    senior: [
      { question_text: 'mRNA carries the genetic code from:', options: ['Ribosome → Nucleus', 'DNA → Ribosome', 'Cell wall → Nucleus', 'Cytoplasm → DNA'], correct_answer: 1, marks: 1, topic: 'Molecular Biology' },
      { question_text: 'Darwin proposed the theory of:', options: ['Mutation', 'Natural Selection', 'Acquired characters', 'Special creation'], correct_answer: 1, marks: 1, topic: 'Genetics & Evolution' },
      { question_text: 'PCR is used in:', options: ['Cooking', 'DNA amplification', 'Surgery', 'Farming'], correct_answer: 1, marks: 1, topic: 'Biotechnology' },
      { question_text: 'Fertilization in humans occurs in:', options: ['Uterus', 'Ovary', 'Fallopian tube', 'Vagina'], correct_answer: 2, marks: 1, topic: 'Human Reproduction' },
      { question_text: 'A food chain starts with:', options: ['Consumers', 'Producers', 'Decomposers', 'Predators'], correct_answer: 1, marks: 1, topic: 'Ecology & Biodiversity' },
      { question_text: 'Transpiration occurs through:', options: ['Roots', 'Stomata', 'Stems', 'Flowers'], correct_answer: 1, marks: 1, topic: 'Plant Physiology' },
      { question_text: 'The central dogma of biology: DNA → RNA → ?', options: ['Lipid', 'Protein', 'Sugar', 'DNA'], correct_answer: 1, marks: 1, topic: 'Molecular Biology' },
      { question_text: 'Restriction enzymes are:', options: ['Molecular scissors', 'Glue', 'Transporters', 'Hormones'], correct_answer: 0, marks: 1, topic: 'Biotechnology' },
      { question_text: 'Homologous organs indicate:', options: ['Analogy', 'Common ancestry', 'No relation', 'Convergent evolution'], correct_answer: 1, marks: 1, topic: 'Genetics & Evolution' },
      { question_text: 'Auxin promotes:', options: ['Flowering', 'Cell elongation', 'Fruit ripening', 'Leaf fall'], correct_answer: 1, marks: 1, topic: 'Plant Physiology' },
    ],
  },
  'English': {
    primary: [
      { question_text: 'How many vowels are in the English alphabet?', options: ['3', '5', '7', '10'], correct_answer: 1, marks: 1, topic: 'Alphabet & Phonics' },
      { question_text: '"The cat is sleeping." — What is the cat doing?', options: ['Eating', 'Sleeping', 'Running', 'Playing'], correct_answer: 1, marks: 1, topic: 'Simple Sentences' },
      { question_text: 'Which is a noun?', options: ['Run', 'Big', 'Dog', 'Quickly'], correct_answer: 2, marks: 1, topic: 'Nouns & Verbs' },
      { question_text: 'The opposite of "big" is:', options: ['Tall', 'Small', 'Fat', 'Long'], correct_answer: 1, marks: 1, topic: 'Vocabulary Building' },
      { question_text: 'What color is the sky on a clear day?', options: ['Red', 'Green', 'Blue', 'Yellow'], correct_answer: 2, marks: 1, topic: 'Reading Comprehension' },
      { question_text: '"A, E, I, O, U" are called:', options: ['Consonants', 'Vowels', 'Numbers', 'Symbols'], correct_answer: 1, marks: 1, topic: 'Alphabet & Phonics' },
      { question_text: 'Which word is a verb?', options: ['Happy', 'Sing', 'Book', 'Red'], correct_answer: 1, marks: 1, topic: 'Nouns & Verbs' },
      { question_text: '"The boy __ to school." Fill in:', options: ['go', 'goes', 'going', 'goed'], correct_answer: 1, marks: 1, topic: 'Simple Sentences' },
      { question_text: 'What is a baby dog called?', options: ['Kitten', 'Puppy', 'Calf', 'Chick'], correct_answer: 1, marks: 1, topic: 'Vocabulary Building' },
      { question_text: 'Choose the sentence:', options: ['Cat big the.', 'The cat is big.', 'Big the cat.', 'Is big cat the.'], correct_answer: 1, marks: 1, topic: 'Simple Sentences' },
    ],
    middle: [
      { question_text: 'What is the past tense of "go"?', options: ['Goed', 'Gone', 'Went', 'Going'], correct_answer: 2, marks: 1, topic: 'Grammar — Tenses' },
      { question_text: '"Beautifully" is a/an:', options: ['Adjective', 'Adverb', 'Noun', 'Verb'], correct_answer: 1, marks: 1, topic: 'Parts of Speech' },
      { question_text: 'A synonym for "happy" is:', options: ['Sad', 'Angry', 'Joyful', 'Tired'], correct_answer: 2, marks: 1, topic: 'Vocabulary & Idioms' },
      { question_text: '"Break the ice" means:', options: ['Break something', 'Start a conversation', 'Feel cold', 'Melt ice'], correct_answer: 1, marks: 1, topic: 'Vocabulary & Idioms' },
      { question_text: 'Choose the correct spelling:', options: ['Recieve', 'Receive', 'Receve', 'Receeve'], correct_answer: 1, marks: 1, topic: 'Vocabulary & Idioms' },
      { question_text: 'Past tense of "write" is:', options: ['Writed', 'Written', 'Wrote', 'Writing'], correct_answer: 2, marks: 1, topic: 'Grammar — Tenses' },
      { question_text: 'A noun that names a group is called:', options: ['Common noun', 'Proper noun', 'Collective noun', 'Abstract noun'], correct_answer: 2, marks: 1, topic: 'Parts of Speech' },
      { question_text: 'An essay should begin with:', options: ['Conclusion', 'Introduction', 'Body', 'References'], correct_answer: 1, marks: 1, topic: 'Essay Writing' },
      { question_text: '"She reads the passage carefully." This tests:', options: ['Writing', 'Comprehension', 'Speaking', 'Listening'], correct_answer: 1, marks: 1, topic: 'Comprehension Passages' },
      { question_text: 'The plural of "child" is:', options: ['Childs', 'Childrens', 'Children', 'Childies'], correct_answer: 2, marks: 1, topic: 'Grammar — Tenses' },
    ],
    secondary: [
      { question_text: '"She sings beautifully." — "beautifully" is:', options: ['Adjective', 'Adverb', 'Noun', 'Verb'], correct_answer: 1, marks: 1, topic: 'Advanced Grammar' },
      { question_text: '"To be or not to be" is from:', options: ['Romeo and Juliet', 'Hamlet', 'Macbeth', 'Othello'], correct_answer: 1, marks: 1, topic: 'Literature — Prose & Poetry' },
      { question_text: '"The wind howled." — which figure of speech?', options: ['Simile', 'Metaphor', 'Personification', 'Alliteration'], correct_answer: 2, marks: 1, topic: 'Literature — Prose & Poetry' },
      { question_text: 'Which sentence is correct?', options: ['He don\'t like it.', 'He doesn\'t likes it.', 'He doesn\'t like it.', 'He don\'t likes it.'], correct_answer: 2, marks: 1, topic: 'Advanced Grammar' },
      { question_text: 'A summary should be:', options: ['Longer than original', 'Shorter & concise', 'Same length', 'In a different language'], correct_answer: 1, marks: 1, topic: 'Comprehension & Summary' },
      { question_text: 'An antonym of "ancient" is:', options: ['Old', 'Historic', 'Modern', 'Classic'], correct_answer: 2, marks: 1, topic: 'Vocabulary & Usage' },
      { question_text: 'A formal letter starts with:', options: ['Dear friend', 'Hi there', 'The Manager/Sir', 'Hey'], correct_answer: 2, marks: 1, topic: 'Essay & Letter Writing' },
      { question_text: 'Choose the correct spelling:', options: ['Accomodate', 'Accommodate', 'Acomodate', 'Acommodate'], correct_answer: 1, marks: 1, topic: 'Vocabulary & Usage' },
      { question_text: '"As brave as a lion" is:', options: ['Simile', 'Metaphor', 'Irony', 'Hyperbole'], correct_answer: 0, marks: 1, topic: 'Literature — Prose & Poetry' },
      { question_text: 'An essay has how many main parts?', options: ['1', '2', '3', '4'], correct_answer: 2, marks: 1, topic: 'Essay & Letter Writing' },
    ],
    senior: [
      { question_text: 'A critical analysis evaluates:', options: ['Only errors', 'Strengths & weaknesses', 'Only positives', 'Nothing'], correct_answer: 1, marks: 1, topic: 'Advanced Comprehension' },
      { question_text: '"1984" was written by:', options: ['Shakespeare', 'George Orwell', 'Charles Dickens', 'Jane Austen'], correct_answer: 1, marks: 1, topic: 'Literature Analysis' },
      { question_text: 'A protagonist is:', options: ['The villain', 'The main character', 'The narrator', 'The author'], correct_answer: 1, marks: 1, topic: 'Literature Analysis' },
      { question_text: 'Active voice: "She wrote the letter." Passive:', options: ['The letter was written by her.', 'The letter wrote by her.', 'The letter is writing.', 'She was written.'], correct_answer: 0, marks: 1, topic: 'Grammar & Transformation' },
      { question_text: 'An editorial is a type of:', options: ['Story', 'Article expressing opinion', 'Poem', 'Play'], correct_answer: 1, marks: 1, topic: 'Report & Article Writing' },
      { question_text: 'A paradox is:', options: ['A true statement', 'A contradictory but true statement', 'A lie', 'A question'], correct_answer: 1, marks: 1, topic: 'Literature Analysis' },
      { question_text: 'Creative writing includes:', options: ['Only essays', 'Stories, poems, scripts', 'Only reports', 'Only letters'], correct_answer: 1, marks: 1, topic: 'Creative Writing' },
      { question_text: 'Direct → Indirect: "I am happy" → He said that he __ happy.', options: ['is', 'was', 'are', 'were'], correct_answer: 1, marks: 1, topic: 'Grammar & Transformation' },
      { question_text: 'A report should be:', options: ['Subjective', 'Objective & factual', 'Fictional', 'Emotional'], correct_answer: 1, marks: 1, topic: 'Report & Article Writing' },
      { question_text: 'Stream of consciousness is used by:', options: ['Shakespeare', 'Virginia Woolf', 'Homer', 'Chaucer'], correct_answer: 1, marks: 1, topic: 'Literature Analysis' },
    ],
  },
  'Social Science': {
    primary: [
      { question_text: 'Who cooks food at home usually?', options: ['Doctor', 'Teacher', 'Family members', 'Police'], correct_answer: 2, marks: 1, topic: 'My Family & Neighbourhood' },
      { question_text: 'A postman delivers:', options: ['Food', 'Letters', 'Clothes', 'Water'], correct_answer: 1, marks: 1, topic: 'Our Helpers' },
      { question_text: 'Diwali is a festival of:', options: ['Colors', 'Lights', 'Harvest', 'Rain'], correct_answer: 1, marks: 1, topic: 'Festivals of India' },
      { question_text: 'The sun rises in the:', options: ['West', 'North', 'East', 'South'], correct_answer: 2, marks: 1, topic: 'Maps & Directions' },
      { question_text: 'The capital of India is:', options: ['Mumbai', 'Chennai', 'Kolkata', 'New Delhi'], correct_answer: 3, marks: 1, topic: 'Our Country' },
      { question_text: 'A doctor helps us when we are:', options: ['Hungry', 'Sick', 'Happy', 'Playing'], correct_answer: 1, marks: 1, topic: 'Our Helpers' },
      { question_text: 'Our national flag has how many colors?', options: ['2', '3', '4', '5'], correct_answer: 1, marks: 1, topic: 'Our Country' },
      { question_text: 'Members of a family living together are:', options: ['Strangers', 'Friends', 'A household', 'Neighbours'], correct_answer: 2, marks: 1, topic: 'My Family & Neighbourhood' },
      { question_text: 'Holi is celebrated with:', options: ['Lights', 'Colors', 'Gifts', 'Sweets only'], correct_answer: 1, marks: 1, topic: 'Festivals of India' },
      { question_text: 'North is shown at the __ of a map.', options: ['Bottom', 'Left', 'Right', 'Top'], correct_answer: 3, marks: 1, topic: 'Maps & Directions' },
    ],
    middle: [
      { question_text: 'The Mughal Empire was founded by:', options: ['Akbar', 'Babur', 'Shah Jahan', 'Aurangzeb'], correct_answer: 1, marks: 1, topic: 'History — Medieval India' },
      { question_text: 'The Earth\'s atmosphere contains mostly:', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Hydrogen'], correct_answer: 2, marks: 1, topic: 'Geography — Our Environment' },
      { question_text: 'Democracy means government by the:', options: ['King', 'Army', 'People', 'Rich'], correct_answer: 2, marks: 1, topic: 'Civics — Government' },
      { question_text: 'Natural resources include:', options: ['Buildings', 'Water & forests', 'Cars', 'Computers'], correct_answer: 1, marks: 1, topic: 'Economics — Resources' },
      { question_text: 'The equator divides Earth into:', options: ['East and West', 'North and South', 'Land and Water', 'Day and Night'], correct_answer: 1, marks: 1, topic: 'Map Skills' },
      { question_text: 'Taj Mahal was built by:', options: ['Akbar', 'Babur', 'Shah Jahan', 'Humayun'], correct_answer: 2, marks: 1, topic: 'History — Medieval India' },
      { question_text: 'Which is a renewable resource?', options: ['Coal', 'Oil', 'Solar energy', 'Natural gas'], correct_answer: 2, marks: 1, topic: 'Economics — Resources' },
      { question_text: 'Latitude lines run:', options: ['North-South', 'East-West', 'Diagonally', 'Randomly'], correct_answer: 1, marks: 1, topic: 'Map Skills' },
      { question_text: 'The PM of India is head of:', options: ['Judiciary', 'Legislature', 'Executive', 'Military'], correct_answer: 2, marks: 1, topic: 'Civics — Government' },
      { question_text: 'Deforestation causes:', options: ['More rain', 'Climate change', 'More forests', 'Cold weather'], correct_answer: 1, marks: 1, topic: 'Geography — Our Environment' },
    ],
    secondary: [
      { question_text: 'Father of the Indian Nation is:', options: ['Nehru', 'Ambedkar', 'Gandhi', 'Tagore'], correct_answer: 2, marks: 1, topic: 'History — Modern India' },
      { question_text: 'Largest continent by area:', options: ['Africa', 'North America', 'Asia', 'Europe'], correct_answer: 2, marks: 1, topic: 'Geography — Climate & Resources' },
      { question_text: 'Indian Constitution adopted on:', options: ['15 Aug 1947', '26 Jan 1950', '26 Nov 1949', '2 Oct 1950'], correct_answer: 2, marks: 1, topic: 'Civics — Democracy & Constitution' },
      { question_text: 'GDP stands for:', options: ['General Domestic Product', 'Gross Domestic Product', 'Gross Development Plan', 'none'], correct_answer: 1, marks: 1, topic: 'Economics — Development' },
      { question_text: 'Globalization means:', options: ['Isolation', 'Connecting world economies', 'Going to space', 'Farming'], correct_answer: 1, marks: 1, topic: 'Globalization' },
      { question_text: 'The French Revolution began in:', options: ['1776', '1789', '1799', '1804'], correct_answer: 1, marks: 1, topic: 'History — Modern India' },
      { question_text: 'Longest river in India:', options: ['Yamuna', 'Godavari', 'Ganga', 'Brahmaputra'], correct_answer: 2, marks: 1, topic: 'Geography — Climate & Resources' },
      { question_text: 'Inflation is:', options: ['Fall in prices', 'Rise in prices', 'Stable prices', 'None'], correct_answer: 1, marks: 1, topic: 'Economics — Development' },
      { question_text: 'Thinnest layer of Earth:', options: ['Core', 'Mantle', 'Crust', 'Asthenosphere'], correct_answer: 2, marks: 1, topic: 'Geography — Climate & Resources' },
      { question_text: 'Right to Education is a:', options: ['Legal right', 'Fundamental right', 'Directive principle', 'Statutory right'], correct_answer: 1, marks: 1, topic: 'Civics — Democracy & Constitution' },
    ],
    senior: [
      { question_text: 'The Quit India Movement was in:', options: ['1930', '1940', '1942', '1947'], correct_answer: 2, marks: 1, topic: 'Indian History — National Movement' },
      { question_text: 'The largest desert in the world:', options: ['Thar', 'Sahara', 'Gobi', 'Antarctic'], correct_answer: 3, marks: 1, topic: 'World Geography' },
      { question_text: 'Judiciary in India is:', options: ['Dependent on government', 'Independent', 'Part of legislature', 'None'], correct_answer: 1, marks: 1, topic: 'Political Science' },
      { question_text: 'The RBI is India\'s:', options: ['Stock exchange', 'Central bank', 'Parliament', 'Court'], correct_answer: 1, marks: 1, topic: 'Indian Economy' },
      { question_text: 'The UN was founded in:', options: ['1920', '1945', '1950', '1960'], correct_answer: 1, marks: 1, topic: 'International Relations' },
      { question_text: 'Non-Cooperation Movement led by:', options: ['Subhas Bose', 'Bhagat Singh', 'Mahatma Gandhi', 'Nehru'], correct_answer: 2, marks: 1, topic: 'Indian History — National Movement' },
      { question_text: 'India\'s Tropic of Cancer passes through how many states?', options: ['6', '8', '10', '12'], correct_answer: 1, marks: 1, topic: 'World Geography' },
      { question_text: 'President of India is elected by:', options: ['People directly', 'Parliament only', 'Electoral college', 'PM'], correct_answer: 2, marks: 1, topic: 'Political Science' },
      { question_text: 'Five Year Plans were introduced by:', options: ['British', 'Mahatma Gandhi', 'Planning Commission', 'RBI'], correct_answer: 2, marks: 1, topic: 'Indian Economy' },
      { question_text: 'NATO is a:', options: ['Trade agreement', 'Military alliance', 'Court', 'Bank'], correct_answer: 1, marks: 1, topic: 'International Relations' },
    ],
  },
  'Malayalam': {
    primary: [
      { question_text: 'മലയാള അക്ഷരമാലയിലെ ആദ്യ അക്ഷരം:', options: ['ആ', 'അ', 'ഇ', 'ക'], correct_answer: 1, marks: 1, topic: 'അക്ഷരമാല (Alphabet)' },
      { question_text: '"പൂച്ച" ഏത് ജീവിയാണ്?', options: ['പക്ഷി', 'മൃഗം', 'മത്സ്യം', 'പ്രാണി'], correct_answer: 1, marks: 1, topic: 'പദസമ്പത്ത് (Vocabulary)' },
      { question_text: '"മഴ പെയ്യുന്നു" — ഇത് ഒരു:', options: ['ചോദ്യം', 'വാക്യം', 'പദം', 'അക്ഷരം'], correct_answer: 1, marks: 1, topic: 'ലളിതവാക്യം (Simple Sentences)' },
      { question_text: '"കിളി" യുടെ ബഹുവചനം:', options: ['കിളികൾ', 'കിളിമാർ', 'കിളിയെ', 'കിളിക്ക്'], correct_answer: 0, marks: 1, topic: 'പദസമ്പത്ത് (Vocabulary)' },
      { question_text: '"ക" മുതൽ "ങ" വരെ ഏത് വർഗം?', options: ['കവർഗം', 'ചവർഗം', 'ടവർഗം', 'തവർഗം'], correct_answer: 0, marks: 1, topic: 'അക്ഷരമാല (Alphabet)' },
      { question_text: '"നല്ല കുട്ടി" — "നല്ല" ഏത് തരം വാക്ക്?', options: ['നാമം', 'ക്രിയ', 'വിശേഷണം', 'അവ്യയം'], correct_answer: 2, marks: 1, topic: 'ലളിതവാക്യം (Simple Sentences)' },
      { question_text: '"മുയൽ" ഇതിലെ സ്വരം:', options: ['മ', 'ഉ', 'യ', 'ൽ'], correct_answer: 1, marks: 1, topic: 'അക്ഷരമാല (Alphabet)' },
      { question_text: '"സൂര്യൻ" എന്നാൽ:', options: ['ചന്ദ്രൻ', 'നക്ഷത്രം', 'Sun', 'Earth'], correct_answer: 2, marks: 1, topic: 'പദസമ്പത്ത് (Vocabulary)' },
      { question_text: '"ഒരു കാക്ക" — ഒരു ___', options: ['കഥ', 'കാക്ക', 'വാക്ക്', 'ചിത്രം'], correct_answer: 1, marks: 1, topic: 'കഥ വായന (Story Reading)' },
      { question_text: '"അ, ആ, ഇ, ഈ" ഇവ:', options: ['വ്യഞ്ജനം', 'സ്വരം', 'ചിഹ്നം', 'സംഖ്യ'], correct_answer: 1, marks: 1, topic: 'അക്ഷരമാല (Alphabet)' },
    ],
    middle: [
      { question_text: 'മലയാള അക്ഷരമാലയിൽ സ്വരാക്ഷരങ്ങൾ:', options: ['13', '15', '16', '18'], correct_answer: 2, marks: 1, topic: 'വ്യാകരണം — ലിംഗം, വചനം' },
      { question_text: '"കഥ" യുടെ ബഹുവചനം:', options: ['കഥകൾ', 'കഥമാർ', 'കഥയുകൾ', 'കഥക്കൾ'], correct_answer: 0, marks: 1, topic: 'വ്യാകരണം — ലിംഗം, വചനം' },
      { question_text: 'തുഞ്ചത്ത് എഴുത്തച്ഛൻ അറിയപ്പെടുന്നത്:', options: ['കവിതാപിതാവ്', 'മലയാളത്തിന്റെ പിതാവ്', 'ഗദ്യപിതാവ്', 'നോവലിസ്റ്റ്'], correct_answer: 1, marks: 1, topic: 'ഗദ്യം (Prose)' },
      { question_text: '"കുട്ടി" യുടെ എതിർലിംഗം:', options: ['കുട്ടിച്ചി', 'പെൺകുട്ടി', 'ആൺകുട്ടി', 'ശിശു'], correct_answer: 0, marks: 1, topic: 'വ്യാകരണം — ലിംഗം, വചനം' },
      { question_text: '"ക്ക" ഇത്:', options: ['സ്വരം', 'വ്യഞ്ജനം', 'സംയുക്താക്ഷരം', 'ചിഹ്നം'], correct_answer: 2, marks: 1, topic: 'വ്യാകരണം — ലിംഗം, വചനം' },
      { question_text: 'കേരളപ്പിറവി ദിനം:', options: ['നവംബർ 1', 'ജനുവരി 26', 'ഓഗസ്റ്റ് 15', 'ഒക്ടോബർ 2'], correct_answer: 0, marks: 1, topic: 'ഗദ്യം (Prose)' },
      { question_text: '"വായിക്കുക" ഏത് ക്രിയാരൂപം?', options: ['ഭൂതകാലം', 'വർത്തമാനം', 'ഭാവികാലം', 'സാമാന്യരൂപം'], correct_answer: 3, marks: 1, topic: 'വ്യാകരണം — ലിംഗം, വചനം' },
      { question_text: '"ആട്ടക്കഥ" ബന്ധപ്പെട്ട കലാരൂപം:', options: ['മോഹിനിയാട്ടം', 'കഥകളി', 'ഓട്ടംതുള്ളൽ', 'തെയ്യം'], correct_answer: 1, marks: 1, topic: 'പദ്യം (Poetry)' },
      { question_text: 'ഉപന്യാസം എന്നാൽ:', options: ['കഥ', 'Essay', 'കവിത', 'നാടകം'], correct_answer: 1, marks: 1, topic: 'ഉപന്യാസം (Essay)' },
      { question_text: 'കേരളത്തിന്റെ സംസ്ഥാന പക്ഷി:', options: ['മയിൽ', 'വേഴാമ്പൽ', 'കാക്ക', 'കുയിൽ'], correct_answer: 1, marks: 1, topic: 'ഗദ്യം (Prose)' },
    ],
    secondary: [
      { question_text: '"നല്ല" ഏത് വിഭാഗം?', options: ['നാമം', 'ക്രിയ', 'വിശേഷണം', 'അവ്യയം'], correct_answer: 2, marks: 1, topic: 'വ്യാകരണം (Grammar)' },
      { question_text: 'ചങ്ങമ്പുഴ കൃഷ്ണപിള്ള ഒരു:', options: ['നോവലിസ്റ്റ്', 'കവി', 'നാടകകൃത്ത്', 'ചിത്രകാരൻ'], correct_answer: 1, marks: 1, topic: 'പദ്യസാഹിത്യം (Poetry)' },
      { question_text: '"ഇന്ദുലേഖ" എഴുതിയത്:', options: ['ബഷീർ', 'ചന്ദു മേനോൻ', 'തകഴി', 'ജ്ഞാനപീഠം'], correct_answer: 1, marks: 1, topic: 'ഗദ്യസാഹിത്യം (Prose Literature)' },
      { question_text: 'ഔദ്യോഗിക കത്ത് ആരംഭിക്കുന്നത്:', options: ['പ്രിയ സുഹൃത്തേ', 'ബഹുമാനപ്പെട്ട', 'ഹായ്', 'ആശംസകൾ'], correct_answer: 1, marks: 1, topic: 'കത്തെഴുത്ത് (Letter Writing)' },
      { question_text: '"ഉപമ" എന്നാൽ:', options: ['Metaphor', 'Simile', 'Irony', 'Hyperbole'], correct_answer: 1, marks: 1, topic: 'വ്യാകരണം (Grammar)' },
      { question_text: 'ബഷീറിന്റെ പ്രശസ്ത കൃതി:', options: ['ഇന്ദുലേഖ', 'ബാല്യകാലസഖി', 'ഖസാക്കിന്റെ ഇതിഹാസം', 'മയ്യഴിപ്പുഴ'], correct_answer: 1, marks: 1, topic: 'ഗദ്യസാഹിത്യം (Prose Literature)' },
      { question_text: '"മഴ" — ഏത് നാമം?', options: ['സംജ്ഞാനാമം', 'സാമാന്യനാമം', 'ഭാവനാമം', 'ദ്രവ്യനാമം'], correct_answer: 1, marks: 1, topic: 'വ്യാകരണം (Grammar)' },
      { question_text: 'ഉപന്യാസത്തിന്റെ ഭാഗങ്ങൾ:', options: ['1', '2', '3', '4'], correct_answer: 2, marks: 1, topic: 'ഉപന്യാസം (Essay)' },
      { question_text: 'വള്ളത്തോൾ നാരായണ മേനോൻ:', options: ['ഗദ്യകാരൻ', 'കവി', 'നാടകകൃത്ത്', 'പത്രാധിപർ'], correct_answer: 1, marks: 1, topic: 'പദ്യസാഹിത്യം (Poetry)' },
      { question_text: 'മലയാളത്തിലെ ആദ്യ നോവൽ:', options: ['ബാല്യകാലസഖി', 'ഇന്ദുലേഖ', 'ചെമ്മീൻ', 'രണ്ടാമൂഴം'], correct_answer: 1, marks: 1, topic: 'ഗദ്യസാഹിത്യം (Prose Literature)' },
    ],
    senior: [
      { question_text: 'ജ്ഞാനപീഠ പുരസ്കാരം ആദ്യം ലഭിച്ച മലയാളി:', options: ['തകഴി', 'ഒ.എൻ.വി.', 'ജി. ശങ്കരക്കുറുപ്പ്', 'എം.ടി.'], correct_answer: 2, marks: 1, topic: 'സാഹിത്യ വിമർശനം (Literary Criticism)' },
      { question_text: '"ഖസാക്കിന്റെ ഇതിഹാസം" എഴുതിയത്:', options: ['ബഷീർ', 'ഒ.വി. വിജയൻ', 'തകഴി', 'എം.ടി.'], correct_answer: 1, marks: 1, topic: 'ഗദ്യം & പദ്യം (Prose & Poetry)' },
      { question_text: '"ഉൽപ്രേക്ഷ" ഒരു:', options: ['അലങ്കാരം', 'വൃത്തം', 'സന്ധി', 'സമാസം'], correct_answer: 0, marks: 1, topic: 'വ്യാകരണം — അലങ്കാരം (Rhetoric)' },
      { question_text: 'ലേഖനം എന്നാൽ:', options: ['കഥ', 'Article', 'നോവൽ', 'നാടകം'], correct_answer: 1, marks: 1, topic: 'ലേഖനം (Article Writing)' },
      { question_text: '"അനുപ്രാസം" ഉദാഹരണം:', options: ['ഒരേ ശബ്ദത്തിന്റെ ആവർത്തനം', 'ഉപമ', 'വ്യതിരേകം', 'സ്വഭാവോക്തി'], correct_answer: 0, marks: 1, topic: 'വ്യാകരണം — അലങ്കാരം (Rhetoric)' },
      { question_text: '"ചെമ്മീൻ" ൻറെ രചയിതാവ്:', options: ['ബഷീർ', 'തകഴി', 'എം.ടി.', 'ഒ.എൻ.വി.'], correct_answer: 1, marks: 1, topic: 'ഗദ്യം & പദ്യം (Prose & Poetry)' },
      { question_text: '"മഹാകാവ്യം" ഒരു:', options: ['ചെറുകഥ', 'ദീർഘ കാവ്യം', 'ലേഖനം', 'നാടകം'], correct_answer: 1, marks: 1, topic: 'സാഹിത്യ വിമർശനം (Literary Criticism)' },
      { question_text: '"രൂപകം" ഒരു:', options: ['വൃത്തം', 'അലങ്കാരം', 'സമാസം', 'പ്രത്യയം'], correct_answer: 1, marks: 1, topic: 'വ്യാകരണം — അലങ്കാരം (Rhetoric)' },
      { question_text: 'ആധുനിക മലയാള കവിതയുടെ പിതാവ്:', options: ['കുമാരനാശാൻ', 'വള്ളത്തോൾ', 'ഉള്ളൂർ', 'ചങ്ങമ്പുഴ'], correct_answer: 0, marks: 1, topic: 'ഗദ്യം & പദ്യം (Prose & Poetry)' },
      { question_text: 'സാഹിത്യ വിമർശനം എന്നാൽ:', options: ['കഥ എഴുതൽ', 'സാഹിത്യ വിലയിരുത്തൽ', 'പദ്യം ചൊല്ലൽ', 'നാടകം കാണൽ'], correct_answer: 1, marks: 1, topic: 'സാഹിത്യ വിമർശനം (Literary Criticism)' },
    ],
  },
  'Arabic': {
    primary: [
      { question_text: 'How many letters in the Arabic alphabet?', options: ['24', '26', '28', '30'], correct_answer: 2, marks: 1, topic: 'Arabic Alphabet (الحروف)' },
      { question_text: 'What is "كتاب"?', options: ['Pen', 'Book', 'Door', 'Water'], correct_answer: 1, marks: 1, topic: 'Basic Words (كلمات)' },
      { question_text: '"السلام عليكم" means:', options: ['Good morning', 'Peace be upon you', 'Thank you', 'Goodbye'], correct_answer: 1, marks: 1, topic: 'Greetings (تحيات)' },
      { question_text: 'واحد (wahid) means:', options: ['Two', 'One', 'Three', 'Four'], correct_answer: 1, marks: 1, topic: 'Numbers (أرقام)' },
      { question_text: 'What color is "أخضر"?', options: ['Red', 'Blue', 'Green', 'Yellow'], correct_answer: 2, marks: 1, topic: 'Colors (ألوان)' },
      { question_text: 'First letter of Arabic alphabet:', options: ['ب', 'أ', 'ت', 'ث'], correct_answer: 1, marks: 1, topic: 'Arabic Alphabet (الحروف)' },
      { question_text: '"ماء" means:', options: ['Fire', 'Air', 'Water', 'Earth'], correct_answer: 2, marks: 1, topic: 'Basic Words (كلمات)' },
      { question_text: '"شكرا" means:', options: ['Hello', 'Sorry', 'Thank you', 'Goodbye'], correct_answer: 2, marks: 1, topic: 'Greetings (تحيات)' },
      { question_text: 'عشرة (ashara) means:', options: ['5', '8', '10', '20'], correct_answer: 2, marks: 1, topic: 'Numbers (أرقام)' },
      { question_text: '"أحمر" is which color?', options: ['Blue', 'Red', 'Green', 'White'], correct_answer: 1, marks: 1, topic: 'Colors (ألوان)' },
    ],
    middle: [
      { question_text: 'Arabic is written:', options: ['Left to right', 'Right to left', 'Top to bottom', 'Bottom to top'], correct_answer: 1, marks: 1, topic: 'Grammar — Nouns & Verbs (نحو)' },
      { question_text: 'How many vowel marks (harakat)?', options: ['2', '3', '4', '5'], correct_answer: 1, marks: 1, topic: 'Grammar — Nouns & Verbs (نحو)' },
      { question_text: '"مدرسة" means:', options: ['Mosque', 'School', 'Market', 'Hospital'], correct_answer: 1, marks: 1, topic: 'Vocabulary' },
      { question_text: '"أنا أقرأ" means:', options: ['I write', 'I read', 'I eat', 'I sleep'], correct_answer: 1, marks: 1, topic: 'Reading Comprehension' },
      { question_text: '"كيف حالك" is used to:', options: ['Say goodbye', 'Ask how someone is', 'Order food', 'Tell time'], correct_answer: 1, marks: 1, topic: 'Conversation (محادثة)' },
      { question_text: '"قلم" means:', options: ['Pen', 'Book', 'Ruler', 'Bag'], correct_answer: 0, marks: 1, topic: 'Vocabulary' },
      { question_text: '"هو" means:', options: ['She', 'He', 'They', 'We'], correct_answer: 1, marks: 1, topic: 'Grammar — Nouns & Verbs (نحو)' },
      { question_text: '"اكتب" means:', options: ['Read', 'Write', 'Listen', 'Speak'], correct_answer: 1, marks: 1, topic: 'Writing Skills' },
      { question_text: 'Arabic is official in how many countries?', options: ['15', '20', '22', '25'], correct_answer: 2, marks: 1, topic: 'Reading Comprehension' },
      { question_text: '"ما اسمك" means:', options: ['How old are you?', 'What is your name?', 'Where are you?', 'How are you?'], correct_answer: 1, marks: 1, topic: 'Conversation (محادثة)' },
    ],
    secondary: [
      { question_text: '"الفعل الماضي" refers to:', options: ['Present tense', 'Past tense', 'Future tense', 'Imperative'], correct_answer: 1, marks: 1, topic: 'Grammar (نحو و صرف)' },
      { question_text: '"جملة اسمية" starts with:', options: ['Verb', 'Noun', 'Particle', 'Adjective'], correct_answer: 1, marks: 1, topic: 'Grammar (نحو و صرف)' },
      { question_text: 'The "tanwin" adds what sound?', options: ['-an, -in, -un', '-a, -i, -u', '-at, -it', '-al'], correct_answer: 0, marks: 1, topic: 'Grammar (نحو و صرف)' },
      { question_text: '"مقال" means:', options: ['Story', 'Essay', 'Poem', 'Letter'], correct_answer: 1, marks: 1, topic: 'Essay Writing' },
      { question_text: '"ترجمة" means:', options: ['Writing', 'Reading', 'Translation', 'Speaking'], correct_answer: 2, marks: 1, topic: 'Translation Skills' },
      { question_text: '"كان" is used for:', options: ['Present', 'Past tense auxiliary', 'Future', 'Question'], correct_answer: 1, marks: 1, topic: 'Grammar (نحو و صرف)' },
      { question_text: '"بحر" means:', options: ['Mountain', 'Sea', 'Desert', 'River'], correct_answer: 1, marks: 1, topic: 'Vocabulary & Idioms' },
      { question_text: '"ال" in Arabic is:', options: ['Pronoun', 'Definite article', 'Verb', 'Noun'], correct_answer: 1, marks: 1, topic: 'Grammar (نحو و صرف)' },
      { question_text: 'Translate: "أنا طالب"', options: ['I am a teacher', 'I am a student', 'He is a student', 'She is a student'], correct_answer: 1, marks: 1, topic: 'Translation Skills' },
      { question_text: '"جميل" means:', options: ['Ugly', 'Beautiful', 'Big', 'Small'], correct_answer: 1, marks: 1, topic: 'Vocabulary & Idioms' },
    ],
    senior: [
      { question_text: '"بلاغة" refers to:', options: ['Grammar', 'Rhetoric', 'Writing', 'Reading'], correct_answer: 1, marks: 1, topic: 'Advanced Grammar (نحو متقدم)' },
      { question_text: 'Pre-Islamic poetry is called:', options: ['Modern poetry', 'Jahiliyyah poetry', 'Abbasid poetry', 'Sufi poetry'], correct_answer: 1, marks: 1, topic: 'Arabic Literature' },
      { question_text: '"إعراب" involves:', options: ['Translation', 'Grammatical case analysis', 'Writing', 'Reading'], correct_answer: 1, marks: 1, topic: 'Advanced Grammar (نحو متقدم)' },
      { question_text: '"إنشاء" means:', options: ['Destruction', 'Composition/Creation', 'Reading', 'Speaking'], correct_answer: 1, marks: 1, topic: 'Advanced Writing' },
      { question_text: '"استعارة" is a type of:', options: ['Grammar rule', 'Metaphor', 'Verb form', 'Noun type'], correct_answer: 1, marks: 1, topic: 'Arabic Literature' },
      { question_text: 'The Quran is written in:', options: ['Urdu', 'Persian', 'Classical Arabic', 'Hindi'], correct_answer: 2, marks: 1, topic: 'Literary Texts' },
      { question_text: '"مفعول به" is the:', options: ['Subject', 'Object', 'Verb', 'Preposition'], correct_answer: 1, marks: 1, topic: 'Advanced Grammar (نحو متقدم)' },
      { question_text: '"ترجم الفقرة" means:', options: ['Read the paragraph', 'Translate the paragraph', 'Write the paragraph', 'Delete the paragraph'], correct_answer: 1, marks: 1, topic: 'Translation & Composition' },
      { question_text: 'المتنبي was a famous:', options: ['King', 'Poet', 'Scientist', 'Merchant'], correct_answer: 1, marks: 1, topic: 'Arabic Literature' },
      { question_text: '"تشبيه" is:', options: ['Simile', 'Metaphor', 'Irony', 'Alliteration'], correct_answer: 0, marks: 1, topic: 'Advanced Grammar (نحو متقدم)' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════

/**
 * Get topics for a grade+subject combo. Used by the demo form to show "Topics to Cover" chips.
 */
export function getTopicsForGradeSubject(grade: string, subject: string): string[] {
  const band = gradeBand(grade);
  return TOPICS[subject]?.[band] ?? TOPICS['Mathematics'][band] ?? [];
}

/**
 * Get all topics per subject for a given grade.
 * Returns Record<subject, topics[]> — used in the API GET response.
 */
export function getAllTopicsForGrade(grade: string): Record<string, string[]> {
  const band = gradeBand(grade);
  const result: Record<string, string[]> = {};
  for (const [subj, bands] of Object.entries(TOPICS)) {
    result[subj] = bands[band] ?? [];
  }
  return result;
}

/**
 * Get 10 shuffled questions for a demo exam, grade-aware.
 * Falls back: grade-agnostic → secondary band → Mathematics.
 */
export function getDemoExamQuestions(subject: string, grade?: string): DemoExamQuestion[] {
  const band = grade ? gradeBand(grade) : 'secondary';
  const questions = Q[subject]?.[band] ?? Q[subject]?.['secondary'] ?? Q['Mathematics'][band] ?? Q['Mathematics']['secondary'];
  // Shuffle using Fisher-Yates
  const shuffled = [...questions];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, 10);
}

export function getAvailableSubjects(): string[] {
  return Object.keys(TOPICS);
}
