// ═══════════════════════════════════════════════════════════════
// Seed Academic Calendars — generates 2026-27 session plans for
// CBSE (Grades 1–12), ICSE (Grades 6–10), ISC (Grades 11–12),
// State Board (Grades 6–12) and inserts directly into the DB.
//
// Run: npx tsx scripts/seed-academic-calendars.ts
// ═══════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 10000,
});

// ── Types ────────────────────────────────────────────────────
interface Chapter { name: string; topics: string[]; }
interface CalSession { date: string; day: string; subject: string; topic: string | null; type: string; }

// ── Working days helper ──────────────────────────────────────
function workingDays(start: string, end: string): { date: string; day: string }[] {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const result: { date: string; day: string }[] = [];
  const d = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  while (d <= e) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) {
      result.push({ date: d.toISOString().slice(0, 10), day: DAY_NAMES[dow] });
    }
    d.setDate(d.getDate() + 1);
  }
  return result;
}

// ── Spread topics across N sessions ─────────────────────────
function assignTopics(chapters: Chapter[], sessionCount: number): (string | null)[] {
  if (!chapters.length || sessionCount === 0) return Array(sessionCount).fill(null);

  // Flatten: chapter name intro + each topic
  const flat: string[] = [];
  for (const ch of chapters) {
    flat.push(ch.name);
    for (const t of ch.topics) flat.push(`${ch.name} — ${t}`);
  }

  const result: (string | null)[] = [];
  for (let i = 0; i < sessionCount; i++) {
    const idx = Math.floor((i / sessionCount) * flat.length);
    result.push(flat[idx] ?? null);
  }
  return result;
}

// ── Generate calendar sessions ───────────────────────────────
function generateSessions(
  subjects: { name: string; chapters: Chapter[] }[],
  dayMapping: Record<string, string[]>, // subject → days-of-week[]
): { sessions: CalSession[]; summary: Record<string, number> } {
  const allDays = workingDays('2026-06-01', '2027-02-28');

  // Collect days per subject
  const subjectDays: Record<string, { date: string; day: string }[]> = {};
  for (const { name } of subjects) subjectDays[name] = [];

  for (const d of allDays) {
    for (const { name } of subjects) {
      const assignedDays = dayMapping[name] ?? [];
      if (assignedDays.includes(d.day)) {
        subjectDays[name].push(d);
      }
    }
  }

  const sessions: CalSession[] = [];
  const summary: Record<string, number> = {};

  for (const { name, chapters } of subjects) {
    const days = subjectDays[name];
    summary[name] = days.length;
    const topics = assignTopics(chapters, days.length);
    for (let i = 0; i < days.length; i++) {
      sessions.push({ date: days[i].date, day: days[i].day, subject: name, topic: topics[i], type: 'session' });
    }
  }

  sessions.sort((a, b) => a.date.localeCompare(b.date));
  return { sessions, summary };
}

// ── Curriculum (inline from lib/curriculum-data.ts patterns) ─
// Helper: chapter names only
const cn = (names: string[]): Chapter[] => names.map(n => ({ name: n, topics: [] }));
// Helper: chapters with topics
type CT = [string, string[]];
const ct = (data: CT[]): Chapter[] => data.map(([name, topics]) => ({ name, topics }));

// ────────────────────────────────────────────────────────────
//  CBSE CURRICULUM (per grade → per subject → chapters)
// ────────────────────────────────────────────────────────────
const CBSE: Record<string, Record<string, Chapter[]>> = {
  '1': {
    Mathematics: cn(['Numbers (1 to 100)', 'Addition', 'Subtraction', 'Shapes and Space', 'Patterns', 'Measurement', 'Time', 'Money', 'Data Handling']),
    Science: cn(['My Body', 'Living and Non-Living Things', 'Plants Around Us', 'Animals Around Us', 'Food We Eat', 'Water', 'Weather and Seasons', 'My Family', 'Our Helpers', 'Safety Rules']),
  },
  '2': {
    Mathematics: cn(['Numbers up to 999', 'Addition', 'Subtraction', 'Multiplication Introduction', 'Shapes and Patterns', 'Measurement', 'Time and Calendar', 'Money', 'Data Handling']),
    Science: cn(['My Body Parts', 'Good Habits and Safety', 'Plants', 'Animals and Their Babies', 'Food and Nutrition', 'Water and Air', 'Weather', 'Our Surroundings', 'Transport']),
  },
  '3': {
    Mathematics: cn(['Numbers up to 9999', 'Addition and Subtraction', 'Multiplication', 'Division', 'Fractions', 'Shapes and Designs', 'Patterns', 'Measurement', 'Time', 'Money', 'Data Handling']),
    Science: cn(['Living Things and Their Surroundings', 'Plants and Their Parts', 'Animals and Their Habitats', 'Birds', 'Food and Health', 'Our Body', 'Water', 'Air', 'Soil', 'Light and Shadow', 'Housing and Clothing', 'Safety and First Aid']),
  },
  '4': {
    Mathematics: cn(['Large Numbers', 'Addition and Subtraction', 'Multiplication and Division', 'Factors and Multiples', 'Fractions', 'Decimals', 'Geometry', 'Perimeter and Area', 'Patterns', 'Data Handling', 'Measurement']),
    Science: cn(['Organs and Organ Systems', 'Digestive System', 'Teeth and Microbes', 'Plants — Adaptations', 'Animals — Adaptations', 'Food and Digestion', 'Clothes We Wear', 'Air and Water', 'Rocks and Soil', 'Our Environment', 'Force, Work, Energy']),
  },
  '5': {
    Mathematics: cn(['Large Numbers and Place Value', 'Factors and Multiples', 'Fractions', 'Decimals', 'Geometry', 'Area and Perimeter', 'Volume', 'Patterns', 'Data Handling', 'Profit and Loss', 'Measurement and Conversions']),
    Science: cn(['Super Senses', 'Seeds and Germination', 'Experiments with Water', 'Diet and Health', 'Symmetry', 'Mapping', 'Weather and Climate', 'Soil and Rocks']),
  },
  '6': {
    Mathematics: ct([
      ['Number System', ['Natural numbers', 'Whole numbers', 'Integers', 'Factors and multiples', 'Playing with numbers']],
      ['Algebra', ['Introduction to algebra', 'Variables and expressions', 'Linear equations in one variable']],
      ['Geometry', ['Basic geometrical ideas', 'Understanding elementary shapes', 'Symmetry']],
      ['Mensuration', ['Perimeter and area of basic shapes']],
      ['Data Handling', ['Introduction to statistics', 'Bar graphs', 'Mean and range']],
    ]),
    Science: ct([
      ['Food', ['Where Does Our Food Come From?', 'Components of Food', 'Fibre to Fabric']],
      ['Sorting Materials into Groups', ['Properties of materials', 'Separation of substances']],
      ['Getting to Know Plants', ['Parts of a plant', 'Functions', 'Photosynthesis']],
      ['Body Movements', ['Organs', 'Joints and bones']],
      ['The Living Organisms and Their Surroundings', ['Habitats', 'Adaptation']],
      ['Motion and Measurement of Distances', ['Types of motion', 'SI units']],
      ['Light, Shadows and Reflections', ['Sources of light', 'Reflection', 'Shadows']],
      ['Electricity and Circuits', ['Simple circuits', 'Conductors and insulators']],
      ['Fun with Magnets', ['Properties', 'Poles', 'Compass']],
      ['Water', ['Water cycle', 'Importance', 'Conservation']],
      ['Air Around Us', ['Composition', 'Properties', 'Importance']],
      ['Garbage In, Garbage Out', ['Waste management', 'Recycling']],
    ]),
  },
  '7': {
    Mathematics: ct([
      ['Integers', ['Introduction', 'Addition and subtraction', 'Multiplication and division', 'Properties']],
      ['Fractions and Decimals', ['Fractions', 'Multiplication and division of fractions', 'Decimals']],
      ['Data Handling', ['Mean, median, mode', 'Chance and probability', 'Graphs']],
      ['Simple Equations', ['Setting up equations', 'Solution of equations', 'Applications']],
      ['Lines and Angles', ['Pairs of angles', 'Transversal', 'Properties of parallel lines']],
      ['The Triangle and Its Properties', ['Angle sum property', 'Exterior angle', 'Pythagoras theorem']],
      ['Congruence of Triangles', ['Criteria of congruence']],
      ['Comparing Quantities', ['Ratios', 'Percentages', 'Profit and loss', 'Simple interest']],
      ['Rational Numbers', ['Operations', 'Properties']],
      ['Perimeter and Area', ['Triangles', 'Circles', 'Area of composite figures']],
      ['Algebraic Expressions', ['Terms', 'Degree', 'Addition and subtraction', 'Value of expression']],
      ['Exponents and Powers', ['Laws of exponents', 'Large numbers in standard form']],
    ]),
    Science: ct([
      ['Nutrition in Plants', ['Photosynthesis', 'Modes of nutrition', 'Parasites']],
      ['Nutrition in Animals', ['Digestion in humans', 'Digestion in other animals']],
      ['Fibre to Fabric', ['Wool', 'Silk', 'Processing fibres']],
      ['Heat', ['Temperature', 'Transfer of heat', 'Conduction, convection, radiation']],
      ['Acids, Bases and Salts', ['Indicators', 'Neutralisation', 'Uses']],
      ['Physical and Chemical Changes', ['Differences', 'Rusting', 'Crystallisation']],
      ['Weather, Climate and Adaptations', ['Elements of weather', 'Climate types', 'Adaptations']],
      ['Winds, Storms and Cyclones', ['Air pressure', 'Cyclones', 'Safety measures']],
      ['Soil', ['Profile', 'Types', 'Absorption', 'Importance']],
      ['Respiration in Organisms', ['Breathing', 'Cellular respiration', 'Anaerobic respiration']],
      ['Transportation in Animals and Plants', ['Circulatory system', 'Transport in plants']],
      ['Reproduction in Plants', ['Asexual reproduction', 'Pollination', 'Dispersal of seeds']],
      ['Motion and Time', ['Speed', 'Distance-time graph', 'Units']],
      ['Electric Current and Its Effects', ['Heating effect', 'Magnetic effect', 'Fuse']],
      ['Light', ['Reflection', 'Plane mirror', 'Spherical mirrors', 'Lenses']],
    ]),
  },
  '8': {
    Mathematics: ct([
      ['Rational Numbers', ['Properties', 'Representation on number line', 'Operations']],
      ['Linear Equations in One Variable', ['Solving equations', 'Applications', 'Word problems']],
      ['Understanding Quadrilaterals', ['Properties of polygons', 'Parallelogram', 'Rhombus']],
      ['Data Handling', ['Probability', 'Pie charts', 'Histograms', 'Grouped frequency']],
      ['Squares and Square Roots', ['Perfect squares', 'Finding square root', 'Pythagorean triplets']],
      ['Cubes and Cube Roots', ['Cubes', 'Cube roots by prime factorisation', 'Estimation']],
      ['Comparing Quantities', ['Compound interest', 'Tax', 'Depreciation', 'Growth rates']],
      ['Algebraic Expressions and Identities', ['Operations', 'Standard identities', 'Factorisation']],
      ['Mensuration', ['Perimeter and area of polygons', 'Surface area', 'Volume of cuboid and cylinder']],
      ['Exponents and Powers', ['Negative exponents', 'Laws', 'Use in science']],
      ['Direct and Inverse Proportions', ['Direct proportion', 'Inverse proportion', 'Applications']],
      ['Factorisation', ['Common factor method', 'Regrouping', 'Using identities', 'Division of polynomials']],
      ['Introduction to Graphs', ['Bar graph', 'Linear graph', 'Applications in distance-time']],
      ['Playing with Numbers', ['Generalisations', 'Puzzles', 'Divisibility tests']],
    ]),
    Science: ct([
      ['Crop Production and Management', ['Farming practices', 'Irrigation', 'Storage']],
      ['Microorganisms — Friend and Foe', ['Types', 'Useful microorganisms', 'Harmful microorganisms', 'Preservation of food']],
      ['Synthetic Fibres and Plastics', ['Types', 'Properties', 'Impact on environment']],
      ['Materials — Metals and Non-Metals', ['Physical and chemical properties', 'Reactivity', 'Uses']],
      ['Coal and Petroleum', ['Coal', 'Petroleum', 'Natural gas', 'Conservation']],
      ['Combustion and Flame', ['Types of combustion', 'Fuels', 'Calorific value', 'Flame structure']],
      ['Conservation of Plants and Animals', ['Deforestation', 'Biosphere reserve', 'Endangered species']],
      ['Cell — Structure and Functions', ['Cell organelles', 'Plant vs animal cell', 'Differences']],
      ['Reproduction in Animals', ['Types', 'Metamorphosis', 'Cloning']],
      ['Reaching the Age of Adolescence', ['Changes at puberty', 'Reproductive health', 'Hormones']],
      ['Force and Pressure', ['Types of force', 'Pressure', 'Atmospheric pressure', 'Liquids']],
      ['Friction', ['Factors', 'Static and kinetic friction', 'Applications']],
      ['Sound', ['Production', 'Propagation', 'Characteristics', 'Noise pollution']],
      ['Chemical Effects of Electric Current', ['Electrolysis', 'Electroplating']],
      ['Some Natural Phenomena', ['Lightning', 'Earthquakes', 'Protection']],
      ['Light', ['Reflection', 'Dispersion', 'Human eye', 'Braille']],
      ['Stars and the Solar System', ['Solar system', 'Stars', 'Constellations']],
      ['Pollution of Air and Water', ['Air pollution', 'Water pollution', 'Control measures']],
    ]),
  },
  '9': {
    Mathematics: ct([
      ['Number Systems', ['Irrational numbers', 'Real numbers', 'Number line', 'Operations on real numbers', 'Laws of exponents']],
      ['Polynomials', ['Definitions', 'Zeroes of polynomial', 'Remainder theorem', 'Factor theorem', 'Factorisation']],
      ['Coordinate Geometry', ['Cartesian system', 'Plotting points', 'Distance formula']],
      ['Linear Equations in Two Variables', ['Solutions', 'Graphs', 'Equations of lines']],
      ['Introduction to Euclid\'s Geometry', ['Postulates', 'Theorems', 'Proofs']],
      ['Lines and Angles', ['Basic terms', 'Parallel lines and transversal', 'Angle sum property']],
      ['Triangles', ['Congruence', 'SAS, ASA, AAS, SSS, RHS criteria', 'Properties']],
      ['Quadrilaterals', ['Properties of parallelogram', 'Mid-point theorem']],
      ['Circles', ['Angles subtended by chords', 'Cyclic quadrilateral', 'Tangent']],
      ['Heron\'s Formula', ['Area of a triangle', 'Area of quadrilateral using Heron\'s formula']],
      ['Surface Areas and Volumes', ['Cuboid', 'Cylinder', 'Cone', 'Sphere']],
      ['Statistics', ['Mean, median, mode', 'Frequency distribution', 'Graphical representation']],
      ['Probability', ['Experimental probability', 'Events', 'Equally likely outcomes']],
    ]),
    Science: ct([
      ['Matter in Our Surroundings', ['States of matter', 'Change of state', 'Evaporation', 'Sublimation']],
      ['Is Matter Around Us Pure?', ['Mixtures', 'Solutions', 'Colloids', 'Separation techniques', 'Compounds']],
      ['Atoms and Molecules', ['Laws of chemical combination', 'Atomic mass', 'Molecular formula', 'Mole concept']],
      ['Structure of the Atom', ['Subatomic particles', 'Atomic models', 'Electronic configuration', 'Valency']],
      ['The Fundamental Unit of Life', ['Cell theory', 'Cell organelles', 'Prokaryotic vs eukaryotic']],
      ['Tissues', ['Plant tissues', 'Animal tissues', 'Meristematic tissue']],
      ['Diversity in Living Organisms', ['Classification', 'Five kingdoms', 'Nomenclature']],
      ['Motion', ['Distance and displacement', 'Speed and velocity', 'Acceleration', 'Equations of motion', 'Graphs']],
      ['Force and Laws of Motion', ['Balanced and unbalanced forces', 'Newton\'s three laws', 'Momentum', 'Conservation']],
      ['Gravitation', ['Universal gravitation', 'Free fall', 'Mass vs weight', 'Pressure', 'Archimedes\' principle']],
      ['Work and Energy', ['Work', 'Energy and its forms', 'Power', 'Conservation of energy', 'Commercial unit']],
      ['Sound', ['Wave nature', 'Reflection', 'Echo', 'Resonance', 'Speed of sound', 'Hearing']],
      ['Why Do We Fall Ill', ['Health', 'Disease types', 'Infections', 'Prevention']],
      ['Natural Resources', ['Air', 'Water', 'Soil', 'Biogeochemical cycles']],
      ['Improvement in Food Resources', ['Crop improvement', 'Animal husbandry', 'Aquaculture']],
    ]),
  },
  '10': {
    Mathematics: ct([
      ['Real Numbers', ['Euclid\'s division algorithm', 'Fundamental theorem of arithmetic', 'Irrational numbers', 'Decimal expansion']],
      ['Polynomials', ['Zeroes and coefficients', 'Division algorithm', 'Sum and product of zeroes']],
      ['Pair of Linear Equations in Two Variables', ['Graphical method', 'Substitution', 'Elimination', 'Cross-multiplication', 'Reducible equations']],
      ['Quadratic Equations', ['Standard form', 'Factorisation', 'Quadratic formula', 'Nature of roots', 'Applications']],
      ['Arithmetic Progressions', ['nth term', 'Sum of AP', 'Applications']],
      ['Triangles', ['Similar triangles', 'Basic proportionality theorem', 'Pythagoras theorem', 'Areas of similar triangles']],
      ['Coordinate Geometry', ['Distance formula', 'Section formula', 'Area of triangle', 'Midpoint formula']],
      ['Introduction to Trigonometry', ['Ratios', 'Values for standard angles', 'Complementary angles', 'Identities']],
      ['Some Applications of Trigonometry', ['Heights and distances', 'Angle of elevation and depression']],
      ['Circles', ['Tangent properties', 'Tangent from external point', 'Chord-tangent relationship']],
      ['Areas Related to Circles', ['Sector and segment', 'Areas of combinations', 'Circumference']],
      ['Surface Areas and Volumes', ['Combination of solids', 'Conversion of solids', 'Frustum of cone']],
      ['Statistics', ['Mean of grouped data', 'Median from ogive', 'Mode of grouped data']],
      ['Probability', ['Classical probability', 'Complementary events', 'Applications']],
    ]),
    Science: ct([
      ['Chemical Reactions and Equations', ['Types of reactions', 'Balancing equations', 'Effects of oxidation']],
      ['Acids, Bases and Salts', ['Indicators', 'pH scale', 'Neutralisation', 'Important salts']],
      ['Metals and Non-Metals', ['Physical and chemical properties', 'Reactivity series', 'Extraction', 'Corrosion']],
      ['Carbon and Its Compounds', ['Bonding', 'Homologous series', 'Nomenclature', 'Functional groups', 'Properties']],
      ['Periodic Classification of Elements', ['Dobereiner\'s triads', 'Newlands\' octaves', 'Mendeleev\'s periodic table', 'Modern periodic table']],
      ['Life Processes', ['Nutrition', 'Respiration', 'Transportation', 'Excretion']],
      ['Control and Coordination', ['Nervous system', 'Reflex arc', 'Brain', 'Chemical coordination — hormones']],
      ['How Do Organisms Reproduce?', ['Asexual reproduction', 'Sexual reproduction', 'Reproductive health']],
      ['Heredity and Evolution', ['Mendel\'s laws', 'Sex determination', 'Evolution', 'Natural selection']],
      ['Light — Reflection and Refraction', ['Reflection', 'Mirror formula', 'Refraction', 'Lens formula', 'Power']],
      ['Human Eye and the Colourful World', ['Structure', 'Defects', 'Correction', 'Refraction through prism']],
      ['Electricity', ['Ohm\'s law', 'Resistance', 'Combination of resistors', 'Heating effect', 'Power']],
      ['Magnetic Effects of Electric Current', ['Magnetic field', 'Solenoid', 'Electromagnetic induction', 'AC generator', 'DC motor', 'Transformer']],
      ['Sources of Energy', ['Conventional sources', 'Alternative sources', 'Environmental impact']],
      ['Our Environment', ['Ecosystem', 'Food chains', 'Ozone depletion', 'Waste management']],
      ['Management of Natural Resources', ['Conservation', 'Forests', 'Water', 'Fossil fuels']],
    ]),
  },
  '11': {
    Physics: ct([
      ['Physical World and Measurement', ['Scope of physics', 'SI units', 'Significant figures', 'Dimensional analysis']],
      ['Kinematics', ['Rest and motion', 'Displacement and velocity', 'Acceleration', 'Equations of motion', 'Projectile motion', 'Uniform circular motion']],
      ['Laws of Motion', ['Newton\'s first law', 'Newton\'s second law', 'Newton\'s third law', 'Friction', 'Circular motion dynamics']],
      ['Work, Energy and Power', ['Work-energy theorem', 'Potential energy', 'Kinetic energy', 'Conservation of energy', 'Power', 'Collisions']],
      ['System of Particles and Rotational Motion', ['Centre of mass', 'Angular momentum', 'Torque', 'Moment of inertia', 'Rolling motion']],
      ['Gravitation', ['Kepler\'s laws', 'Universal law of gravitation', 'Gravitational potential energy', 'Escape velocity', 'Satellites', 'Orbital speed']],
      ['Properties of Bulk Matter', ['Elastic properties', 'Fluid mechanics', 'Bernoulli\'s theorem', 'Viscosity', 'Surface tension', 'Capillarity']],
      ['Thermodynamics', ['Thermal equilibrium', 'Zeroth law', 'First law', 'Second law', 'Heat engines', 'Refrigerators']],
      ['Kinetic Theory of Gases', ['Assumptions', 'Pressure and temperature', 'RMS speed', 'Equipartition of energy', 'Degrees of freedom', 'Mean free path']],
      ['Oscillations and Waves', ['Simple harmonic motion', 'Energy in SHM', 'Damped oscillations', 'Resonance', 'Wave motion', 'Speed of a wave', 'Principle of superposition', 'Standing waves', 'Doppler effect']],
    ]),
    Chemistry: ct([
      ['Some Basic Concepts of Chemistry', ['Mole concept', 'Atomic mass', 'Molecular mass', 'Empirical and molecular formula', 'Stoichiometry', 'Limiting reagent']],
      ['Structure of Atom', ['Subatomic particles', 'Bohr\'s model', 'Quantum numbers', 'Orbitals', 'Aufbau principle', 'Pauli exclusion', 'Hund\'s rule', 'Electronic configuration']],
      ['Classification of Elements and Periodicity', ['Mendeleev\'s table', 'Modern periodic table', 'Periodic trends']],
      ['Chemical Bonding and Molecular Structure', ['Ionic bonding', 'Covalent bonding', 'Lewis structures', 'VSEPR theory', 'Hybridisation', 'Hydrogen bonding']],
      ['States of Matter', ['Gas laws', 'Ideal gas equation', 'Kinetic molecular theory', 'Liquids', 'Solids — crystalline and amorphous']],
      ['Thermodynamics', ['System and surroundings', 'Internal energy', 'Enthalpy', 'Hess\'s law', 'Entropy', 'Gibbs energy', 'Spontaneity']],
      ['Equilibrium', ['Dynamic equilibrium', 'Law of mass action', 'Kc and Kp', 'Factors affecting equilibrium', 'Acids and bases — Arrhenius and Bronsted-Lowry', 'Buffer solutions', 'Solubility product']],
      ['Redox Reactions', ['Oxidation number', 'Types of redox reactions', 'Balancing by oxidation number method', 'Balancing by half-reaction method']],
      ['Hydrogen', ['Position in periodic table', 'Isotopes', 'Preparation', 'Properties', 'Uses', 'Water', 'Heavy water', 'Hydrogen peroxide']],
      ['The s-Block Elements', ['Group 1 — alkali metals', 'Group 2 — alkaline earth metals', 'Important compounds']],
      ['The p-Block Elements', ['Groups 13 and 14', 'Carbon family', 'Boron family', 'Important compounds']],
      ['Organic Chemistry — Basic Principles', ['Classification', 'Nomenclature', 'Isomerism', 'Inductive and resonance effects', 'Reaction mechanisms']],
      ['Hydrocarbons', ['Alkanes — preparation and properties', 'Alkenes — preparation and properties', 'Alkynes', 'Benzene', 'Conformations']],
      ['Environmental Chemistry', ['Air pollution', 'Water pollution', 'Soil pollution', 'Green chemistry']],
    ]),
    Mathematics: ct([
      ['Sets', ['Types of sets', 'Venn diagrams', 'Set operations', 'Laws of algebra of sets']],
      ['Relations and Functions', ['Cartesian product', 'Relations', 'Types of functions', 'Domain and range', 'Algebra of functions']],
      ['Trigonometric Functions', ['Angles and their measures', 'Signs of trigonometric functions', 'Identities', 'Sum and difference formulas', 'Graphs', 'Equations']],
      ['Mathematical Induction', ['Principle of mathematical induction', 'Applications']],
      ['Complex Numbers and Quadratic Equations', ['Complex numbers', 'Algebra of complex numbers', 'Argand plane', 'Polar form', 'Quadratic equations — nature of roots']],
      ['Linear Inequalities', ['Algebraic inequalities', 'Graphical representation', 'System of inequalities']],
      ['Permutations and Combinations', ['Fundamental principle', 'Permutations', 'Combinations', 'Applications']],
      ['Binomial Theorem', ['Statement', 'Expansion', 'General and middle term', 'Binomial coefficients']],
      ['Sequences and Series', ['Arithmetic progression', 'Geometric progression', 'Infinite GP', 'AM, GM, HM']],
      ['Straight Lines', ['Slope', 'Forms of equation', 'Angle between lines', 'Distance formula', 'Family of lines']],
      ['Conic Sections', ['Circle', 'Parabola', 'Ellipse', 'Hyperbola', 'Standard forms']],
      ['Introduction to 3D Geometry', ['Coordinate axes', 'Distance formula', 'Section formula']],
      ['Limits and Derivatives', ['Intuitive idea of limit', 'Algebra of limits', 'Limits of trigonometric functions', 'Derivatives', 'Algebra of derivatives']],
      ['Statistics', ['Measures of dispersion', 'Variance', 'Standard deviation', 'Mean deviation']],
      ['Probability', ['Random experiment', 'Events', 'Classical probability', 'Axiomatic probability', 'Addition theorem']],
    ]),
    Biology: ct([
      ['The Living World', ['Diversity', 'Taxonomic categories', 'Taxonomical aids']],
      ['Biological Classification', ['Five kingdoms', 'Monera', 'Protista', 'Fungi', 'Plantae', 'Animalia']],
      ['Plant Kingdom', ['Algae', 'Bryophytes', 'Pteridophytes', 'Gymnosperms', 'Angiosperms', 'Alternation of generations']],
      ['Animal Kingdom', ['Basis of classification', 'Phyla characteristics', 'Non-chordates', 'Chordates']],
      ['Morphology of Flowering Plants', ['Root', 'Stem', 'Leaf', 'Flower', 'Fruit', 'Seed', 'Families']],
      ['Anatomy of Flowering Plants', ['Tissues', 'Primary structure of dicot and monocot root, stem, leaf', 'Secondary growth']],
      ['Structural Organisation in Animals', ['Animal tissues', 'Organ systems of earthworm, cockroach, frog']],
      ['Cell — The Unit of Life', ['Prokaryotic cell', 'Eukaryotic cell', 'Nucleus', 'Cytoplasm', 'Cell organelles']],
      ['Biomolecules', ['Chemical constituents', 'Carbohydrates', 'Proteins', 'Lipids', 'Nucleic acids', 'Enzymes']],
      ['Cell Cycle and Cell Division', ['Cell cycle', 'Mitosis', 'Meiosis', 'Significance']],
      ['Transport in Plants', ['Diffusion', 'Osmosis', 'Active transport', 'Translocation', 'Transpiration']],
      ['Mineral Nutrition', ['Essential minerals', 'Deficiency symptoms', 'Hydroponics', 'Nitrogen fixation']],
      ['Photosynthesis', ['Overview', 'Light reactions', 'Photosystems', 'Calvin cycle', 'Photorespiration', 'Factors affecting']],
      ['Respiration in Plants', ['Glycolysis', 'Fermentation', 'Aerobic respiration', 'Krebs cycle', 'Respiratory quotient']],
      ['Plant Growth and Development', ['Growth phases', 'Plant growth regulators — auxin, gibberellin, cytokinin, ABA, ethylene', 'Photoperiodism', 'Vernalisation']],
      ['Digestion and Absorption', ['Alimentary canal', 'Digestive glands', 'Digestion and absorption of carbohydrates, proteins, fats', 'Disorders']],
      ['Breathing and Exchange of Gases', ['Respiratory organs', 'Mechanism of breathing', 'Respiratory volumes', 'Gas transport', 'Regulation', 'Disorders']],
      ['Body Fluids and Circulation', ['Blood composition', 'Blood groups', 'Coagulation', 'Heart', 'Cardiac cycle', 'ECG', 'Lymph']],
      ['Excretory Products and Their Elimination', ['Modes of excretion', 'Kidney structure', 'Urine formation', 'Regulation', 'Disorders']],
      ['Locomotion and Movement', ['Types of movement', 'Skeletal muscle', 'Sliding filament theory', 'Skeletal system', 'Joints', 'Disorders']],
      ['Neural Control and Coordination', ['Neuron structure', 'Impulse transmission', 'CNS and PNS', 'Reflex action', 'Sense organs']],
      ['Chemical Coordination and Integration', ['Endocrine glands', 'Hormones', 'Mechanism of hormone action', 'Disorders']],
    ]),
  },
  '12': {
    Physics: ct([
      ['Electric Charges and Fields', ['Coulomb\'s law', 'Electric field', 'Gauss\'s law', 'Dipole', 'Electric flux']],
      ['Electrostatic Potential and Capacitance', ['Electric potential', 'Equipotential surfaces', 'Capacitance', 'Combination of capacitors', 'Energy stored', 'Dielectrics']],
      ['Current Electricity', ['Electric current', 'Drift velocity', 'Ohm\'s law', 'Resistivity', 'Kirchhoff\'s rules', 'Wheatstone bridge', 'Meter bridge', 'Potentiometer']],
      ['Moving Charges and Magnetism', ['Biot-Savart law', 'Ampere\'s law', 'Moving charge in a field', 'Cyclotron', 'Galvanometer']],
      ['Magnetism and Matter', ['Bar magnet', 'Earth\'s magnetism', 'Magnetic properties of materials']],
      ['Electromagnetic Induction', ['Faraday\'s law', 'Lenz\'s law', 'Self and mutual inductance', 'AC generator']],
      ['Alternating Current', ['AC generator', 'Phasors', 'AC circuits — R, L, C', 'Resonance', 'Power factor', 'Transformer']],
      ['Electromagnetic Waves', ['Displacement current', 'EM wave characteristics', 'EM spectrum']],
      ['Ray Optics and Optical Instruments', ['Reflection', 'Refraction', 'Mirror formula', 'Lens formula', 'Total internal reflection', 'Microscopes', 'Telescopes']],
      ['Wave Optics', ['Wavefront', 'Huygens\' principle', 'Interference', 'Young\'s double slit', 'Diffraction', 'Polarisation']],
      ['Dual Nature of Radiation and Matter', ['Photoelectric effect', 'Einstein\'s equation', 'de Broglie wavelength', 'Davisson-Germer experiment']],
      ['Atoms', ['Rutherford model', 'Bohr model', 'Hydrogen spectrum', 'Atomic spectra']],
      ['Nuclei', ['Nuclear size and density', 'Nuclear binding energy', 'Radioactivity', 'Nuclear fission', 'Nuclear fusion']],
      ['Semiconductor Electronics', ['Semiconductors', 'p-n junction', 'Diode', 'LED', 'Solar cell', 'Transistor', 'Logic gates', 'Integrated circuits']],
    ]),
    Chemistry: ct([
      ['The Solid State', ['Types of solids', 'Unit cell', 'Packing efficiency', 'Crystal defects', 'Electrical and magnetic properties']],
      ['Solutions', ['Types of solutions', 'Concentration terms', 'Vapour pressure', 'Raoult\'s law', 'Colligative properties', 'van\'t Hoff factor']],
      ['Electrochemistry', ['Electrochemical cells', 'Nernst equation', 'Electrode potential', 'Electrolytic cells', 'Faraday\'s laws', 'Conductance', 'Corrosion']],
      ['Chemical Kinetics', ['Rate of reaction', 'Rate law', 'Molecularity', 'Order of reaction', 'Arrhenius equation', 'Collision theory']],
      ['Surface Chemistry', ['Adsorption', 'Catalysis', 'Classification of colloids', 'Emulsions', 'Applications']],
      ['General Principles and Processes of Isolation of Elements', ['Occurrence of metals', 'Concentration', 'Reduction methods', 'Thermodynamic principles', 'Electrochemical principles', 'Refining']],
      ['The p-Block Elements', ['Group 15 — Nitrogen family', 'Group 16 — Oxygen family', 'Group 17 — Halogens', 'Group 18 — Noble gases', 'Important compounds']],
      ['The d- and f-Block Elements', ['Transition elements — properties', 'Important compounds', 'Lanthanoids', 'Actinoids']],
      ['Coordination Compounds', ['Werner\'s theory', 'Nomenclature', 'Isomerism', 'VBT and CFT', 'Applications']],
      ['Haloalkanes and Haloarenes', ['Preparation', 'Physical and chemical properties', 'SN1 and SN2', 'Elimination reactions']],
      ['Alcohols, Phenols and Ethers', ['Preparation', 'Physical and chemical properties', 'Uses', 'Phenols', 'Ethers']],
      ['Aldehydes, Ketones and Carboxylic Acids', ['Preparation', 'Physical properties', 'Chemical reactions', 'Nucleophilic addition', 'Carboxylic acids']],
      ['Amines', ['Classification', 'Preparation', 'Properties', 'Diazonium salts — reactions']],
      ['Biomolecules', ['Carbohydrates', 'Proteins', 'Enzymes', 'Vitamins', 'Nucleic acids', 'Hormones']],
      ['Polymers', ['Classification', 'Types of polymerisation', 'Natural and synthetic polymers', 'Biodegradable polymers']],
      ['Chemistry in Everyday Life', ['Drugs and their classification', 'Drug-target interaction', 'Chemicals in food', 'Cleansing agents']],
    ]),
    Mathematics: ct([
      ['Relations and Functions', ['Types of relations', 'Types of functions', 'Composition', 'Invertible functions', 'Binary operations']],
      ['Inverse Trigonometric Functions', ['Definition', 'Domain and range', 'Principal values', 'Properties', 'Graphs']],
      ['Matrices', ['Types', 'Operations', 'Transpose', 'Symmetric matrices', 'Elementary operations', 'Invertible matrices']],
      ['Determinants', ['Properties', 'Minors and cofactors', 'Adjoint and inverse', 'Solving linear equations', 'Area of triangle']],
      ['Continuity and Differentiability', ['Continuity', 'Differentiability', 'Chain rule', 'Implicit differentiation', 'Logarithmic differentiation', 'Rolle\'s theorem', 'Mean value theorem']],
      ['Application of Derivatives', ['Rate of change', 'Increasing and decreasing functions', 'Tangents and normals', 'Approximations', 'Maxima and minima']],
      ['Integrals', ['Methods of integration', 'Integration by substitution', 'By parts', 'By partial fractions', 'Definite integrals', 'Properties', 'Fundamental theorem']],
      ['Application of Integrals', ['Area under curves', 'Area between two curves']],
      ['Differential Equations', ['Order and degree', 'Formation', 'Variable separable', 'Homogeneous equations', 'Linear equations']],
      ['Vector Algebra', ['Types of vectors', 'Operations', 'Scalar product', 'Vector product', 'Applications']],
      ['Three Dimensional Geometry', ['Direction cosines', 'Equation of a line', 'Skew lines', 'Distance', 'Equation of a plane', 'Angle between plane and line']],
      ['Linear Programming', ['Mathematical formulation', 'Graphical method', 'Feasible region', 'Optimal solution']],
      ['Probability', ['Conditional probability', 'Multiplication theorem', 'Independent events', 'Bayes\' theorem', 'Random variables', 'Bernoulli trials', 'Binomial distribution']],
    ]),
    Biology: ct([
      ['Reproduction in Organisms', ['Asexual reproduction', 'Sexual reproduction — events', 'Pre-fertilisation', 'Fertilisation', 'Post-fertilisation']],
      ['Sexual Reproduction in Flowering Plants', ['Flower structure', 'Microsporogenesis', 'Megasporogenesis', 'Pollination', 'Double fertilisation', 'Post-fertilisation — endosperm and embryo']],
      ['Human Reproduction', ['Male reproductive system', 'Female reproductive system', 'Gametogenesis', 'Menstrual cycle', 'Fertilisation and implantation', 'Pregnancy', 'Parturition', 'Lactation']],
      ['Reproductive Health', ['Reproductive health problems', 'Population explosion', 'Birth control methods', 'MTP', 'STDs', 'Infertility']],
      ['Principles of Inheritance and Variation', ['Mendel\'s laws', 'Inheritance of one gene', 'Inheritance of two genes', 'Sex determination', 'Mutations', 'Genetic disorders']],
      ['Molecular Basis of Inheritance', ['DNA structure', 'Replication', 'Transcription', 'Translation', 'Genetic code', 'Regulation of gene expression', 'Human Genome Project', 'DNA fingerprinting']],
      ['Evolution', ['Origin of life', 'Theories of evolution', 'Hardy-Weinberg principle', 'Mechanism of evolution', 'Human evolution']],
      ['Human Health and Disease', ['Common diseases', 'Immunity', 'AIDS', 'Cancer', 'Drugs and alcohol abuse']],
      ['Strategies for Enhancement in Food Production', ['Animal husbandry', 'Plant breeding', 'Tissue culture', 'Single cell proteins', 'Biofortification']],
      ['Microbes in Human Welfare', ['Microbes in household', 'Industrial products', 'Sewage treatment', 'Biogas', 'Biocontrol agents', 'Biofertilisers']],
      ['Biotechnology: Principles and Processes', ['Genetic engineering tools', 'rDNA technology', 'PCR', 'Gel electrophoresis', 'Restriction enzymes']],
      ['Biotechnology and Its Applications', ['Bt crops', 'RNAi', 'GM crops', 'Genetically engineered insulin', 'Gene therapy', 'Transgenic animals', 'Ethical issues']],
      ['Organisms and Populations', ['Organisms and environment', 'Populations — attributes and growth models', 'Population interactions']],
      ['Ecosystem', ['Structure and function', 'Productivity', 'Decomposition', 'Energy flow', 'Nutrient cycling', 'Ecological succession']],
      ['Biodiversity and Conservation', ['Biodiversity — types', 'Patterns', 'Loss of biodiversity', 'Conservation — in situ and ex situ']],
      ['Environmental Issues', ['Air and water pollution', 'Solid waste management', 'Agrochemicals', 'Ozone depletion', 'Greenhouse effect', 'Deforestation']],
    ]),
  },
};

// ICSE 9-10 separate subjects; 6-8 combined Science
const ICSE: Record<string, Record<string, Chapter[]>> = {
  '6': {
    Mathematics: ct([
      ['Number System', ['Natural numbers', 'Whole numbers', 'Integers', 'Number line']],
      ['Ratio and Proportion', ['Ratio', 'Proportion', 'Unitary method']],
      ['Algebra', ['Variables and constants', 'Algebraic expressions', 'Simple equations']],
      ['Geometry', ['Basic geometrical concepts', 'Angles', 'Triangles', 'Quadrilaterals', 'Circles']],
      ['Mensuration', ['Perimeter', 'Area of rectangle and square']],
      ['Data Handling', ['Collection of data', 'Pictographs', 'Bar graphs', 'Mean']],
    ]),
    Science: ct([
      ['Food', ['Components of food', 'Sources', 'Nutrients', 'Balanced diet']],
      ['The Flower', ['Parts of a flower', 'Pollination', 'Fertilisation']],
      ['The Leaf', ['Functions', 'Photosynthesis', 'Transpiration']],
      ['Diversity in Living Organisms', ['Classification', 'Plant and animal diversity']],
      ['Habitat and Adaptation', ['Types of habitats', 'Adaptive features']],
      ['Simple Machines', ['Types', 'Lever', 'Pulley', 'Inclined plane']],
      ['Light', ['Sources', 'Reflection', 'Shadows']],
      ['Electricity', ['Circuit', 'Conductors', 'Insulators']],
    ]),
  },
  '7': {
    Mathematics: ct([
      ['Numbers', ['Integers', 'Rational numbers', 'Fractions', 'Decimals']],
      ['Ratio and Proportion', ['Ratios', 'Proportion', 'Percentage']],
      ['Algebra', ['Algebraic expressions', 'Simple equations', 'Inequalities']],
      ['Geometry', ['Properties of triangles', 'Congruency', 'Symmetry', 'Construction']],
      ['Mensuration', ['Area and perimeter', 'Circumference of circle']],
      ['Data Handling', ['Mean, median, mode', 'Bar graphs', 'Probability introduction']],
    ]),
    Science: ct([
      ['Plant and Animal Nutrition', ['Photosynthesis', 'Nutrition in animals', 'Digestive system']],
      ['Physical and Chemical Changes', ['Types of changes', 'Rusting', 'Crystallisation']],
      ['Acids, Bases and Salts', ['Indicators', 'Properties', 'Neutralisation']],
      ['Heat', ['Temperature measurement', 'Conduction, convection, radiation']],
      ['Motion and Time', ['Types of motion', 'Speed', 'Distance-time graph']],
      ['Weather and Climate', ['Elements of weather', 'Climate zones']],
    ]),
  },
  '8': {
    Mathematics: ct([
      ['Number System', ['Rational numbers', 'Squares and square roots', 'Cubes and cube roots']],
      ['Ratio and Proportion', ['Percentage', 'Profit and loss', 'Compound interest']],
      ['Algebra', ['Algebraic identities', 'Factorisation', 'Linear equations']],
      ['Geometry', ['Quadrilaterals', 'Parallelograms', 'Constructions']],
      ['Mensuration', ['Surface area and volume', 'Cuboid and cylinder']],
      ['Data Handling', ['Pie charts', 'Histograms', 'Frequency distribution']],
    ]),
    Science: ct([
      ['Synthetic Fibres and Plastics', ['Types of synthetic fibres', 'Plastics', 'Biodegradable']],
      ['Metals and Non-Metals', ['Properties', 'Reactivity', 'Important metals']],
      ['Cell Structure', ['Cell organelles', 'Plant vs animal cell']],
      ['Reproduction', ['Asexual and sexual reproduction', 'Reproductive systems']],
      ['Force, Friction and Pressure', ['Types of force', 'Friction', 'Fluid pressure']],
      ['Sound', ['Production', 'Propagation', 'Musical instruments']],
      ['Chemical Effects of Current', ['Electrolysis', 'Electroplating']],
    ]),
  },
  '9': {
    Mathematics: ct([
      ['Rational and Irrational Numbers', ['Rational numbers', 'Irrational numbers', 'Real number line', 'Surds']],
      ['Compound Interest', ['Repeated compounding', 'CI formula', 'Growth and depreciation']],
      ['Expansions', ['Algebraic identities', '(a+b)² (a-b)² expansions', 'Cube expansion']],
      ['Factorisation', ['Common factor', 'Regrouping', 'Using identities', 'Factor theorem']],
      ['Simultaneous Linear Equations', ['Graphical method', 'Substitution', 'Elimination', 'Cross-multiplication']],
      ['Indices (Exponents)', ['Laws of indices', 'Negative exponents', 'Fractional exponents']],
      ['Logarithms', ['Definition', 'Laws of logarithms', 'Applications']],
      ['Triangles', ['Congruency', 'Properties of triangles', 'Isosceles triangle theorem']],
      ['Mid-Point and Intercept Theorems', ['Mid-point theorem', 'Converse', 'Intercept theorem']],
      ['Pythagoras Theorem', ['Statement and proof', 'Converse', 'Applications']],
      ['Rectilinear Figures', ['Quadrilaterals', 'Parallelogram properties', 'Area theorems']],
      ['Area and Perimeter of Plane Figures', ['Triangle', 'Quadrilaterals', 'Circle', 'Sector']],
      ['Statistics', ['Mean, median, mode', 'Frequency distribution', 'Graphical representation']],
    ]),
    Physics: ct([
      ['Measurements and Experimentation', ['SI units', 'Measuring instruments', 'Vernier caliper', 'Simple pendulum']],
      ['Motion in One Dimension', ['Distance and displacement', 'Speed and velocity', 'Acceleration', 'Equations of motion', 'Graphs']],
      ['Laws of Motion', ['Newton\'s three laws', 'Inertia', 'Momentum', 'F=ma', 'Conservation of momentum']],
      ['Fluids', ['Pressure in fluids', 'Buoyancy', 'Archimedes\' principle', 'Flotation', 'Atmospheric pressure']],
      ['Heat and Energy', ['Heat and temperature', 'Calorimetry', 'Change of state', 'Latent heat']],
      ['Light', ['Reflection at plane surfaces', 'Laws of reflection', 'Mirror formula', 'Reflection at curved surfaces']],
      ['Sound', ['Nature of sound', 'Propagation', 'Reflection and echo', 'Characteristics']],
      ['Electricity and Magnetism', ['Static electricity', 'Current electricity', 'Ohm\'s law', 'Magnetism', 'Magnetic effect of current']],
    ]),
    Chemistry: ct([
      ['The Language of Chemistry', ['Chemical symbols', 'Formulae', 'Chemical equations', 'Balancing']],
      ['Chemical Changes and Reactions', ['Types of reactions', 'Energy changes', 'Catalysts']],
      ['Water', ['Water cycle', 'Hard and soft water', 'Water treatment', 'Dissolved substances']],
      ['Atomic Structure and Chemical Bonding', ['Subatomic particles', 'Bohr\'s model', 'Electronic configuration', 'Ionic and covalent bonding']],
      ['The Periodic Table', ['Periods and groups', 'Periodic properties', 'Metals and non-metals']],
      ['Study of Gas Laws', ['Boyle\'s law', 'Charles\'s law', 'Gas equation']],
      ['Hydrogen', ['Laboratory preparation', 'Properties', 'Uses', 'Water of crystallisation']],
      ['Atmospheric Pollution', ['Air pollutants', 'Acid rain', 'Ozone depletion', 'Global warming']],
    ]),
    Biology: ct([
      ['Basic Biology', ['Cell as basic unit of life', 'Cell theory', 'Differences between plant and animal cells']],
      ['Cell — The Unit of Life', ['Cell organelles', 'Nucleus', 'Cell division — mitosis and meiosis']],
      ['Tissues', ['Plant tissues', 'Animal tissues', 'Functions']],
      ['The Flower', ['Structure', 'Pollination', 'Fertilisation', 'Seed and fruit formation']],
      ['Seeds', ['Structure of seeds', 'Germination conditions', 'Types of germination']],
      ['Respiration in Plants', ['Aerobic and anaerobic', 'Stages of respiration']],
      ['The Circulatory System', ['Blood', 'Blood vessels', 'Heart', 'Circulation']],
      ['The Excretory System', ['Kidney structure', 'Urine formation', 'Other excretory organs']],
      ['The Nervous System', ['Neuron', 'Brain', 'Reflex action', 'Spinal cord']],
      ['Diseases', ['Communicable and non-communicable', 'Causes', 'Prevention']],
    ]),
  },
  '10': {
    Mathematics: ct([
      ['GST (Goods and Services Tax)', ['Computation', 'Tax invoice', 'Input and output tax']],
      ['Banking', ['Recurring deposits', 'Shares and dividends']],
      ['Linear Inequations', ['Solution in one variable', 'Solution set', 'Graphing']],
      ['Quadratic Equations', ['Factorisation', 'Quadratic formula', 'Nature of roots', 'Word problems']],
      ['Ratio and Proportion', ['Componendo and dividendo', 'Direct and inverse proportion']],
      ['Matrices', ['Order of a matrix', 'Addition and subtraction', 'Multiplication']],
      ['Arithmetic and Geometric Progression', ['nth term', 'Sum of n terms', 'Applications']],
      ['Coordinate Geometry', ['Reflection', 'Section formula', 'Distance formula', 'Equation of a line']],
      ['Similarity', ['Similar triangles', 'Criteria of similarity', 'Areas of similar triangles']],
      ['Circles', ['Tangent properties', 'Intersecting chords', 'Cyclic quadrilateral']],
      ['Constructions', ['Tangent to circle from external point', 'Circumscribed and inscribed circles']],
      ['Mensuration', ['Cylinder, cone, sphere', 'Surface area and volume', 'Combination of solids']],
      ['Trigonometry', ['Trigonometric ratios', 'Heights and distances', 'Identities']],
      ['Statistics', ['Mean, median, mode of grouped data', 'Ogive', 'Quartiles']],
      ['Probability', ['Combined probability', 'Complementary events']],
    ]),
    Physics: ct([
      ['Force, Work, Power and Energy', ['Turning effect of force', 'Equilibrium', 'Work, power, energy', 'Conservation of energy']],
      ['Machines', ['Mechanical advantage', 'VR and efficiency', 'Levers', 'Pulleys', 'Inclined plane']],
      ['Refraction of Light', ['Laws of refraction', 'Refractive index', 'Total internal reflection', 'Lenses', 'Lens formula', 'Power of a lens']],
      ['Spectrum', ['Dispersion', 'Electromagnetic spectrum', 'Scattering']],
      ['Sound', ['Vibrations and waves', 'Characteristics of sound', 'Echo', 'Resonance']],
      ['Current Electricity', ['Ohm\'s law', 'Resistance combinations', 'Electrical power', 'Household circuits']],
      ['Electrical Energy and Power', ['Power and energy', 'Heating effect', 'Safety devices']],
      ['Electro-magnetism', ['Electromagnetic induction', 'Faraday\'s law', 'AC generator', 'DC motor', 'Transformer']],
      ['Nuclear Physics', ['Radioactivity', 'Nuclear fission', 'Nuclear fusion', 'Nuclear energy']],
    ]),
    Chemistry: ct([
      ['Periodic Table and Periodicity', ['Modern periodic table', 'Trends in properties', 'Metallic character']],
      ['Chemical Bonding', ['Electrovalent bonding', 'Covalent bonding', 'Properties of compounds']],
      ['Acids, Bases and Salts', ['Properties', 'pH scale', 'Neutralisation', 'Important salts']],
      ['Analytical Chemistry', ['Identification of ions', 'Action of alkalis', 'Gas tests']],
      ['Mole Concept and Stoichiometry', ['Mole concept', 'Avogadro\'s number', 'Molar volume', 'Chemical calculations']],
      ['Electrolysis', ['Electrolytes', 'Selective discharge', 'Applications', 'Electroplating']],
      ['Metallurgy', ['Occurrence of metals', 'Extraction', 'Aluminium and iron', 'Alloys']],
      ['Study of Compounds — HCl, Ammonia, Nitric Acid, Sulphuric Acid', ['Preparation', 'Properties', 'Uses']],
      ['Organic Chemistry', ['Introduction', 'Homologous series', 'IUPAC nomenclature', 'Properties of hydrocarbons']],
    ]),
    Biology: ct([
      ['Cell Division', ['Mitosis', 'Meiosis', 'Significance', 'Comparison']],
      ['Genetics', ['Mendel\'s laws', 'Monohybrid and dihybrid cross', 'Sex determination']],
      ['Absorption by Roots', ['Root structure', 'Osmosis', 'Active transport']],
      ['Transpiration', ['Process', 'Factors affecting', 'Significance']],
      ['Photosynthesis', ['Process', 'Light and dark reactions', 'Factors affecting']],
      ['The Circulatory System', ['Heart structure and function', 'Types of circulation', 'Blood composition']],
      ['The Excretory System', ['Kidney structure and function', 'Nephron', 'Formation of urine', 'Dialysis']],
      ['The Nervous System', ['CNS', 'Peripheral and autonomic NS', 'Reflex action', 'Sense organs']],
      ['The Endocrine System', ['Glands and hormones', 'Diabetes', 'Adrenalin', 'Growth hormone']],
      ['The Reproductive System', ['Male and female systems', 'Fertilisation', 'Development', 'Menstrual cycle']],
      ['Pollution', ['Air, water, noise, soil pollution', 'Acid rain', 'Effects and control']],
    ]),
  },
};

// ISC 11-12 = CBSE 11-12
const ISC: Record<string, Record<string, Chapter[]>> = {
  '11': CBSE['11'],
  '12': CBSE['12'],
};

// State Board 6-12 (Kerala SCERT pattern)
const STATE: Record<string, Record<string, Chapter[]>> = {
  '6': {
    Mathematics: ct([
      ['Numbers', ['Whole numbers', 'Integers', 'Fractions', 'Decimals']],
      ['Algebra', ['Variables', 'Simple equations']],
      ['Geometry', ['Basic shapes', 'Angles', 'Triangles']],
      ['Mensuration', ['Perimeter', 'Area']],
      ['Data Handling', ['Pictograph', 'Bar graph']],
    ]),
    Science: ct([
      ['Food and Nutrition', ['Components of food', 'Balanced diet']],
      ['The Wonderful World of Plants', ['Parts of plants', 'Photosynthesis']],
      ['Diversity of Living Things', ['Classification', 'Habitats']],
      ['Materials and Their Properties', ['Separation of substances', 'Changes in matter']],
      ['Motion and Measurement', ['Types of motion', 'Units of measurement']],
      ['Light', ['Sources', 'Shadows', 'Reflection']],
      ['Electricity', ['Circuits', 'Conductors']],
      ['Water', ['Water cycle', 'Conservation']],
    ]),
  },
  '7': {
    Mathematics: ct([
      ['Integers', ['Operations on integers', 'Properties']],
      ['Fractions and Decimals', ['Operations', 'Applications']],
      ['Algebra', ['Algebraic expressions', 'Equations']],
      ['Geometry', ['Properties of triangles', 'Congruence', 'Symmetry']],
      ['Mensuration', ['Area of parallelogram', 'Triangle', 'Circle']],
      ['Data Handling', ['Mean, median, mode', 'Probability']],
    ]),
    Science: ct([
      ['Nutrition', ['Photosynthesis', 'Digestion in animals']],
      ['Heat', ['Temperature', 'Conduction, convection, radiation']],
      ['Acids and Bases', ['Indicators', 'Neutralisation']],
      ['Respiration and Excretion', ['Breathing', 'Cellular respiration']],
      ['Reproduction in Plants', ['Vegetative propagation', 'Pollination']],
      ['Electric Current', ['Magnetic effect', 'Heating effect']],
    ]),
  },
  '8': {
    Mathematics: ct([
      ['Rational Numbers', ['Number line', 'Properties', 'Operations']],
      ['Squares, Square Roots, Cubes, Cube Roots', ['Perfect squares', 'Finding roots', 'Estimation']],
      ['Algebraic Expressions and Identities', ['Operations', 'Factorisation']],
      ['Linear Equations', ['Solving equations', 'Word problems']],
      ['Geometry', ['Quadrilaterals', 'Constructions']],
      ['Mensuration', ['Surface area and volume', 'Cylinder']],
      ['Data Handling', ['Pie charts', 'Histograms', 'Probability']],
      ['Exponents', ['Laws of exponents', 'Standard form']],
    ]),
    Science: ct([
      ['Microorganisms', ['Types', 'Useful and harmful', 'Food preservation']],
      ['Metals and Non-Metals', ['Properties', 'Reactivity', 'Uses']],
      ['Coal and Petroleum', ['Fossil fuels', 'Refining', 'Conservation']],
      ['Cell Structure and Functions', ['Cell organelles', 'Plant vs animal cell']],
      ['Reproduction', ['Asexual reproduction', 'Sexual reproduction in animals']],
      ['Force and Pressure', ['Types of force', 'Pressure in fluids']],
      ['Sound', ['Production', 'Characteristics', 'Noise pollution']],
      ['Light', ['Reflection', 'Human eye', 'Lenses']],
    ]),
  },
  '9': {
    Mathematics: ct([
      ['Polynomials', ['Types', 'Zeroes', 'Remainder and factor theorem', 'Factorisation']],
      ['Real Numbers', ['Irrational numbers', 'Decimal representation', 'Number line']],
      ['Coordinate Geometry', ['Cartesian plane', 'Plotting points']],
      ['Lines and Angles', ['Parallel lines and transversal', 'Angle sum property']],
      ['Triangles', ['Congruence', 'Properties', 'Inequalities']],
      ['Quadrilaterals', ['Properties of parallelogram', 'Mid-point theorem']],
      ['Area', ['Parallelogram and triangle areas', 'Heron\'s formula']],
      ['Circles', ['Properties', 'Chords', 'Arcs', 'Cyclic quadrilateral']],
      ['Surface Area and Volume', ['Cuboid, cylinder, cone, sphere']],
      ['Statistics', ['Mean, median, mode', 'Frequency distribution']],
      ['Probability', ['Experimental probability']],
    ]),
    Science: ct([
      ['Matter in Our Surroundings', ['States of matter', 'Change of state', 'Evaporation']],
      ['Atoms and Molecules', ['Atomic theory', 'Molecular formula', 'Mole concept']],
      ['Structure of the Atom', ['Models of atom', 'Electronic configuration', 'Valency']],
      ['Cell — The Basic Unit of Life', ['Cell organelles', 'Types of cells']],
      ['Tissues', ['Plant and animal tissues']],
      ['Motion', ['Equations of motion', 'Graphs']],
      ['Force and Laws of Motion', ['Newton\'s laws', 'Momentum', 'Conservation']],
      ['Gravitation', ['Universal gravitation', 'Free fall', 'Mass and weight']],
      ['Work and Energy', ['Work, energy, power', 'Conservation of energy']],
      ['Sound', ['Wave nature', 'Characteristics', 'Speed of sound', 'Echo']],
    ]),
  },
  '10': {
    Mathematics: ct([
      ['Arithmetic Sequences', ['nth term', 'Sum of terms', 'Applications']],
      ['Polynomials', ['Zeroes and coefficients', 'Division algorithm']],
      ['Pair of Linear Equations', ['Graphical and algebraic methods']],
      ['Second Degree Equations', ['Quadratic equations', 'Nature of roots', 'Quadratic formula']],
      ['Trigonometry', ['Trigonometric ratios', 'Heights and distances', 'Identities']],
      ['Coordinate Geometry', ['Section formula', 'Area of triangle']],
      ['Geometry and Circles', ['Tangent properties', 'Angle subtended by chord']],
      ['Solids', ['Surface area and volume', 'Combination of solids']],
      ['Statistics', ['Mean, median, mode of grouped data', 'Ogive']],
      ['Probability', ['Classical probability']],
    ]),
    Science: ct([
      ['Chemical Reactions and Equations', ['Types of reactions', 'Balancing', 'Oxidation and reduction']],
      ['Acids, Bases and Salts', ['Properties', 'pH scale', 'Important salts']],
      ['Metals and Non-Metals', ['Properties', 'Reactivity series', 'Extraction']],
      ['Carbon Compounds', ['Carbon bonding', 'Homologous series', 'Nomenclature']],
      ['Periodic Classification', ['Modern periodic table', 'Trends']],
      ['Life Processes', ['Nutrition', 'Respiration', 'Transportation', 'Excretion']],
      ['Control and Coordination', ['Nervous system', 'Hormones']],
      ['Reproduction', ['Asexual and sexual', 'Human reproduction']],
      ['Heredity and Evolution', ['Mendel\'s laws', 'Natural selection']],
      ['Light', ['Reflection and refraction', 'Lenses', 'Human eye']],
      ['Electricity', ['Ohm\'s law', 'Circuits', 'Power']],
      ['Sources of Energy', ['Conventional and non-conventional']],
    ]),
  },
  '11': CBSE['11'],
  '12': CBSE['12'],
};

// ── Calendar configurations ──────────────────────────────────
// day mapping: which days-of-week each subject gets
// 2 subjects: Math=Mon/Wed/Fri (3x), Science=Tue/Thu (2x)
// 4 subjects: Math=Mon/Thu (2x), others=Tue/Wed/Fri (1x each)
// 5 subjects (11-12): Math=Mon/Fri, Physics=Tue, Chemistry=Wed, Biology=Thu

const TWO_SUBJ_MAP: Record<string, string[]> = {
  Mathematics: ['Monday', 'Wednesday', 'Friday'],
  Science: ['Tuesday', 'Thursday'],
};

const ICSE_9_10_MAP: Record<string, string[]> = {
  Mathematics: ['Monday', 'Thursday'],
  Physics: ['Tuesday'],
  Chemistry: ['Wednesday'],
  Biology: ['Friday'],
};

const GRADE_11_12_MAP: Record<string, string[]> = {
  Mathematics: ['Monday', 'Friday'],
  Physics: ['Tuesday'],
  Chemistry: ['Wednesday'],
  Biology: ['Thursday'],
};

interface CalendarSpec {
  board: string;
  grade: string;
  category: string;
  region: string;
  subjects: { name: string; chapters: Chapter[] }[];
  dayMapping: Record<string, string[]>;
}

function buildSpecs(): CalendarSpec[] {
  const specs: CalendarSpec[] = [];

  const twoSubjects = (board: string, curriculum: Record<string, Record<string, Chapter[]>>, grades: string[]) => {
    for (const grade of grades) {
      const g = curriculum[grade];
      if (!g) continue;
      const subjects = Object.entries(g).map(([name, chapters]) => ({ name, chapters }));
      specs.push({ board, grade, category: 'Standard', region: 'India', subjects, dayMapping: TWO_SUBJ_MAP });
    }
  };

  // CBSE grades 1-10 (2 subjects each)
  twoSubjects('CBSE', CBSE, ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

  // CBSE 11-12 (4 subjects, Grade 11-12 map)
  for (const grade of ['11', '12']) {
    const g = CBSE[grade];
    const subjects = Object.entries(g).map(([name, chapters]) => ({ name, chapters }));
    specs.push({ board: 'CBSE', grade, category: 'Standard', region: 'India', subjects, dayMapping: GRADE_11_12_MAP });
  }

  // ICSE grades 6-8 (2 subjects)
  twoSubjects('ICSE', ICSE, ['6', '7', '8']);

  // ICSE grades 9-10 (4 subjects)
  for (const grade of ['9', '10']) {
    const g = ICSE[grade];
    const subjects = Object.entries(g).map(([name, chapters]) => ({ name, chapters }));
    specs.push({ board: 'ICSE', grade, category: 'Standard', region: 'India', subjects, dayMapping: ICSE_9_10_MAP });
  }

  // ISC grades 11-12
  for (const grade of ['11', '12']) {
    const g = ISC[grade];
    const subjects = Object.entries(g).map(([name, chapters]) => ({ name, chapters }));
    specs.push({ board: 'ISC', grade, category: 'Standard', region: 'India', subjects, dayMapping: GRADE_11_12_MAP });
  }

  // State Board grades 6-12
  twoSubjects('State Board', STATE, ['6', '7', '8', '9', '10']);
  for (const grade of ['11', '12']) {
    const g = STATE[grade];
    const subjects = Object.entries(g).map(([name, chapters]) => ({ name, chapters }));
    specs.push({ board: 'State Board', grade, category: 'Standard', region: 'India', subjects, dayMapping: GRADE_11_12_MAP });
  }

  return specs;
}

// ── Main seed function ──────────────────────────────────────
async function seed() {
  const client = await pool.connect();
  let imported = 0;
  let updated = 0;

  try {
    const specs = buildSpecs();
    console.log(`\nGenerating ${specs.length} academic calendars for 2026-27...`);

    for (const spec of specs) {
      const { sessions, summary } = generateSessions(spec.subjects, spec.dayMapping);
      const sessionDates = sessions.filter(s => s.type === 'session').map(s => s.date).sort();
      const startDate = sessionDates[0] ?? '2026-06-01';
      const endDate = sessionDates[sessionDates.length - 1] ?? '2027-02-28';
      const totalSessions = sessionDates.length;

      // Upsert calendar header
      const upsert = await client.query(
        `INSERT INTO academic_calendars
           (academic_year, region, grade, board, category, start_date, end_date, total_sessions, summary, source_file, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
         ON CONFLICT (academic_year, region, grade, board, category) DO UPDATE SET
           start_date      = EXCLUDED.start_date,
           end_date        = EXCLUDED.end_date,
           total_sessions  = EXCLUDED.total_sessions,
           summary         = EXCLUDED.summary,
           source_file     = EXCLUDED.source_file,
           is_active       = TRUE,
           updated_at      = NOW()
         RETURNING id, (xmax = 0) AS is_new`,
        ['2026-27', spec.region, spec.grade, spec.board, spec.category,
          startDate, endDate, totalSessions,
          JSON.stringify(summary), `generated_${spec.board.toLowerCase().replace(/\s+/g, '_')}_grade${spec.grade}`],
      );

      const row = upsert.rows[0] as { id: string; is_new: boolean };
      const calId = row.id;
      if (row.is_new) imported++; else updated++;

      // Delete old sessions
      await client.query('DELETE FROM academic_calendar_sessions WHERE calendar_id = $1', [calId]);

      // Bulk insert sessions in chunks of 200
      const subjectCounters: Record<string, number> = {};
      let sessionOrder = 0;

      for (let i = 0; i < sessions.length; i += 200) {
        const chunk = sessions.slice(i, i + 200);
        const values: unknown[] = [];
        const placeholders: string[] = [];

        for (const s of chunk) {
          sessionOrder++;
          let subjectNum: number | null = null;
          if (s.subject && s.type === 'session') {
            subjectCounters[s.subject] = (subjectCounters[s.subject] || 0) + 1;
            subjectNum = subjectCounters[s.subject];
          }
          const b = values.length;
          values.push(calId, s.date, s.day, s.subject, s.topic, s.type, sessionOrder, subjectNum);
          placeholders.push(`($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`);
        }

        await client.query(
          `INSERT INTO academic_calendar_sessions
             (calendar_id, session_date, day_of_week, subject, topic, session_type, session_order, subject_session_number)
           VALUES ${placeholders.join(',')}`,
          values,
        );
      }

      const subjLine = Object.entries(summary).map(([s, n]) => `${s}:${n}`).join(', ');
      console.log(`  ${row.is_new ? 'NEW' : 'UPD'} ${spec.board} Grade ${spec.grade} — ${totalSessions} sessions [${subjLine}]`);
    }

    console.log(`\n✓ Done — ${imported} imported, ${updated} updated.`);
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(err => { console.error(err); process.exit(1); });
