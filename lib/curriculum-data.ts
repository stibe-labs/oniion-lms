// ═══════════════════════════════════════════════════════════════
// Curriculum Data — Chapters & Topics for Indian Education Boards
// Covers CBSE, ICSE, ISC, State Board (Kerala SCERT)
// Grades 1–12, key subjects: Math, Science, Physics, Chemistry, Biology
// ═══════════════════════════════════════════════════════════════

export interface Chapter {
  name: string;
  topics: string[];
}

// board → grade → subject → Chapter[]
type CurriculumDB = Record<string, Record<string, Record<string, Chapter[]>>>;

// ── Helper: quick chapter name array → Chapter[] with empty topics ──
const ch = (names: string[]): Chapter[] => names.map(name => ({ name, topics: [] }));

// ── Helper: build Chapter[] with topics ──
const ct = (data: [string, string[]][]): Chapter[] => data.map(([name, topics]) => ({ name, topics }));

// ═══════════════════════════════════════════════════════════════
// CBSE (NCERT-based curriculum)
// ═══════════════════════════════════════════════════════════════

const CBSE: Record<string, Record<string, Chapter[]>> = {

  // ── Grade 1 ──
  '1': {
    Mathematics: ch([
      'Numbers (1 to 100)', 'Addition', 'Subtraction', 'Shapes and Space',
      'Patterns', 'Measurement', 'Time', 'Money', 'Data Handling',
    ]),
    Science: ch([
      'My Body', 'Living and Non-Living Things', 'Plants Around Us',
      'Animals Around Us', 'Food We Eat', 'Water', 'Weather and Seasons',
      'My Family', 'Our Helpers', 'Safety Rules',
    ]),
  },

  // ── Grade 2 ──
  '2': {
    Mathematics: ch([
      'Numbers up to 999', 'Addition (2-digit)', 'Subtraction (2-digit)',
      'Multiplication Introduction', 'Shapes and Patterns', 'Measurement',
      'Time and Calendar', 'Money', 'Data Handling',
    ]),
    Science: ch([
      'My Body Parts', 'Good Habits and Safety', 'Plants',
      'Animals and Their Babies', 'Food and Nutrition',
      'Water and Air', 'Weather', 'Our Surroundings', 'Transport',
    ]),
  },

  // ── Grade 3 ──
  '3': {
    Mathematics: ch([
      'Numbers up to 9999', 'Addition and Subtraction', 'Multiplication',
      'Division', 'Fractions', 'Shapes and Designs', 'Patterns',
      'Measurement (Length, Weight, Capacity)', 'Time', 'Money', 'Data Handling',
    ]),
    Science: ch([
      'Living Things and Their Surroundings', 'Plants and Their Parts',
      'Animals and Their Habitats', 'Birds', 'Food and Health',
      'Our Body (Organ Systems)', 'Water', 'Air', 'Soil', 'Light and Shadow',
      'Housing and Clothing', 'Safety and First Aid',
    ]),
  },

  // ── Grade 4 ──
  '4': {
    Mathematics: ch([
      'Large Numbers', 'Addition and Subtraction (Large Numbers)',
      'Multiplication and Division', 'Factors and Multiples',
      'Fractions', 'Decimals', 'Geometry (Shapes and Angles)',
      'Perimeter and Area', 'Patterns', 'Data Handling', 'Measurement',
    ]),
    Science: ch([
      'Organs and Organ Systems', 'Digestive System', 'Teeth and Microbes',
      'Plants — Adaptations', 'Animals — Adaptations',
      'Food and Digestion', 'Clothes We Wear', 'Air and Water',
      'Rocks and Soil', 'Our Environment', 'Force, Work, Energy',
    ]),
  },

  // ── Grade 5 ──
  '5': {
    Mathematics: ch([
      'Large Numbers and Place Value', 'Factors and Multiples',
      'Fractions', 'Decimals', 'Geometry (Angles, Triangles)',
      'Area and Perimeter', 'Volume', 'Patterns', 'Data Handling',
      'Profit and Loss', 'Measurement and Conversions',
    ]),
    Science: ch([
      'Super Senses (Animals)', 'Seeds and Seeds', 'Experiments with Water',
      'Diet and Health', 'Does It Look the Same (Symmetry)',
      'Blow Hot Blow Cold', 'Across the Wall (Germination)',
      'Mapping', 'Up You Go (Mountaineering)', 'Walls Tell Stories',
    ]),
  },

  // ── Grade 6 ──
  '6': {
    Mathematics: ct([
      ['Knowing Our Numbers', ['Comparing numbers', 'Large numbers', 'Estimation', 'Roman numerals']],
      ['Whole Numbers', ['Natural numbers', 'Whole numbers', 'Number line', 'Properties of operations']],
      ['Playing with Numbers', ['Factors and multiples', 'Prime and composite', 'Divisibility rules', 'HCF and LCM']],
      ['Basic Geometrical Ideas', ['Point, line, line segment, ray', 'Curves and polygons', 'Angles', 'Triangles and circles']],
      ['Understanding Elementary Shapes', ['Measuring line segments', 'Types of angles', 'Perpendicular lines', 'Triangles, quadrilaterals, 3D shapes']],
      ['Integers', ['Introduction to integers', 'Representation on number line', 'Addition of integers', 'Subtraction of integers']],
      ['Fractions', ['Types of fractions', 'Equivalent fractions', 'Comparing and ordering', 'Addition and subtraction']],
      ['Decimals', ['Tenths and hundredths', 'Comparing decimals', 'Addition and subtraction', 'Using decimals in daily life']],
      ['Data Handling', ['Collection of data', 'Organisation of data', 'Pictograph', 'Bar graph']],
      ['Mensuration', ['Perimeter', 'Area of rectangle and square', 'Area of irregular shapes']],
      ['Algebra', ['Introduction to variables', 'Use of variables in patterns', 'Simple equations']],
      ['Ratio and Proportion', ['Ratio', 'Proportion', 'Unitary method']],
      ['Symmetry', ['Line of symmetry', 'Lines of symmetry for regular polygons']],
      ['Practical Geometry', ['Drawing circles', 'Line segments', 'Perpendiculars', 'Angles']],
    ]),
    Science: ct([
      ['Food: Where Does It Come From?', ['Sources of food', 'Plant and animal products', 'Food habits', 'Ingredients']],
      ['Components of Food', ['Nutrients', 'Carbohydrates, proteins, fats', 'Vitamins and minerals', 'Balanced diet', 'Deficiency diseases']],
      ['Fibre to Fabric', ['Plant fibres', 'Cotton and jute', 'Spinning and weaving', 'History of clothing']],
      ['Sorting Materials into Groups', ['Properties of materials', 'Appearance', 'Hardness', 'Solubility', 'Transparency']],
      ['Separation of Substances', ['Hand picking', 'Winnowing and sieving', 'Sedimentation and decantation', 'Filtration', 'Evaporation']],
      ['Changes Around Us', ['Reversible changes', 'Irreversible changes', 'Expansion and contraction', 'Melting and freezing']],
      ['Getting to Know Plants', ['Parts of a plant', 'Herbs, shrubs, trees', 'Leaf structure', 'Root and stem', 'Flower parts']],
      ['Body Movements', ['Types of joints', 'Ball and socket joint', 'Hinge and pivot', 'Human skeletal system', 'Earthworm and snail movement']],
      ['The Living Organisms and Their Surroundings', ['Habitat', 'Adaptation', 'Biotic and abiotic', 'Terrestrial and aquatic habitats']],
      ['Motion and Measurement of Distances', ['Types of motion', 'Rectilinear, circular, periodic', 'Standard units of measurement', 'SI units']],
      ['Light, Shadows and Reflections', ['Luminous and non-luminous', 'Transparent, translucent, opaque', 'Shadow formation', 'Pinhole camera']],
      ['Electricity and Circuits', ['Electric cell', 'Electric circuit', 'Conductors and insulators', 'Electric switch']],
      ['Fun with Magnets', ['Magnetic materials', 'Poles of magnet', 'Attraction and repulsion', 'Compass']],
      ['Water', ['Sources of water', 'Water cycle', 'Evaporation and condensation', 'Water conservation']],
      ['Air Around Us', ['Composition of air', 'Oxygen and nitrogen', 'Carbon dioxide', 'Water vapour in air']],
      ['Garbage In, Garbage Out', ['Waste management', 'Composting', 'Vermicomposting', 'Recycling', 'Reduce, reuse']],
    ]),
  },

  // ── Grade 7 ──
  '7': {
    Mathematics: ct([
      ['Integers', ['Properties of integers', 'Addition and subtraction', 'Multiplication and division']],
      ['Fractions and Decimals', ['Multiplication of fractions', 'Division of fractions', 'Decimal operations']],
      ['Data Handling', ['Collecting and organising data', 'Arithmetic mean', 'Bar graphs', 'Probability']],
      ['Simple Equations', ['Setting up equations', 'Solving equations', 'Applications']],
      ['Lines and Angles', ['Pairs of angles', 'Parallel lines and transversal', 'Properties of angles']],
      ['The Triangle and Its Properties', ['Medians and altitudes', 'Exterior angle property', 'Angle sum property', 'Pythagoras theorem']],
      ['Congruence of Triangles', ['Congruent figures', 'SSS, SAS, ASA', 'RHS congruence rule']],
      ['Comparing Quantities', ['Ratios', 'Percentage', 'Profit and loss', 'Simple interest']],
      ['Rational Numbers', ['Need for rational numbers', 'Operations on rational numbers', 'Number line']],
      ['Practical Geometry', ['Constructing parallel lines', 'Constructing triangles']],
      ['Perimeter and Area', ['Area of parallelogram', 'Area of triangle', 'Circles — circumference and area']],
      ['Algebraic Expressions', ['Terms and coefficients', 'Like and unlike terms', 'Addition and subtraction']],
      ['Exponents and Powers', ['Laws of exponents', 'Standard form', 'Comparing using exponents']],
      ['Symmetry', ['Lines of symmetry', 'Rotational symmetry']],
      ['Visualising Solid Shapes', ['Faces, edges, vertices', 'Nets of 3D shapes', 'Drawing solids']],
    ]),
    Science: ct([
      ['Nutrition in Plants', ['Photosynthesis', 'Autotrophic nutrition', 'Other modes of nutrition', 'Saprophytes and parasites']],
      ['Nutrition in Animals', ['Types of nutrition', 'Human digestive system', 'Digestion in grass-eating animals', 'Amoeba feeding']],
      ['Fibre to Fabric', ['Animal fibres', 'Wool', 'Silk', 'Processing fibres']],
      ['Heat', ['Hot and cold', 'Measuring temperature', 'Conduction, convection, radiation', 'Clothing and climate']],
      ['Acids, Bases and Salts', ['Indicators', 'Natural indicators', 'Neutralisation', 'Uses in daily life']],
      ['Physical and Chemical Changes', ['Physical changes', 'Chemical changes', 'Rusting of iron', 'Crystallisation']],
      ['Weather, Climate and Adaptations', ['Weather elements', 'Climate', 'Climate and adaptation', 'Polar and tropical regions']],
      ['Winds, Storms and Cyclones', ['Air pressure', 'Wind currents', 'Thunderstorms and cyclones', 'Safety measures']],
      ['Soil', ['Soil profile', 'Types of soil', 'Properties', 'Soil and crops', 'Soil erosion']],
      ['Respiration in Organisms', ['Why we respire', 'Breathing', 'Breathing in organisms', 'Anaerobic respiration']],
      ['Transportation in Animals and Plants', ['Circulatory system', 'Blood and blood vessels', 'Heartbeat', 'Transport in plants']],
      ['Reproduction in Plants', ['Vegetative propagation', 'Budding', 'Fragmentation', 'Spore formation', 'Seed formation']],
      ['Motion and Time', ['Speed', 'Measurement of time', 'Distance-time graph', 'Simple pendulum']],
      ['Electric Current and Its Effects', ['Symbols in circuits', 'Heating effect', 'Magnetic effect', 'Electromagnet']],
      ['Light', ['Reflection of light', 'Plane mirror image', 'Spherical mirrors', 'Lenses', 'Sunlight and colours']],
      ['Water: A Precious Resource', ['Water availability', 'Groundwater', 'Water management', 'Rainwater harvesting']],
      ['Forests: Our Lifeline', ['Importance of forests', 'Forest ecosystem', 'Deforestation', 'Conservation']],
      ['Wastewater Story', ['Water treatment', 'Sewage treatment', 'Sanitation', 'Alternative arrangements']],
    ]),
  },

  // ── Grade 8 ──
  '8': {
    Mathematics: ct([
      ['Rational Numbers', ['Properties of rational numbers', 'Number line representation', 'Between two rational numbers']],
      ['Linear Equations in One Variable', ['Solving equations', 'Equations with variables on both sides', 'Word problems']],
      ['Understanding Quadrilaterals', ['Polygons', 'Types of quadrilaterals', 'Properties', 'Angle sum property']],
      ['Practical Geometry', ['Constructing quadrilaterals given different measurements']],
      ['Data Handling', ['Organising data', 'Pie charts', 'Probability', 'Chance and probability']],
      ['Squares and Square Roots', ['Perfect squares', 'Properties', 'Finding square roots', 'Estimation']],
      ['Cubes and Cube Roots', ['Perfect cubes', 'Cube roots', 'Estimation of cube roots']],
      ['Comparing Quantities', ['Ratios and percentages', 'Increase/decrease percent', 'Discount', 'Compound interest']],
      ['Algebraic Expressions and Identities', ['Expressions', 'Multiplication', 'Standard identities', 'Applying identities']],
      ['Visualising Solid Shapes', ['Views of 3D shapes', 'Mapping', 'Faces, edges, vertices — Euler formula']],
      ['Mensuration', ['Area of trapezium', 'Area of quadrilateral', 'Surface area of cube and cuboid', 'Volume']],
      ['Exponents and Powers', ['Negative exponents', 'Laws of exponents', 'Standard form of large/small numbers']],
      ['Direct and Inverse Proportions', ['Direct proportion', 'Inverse proportion', 'Applications']],
      ['Factorisation', ['Common factors', 'Regrouping', 'Using identities', 'Division of polynomials']],
      ['Introduction to Graphs', ['Bar graphs, pie charts, histograms', 'Linear graphs', 'Applications']],
      ['Playing with Numbers', ['Numbers in general form', 'Tests of divisibility', 'Puzzles and games']],
    ]),
    Science: ct([
      ['Crop Production and Management', ['Agricultural practices', 'Kharif and rabi crops', 'Soil preparation', 'Irrigation', 'Harvesting']],
      ['Microorganisms: Friend and Foe', ['Types of microorganisms', 'Useful microorganisms', 'Harmful microorganisms', 'Food preservation', 'Nitrogen fixation']],
      ['Synthetic Fibres and Plastics', ['Types of synthetic fibres', 'Characteristics', 'Plastics', 'Biodegradable vs non-biodegradable']],
      ['Materials: Metals and Non-Metals', ['Physical properties', 'Chemical properties', 'Reactivity series', 'Uses']],
      ['Coal and Petroleum', ['Natural resources', 'Coal formation', 'Petroleum refining', 'Conservation']],
      ['Combustion and Flame', ['Combustion', 'Types of combustion', 'Flame structure', 'Fuel efficiency']],
      ['Conservation of Plants and Animals', ['Deforestation', 'Biodiversity', 'Flora and fauna', 'Wildlife sanctuaries', 'Endangered species']],
      ['Cell — Structure and Functions', ['Cell discovery', 'Cell organelles', 'Plant vs animal cell', 'Prokaryotic and eukaryotic']],
      ['Reproduction in Animals', ['Modes of reproduction', 'Sexual reproduction', 'Asexual reproduction', 'Cloning']],
      ['Reaching the Age of Adolescence', ['Puberty', 'Changes during adolescence', 'Hormones', 'Reproductive health']],
      ['Force and Pressure', ['Force — push and pull', 'Friction', 'Gravitational force', 'Pressure', 'Atmospheric pressure']],
      ['Friction', ['Force of friction', 'Factors affecting friction', 'Increasing and reducing friction', 'Fluid friction']],
      ['Sound', ['Sound production', 'Propagation', 'Characteristics', 'Noise and music', 'Noise pollution']],
      ['Chemical Effects of Electric Current', ['Conductors and insulators', 'Chemical effects', 'Electroplating']],
      ['Some Natural Phenomena', ['Lightning', 'Charging by rubbing', 'Earthquakes', 'Safety during natural disasters']],
      ['Light', ['Reflection', 'Laws of reflection', 'Regular and diffused', 'Multiple reflection', 'Human eye', 'Braille']],
      ['Stars and the Solar System', ['Moon', 'Stars and constellations', 'Solar system', 'Planets', 'Asteroids and comets']],
      ['Pollution of Air and Water', ['Air pollution', 'Greenhouse effect', 'Water pollution', 'Potable water', 'Conservation']],
    ]),
  },

  // ── Grade 9 ──
  '9': {
    Mathematics: ct([
      ['Number Systems', ['Irrational numbers', 'Real numbers and their decimal expansions', 'Number line operations', 'Laws of exponents for real numbers']],
      ['Polynomials', ['Polynomials in one variable', 'Zeroes of a polynomial', 'Remainder theorem', 'Factorisation', 'Algebraic identities']],
      ['Coordinate Geometry', ['Cartesian system', 'Plotting a point', 'Quadrants', 'Linear equation as a line']],
      ['Linear Equations in Two Variables', ['Linear equations', 'Solution of a linear equation', 'Graph of a linear equation']],
      ['Introduction to Euclid\'s Geometry', ['Euclid\'s definitions, axioms and postulates', 'Equivalent versions of Euclid\'s fifth postulate']],
      ['Lines and Angles', ['Basic terms', 'Intersecting and non-intersecting lines', 'Pairs of angles', 'Parallel lines and transversal', 'Angle sum property of a triangle']],
      ['Triangles', ['Congruence of triangles', 'Criteria: SAS, ASA, SSS, RHS', 'Properties of isosceles triangle', 'Inequalities in a triangle']],
      ['Quadrilaterals', ['Angle sum property', 'Types of quadrilaterals', 'Properties of parallelogram', 'Mid-point theorem']],
      ['Areas of Parallelograms and Triangles', ['Same base and between same parallels', 'Area of parallelogram', 'Triangles on same base']],
      ['Circles', ['Circle terminology', 'Angle subtended by a chord', 'Perpendicular from centre to chord', 'Cyclic quadrilateral']],
      ['Constructions', ['Bisector of a line segment', 'Bisector of an angle', 'Constructing triangles']],
      ['Heron\'s Formula', ['Area using Heron\'s formula', 'Application to quadrilaterals']],
      ['Surface Areas and Volumes', ['Surface area of cuboid, cylinder, cone, sphere', 'Volume of cuboid, cylinder, cone, sphere']],
      ['Statistics', ['Collection of data', 'Frequency distribution', 'Mean, median, mode', 'Bar graphs and histograms']],
      ['Probability', ['Experimental probability', 'Empirical probability', 'Events and outcomes']],
    ]),
    Science: ct([
      ['Matter in Our Surroundings', ['Physical nature of matter', 'Characteristics of particles', 'States of matter', 'Change of state', 'Evaporation']],
      ['Is Matter Around Us Pure?', ['Mixtures', 'Solutions, suspensions, colloids', 'Separation techniques', 'Physical and chemical changes', 'Types of pure substances']],
      ['Atoms and Molecules', ['Laws of chemical combination', 'Dalton\'s atomic theory', 'Atoms and molecules', 'Atomic mass', 'Molecular formula', 'Mole concept']],
      ['Structure of the Atom', ['Charged particles in matter', 'Thomson and Rutherford models', 'Bohr\'s model', 'Neutrons', 'Electronic configuration', 'Valency']],
      ['The Fundamental Unit of Life', ['Cell theory', 'Cell organelles', 'Plasma membrane', 'Nucleus', 'Cytoplasm', 'Plant vs animal cell']],
      ['Tissues', ['Plant tissues — meristematic and permanent', 'Animal tissues — epithelial, connective, muscular, nervous']],
      ['Diversity in Living Organisms', ['Basis of classification', 'Hierarchy of classification', 'Five kingdoms', 'Plant and animal kingdom divisions']],
      ['Motion', ['Distance and displacement', 'Speed and velocity', 'Acceleration', 'Equations of motion', 'Graphical representation', 'Circular motion']],
      ['Force and Laws of Motion', ['Balanced and unbalanced forces', 'First law of motion (inertia)', 'Second law (F=ma)', 'Third law', 'Conservation of momentum']],
      ['Gravitation', ['Universal law of gravitation', 'Free fall', 'Acceleration due to gravity', 'Mass and weight', 'Thrust and pressure', 'Archimedes\' principle']],
      ['Work and Energy', ['Work', 'Energy — kinetic and potential', 'Law of conservation of energy', 'Power', 'Commercial unit of energy']],
      ['Sound', ['Production of sound', 'Propagation', 'Characteristics — amplitude, frequency, speed', 'Reflection of sound', 'Echo', 'Ultrasound', 'Human ear']],
      ['Why Do We Fall Ill?', ['Health and disease', 'Acute and chronic diseases', 'Infectious and non-infectious', 'Means of spread', 'Prevention and treatment']],
      ['Natural Resources', ['Air, water, soil', 'Biogeochemical cycles', 'Water cycle', 'Nitrogen cycle', 'Carbon cycle', 'Ozone layer']],
      ['Improvement in Food Resources', ['Improvement in crop yields', 'Animal husbandry', 'Poultry farming', 'Fish production', 'Bee keeping']],
    ]),
  },

  // ── Grade 10 ──
  '10': {
    Mathematics: ct([
      ['Real Numbers', ['Euclid\'s division lemma', 'Fundamental theorem of arithmetic', 'Revisiting irrational numbers', 'Revisiting rational numbers and their decimal expansions']],
      ['Polynomials', ['Geometrical meaning of zeroes', 'Relationship between zeroes and coefficients', 'Division algorithm for polynomials']],
      ['Pair of Linear Equations in Two Variables', ['Graphical method', 'Algebraic methods — substitution', 'Elimination method', 'Cross-multiplication', 'Consistency of equations']],
      ['Quadratic Equations', ['Standard form', 'Solution by factorisation', 'Completing the square', 'Quadratic formula', 'Nature of roots']],
      ['Arithmetic Progressions', ['nth term of an AP', 'Sum of first n terms', 'Applications']],
      ['Triangles', ['Similar figures', 'Similarity criteria — AA, SSS, SAS', 'Areas of similar triangles', 'Pythagoras theorem and converse']],
      ['Coordinate Geometry', ['Distance formula', 'Section formula', 'Area of a triangle']],
      ['Introduction to Trigonometry', ['Trigonometric ratios', 'Ratios of specific angles', 'Complementary angles', 'Trigonometric identities']],
      ['Some Applications of Trigonometry', ['Heights and distances', 'Angle of elevation', 'Angle of depression']],
      ['Circles', ['Tangent to a circle', 'Number of tangents from a point', 'Theorems on tangents']],
      ['Constructions', ['Division of a line segment', 'Tangents to a circle']],
      ['Areas Related to Circles', ['Perimeter and area of a circle', 'Area of sector and segment', 'Areas of combinations of plane figures']],
      ['Surface Areas and Volumes', ['Combination of solids', 'Conversion of solids', 'Frustum of a cone']],
      ['Statistics', ['Mean of grouped data', 'Mode of grouped data', 'Median of grouped data', 'Ogive (cumulative frequency graph)']],
      ['Probability', ['Classical probability', 'Complementary events', 'Impossible and sure events']],
    ]),
    Science: ct([
      ['Chemical Reactions and Equations', ['Chemical equations', 'Balancing equations', 'Types of reactions — combination, decomposition, displacement', 'Oxidation and reduction']],
      ['Acids, Bases and Salts', ['Chemical properties', 'Indicators', 'Reaction with metals', 'Neutralisation', 'pH scale', 'Salts — preparation and uses']],
      ['Metals and Non-metals', ['Physical properties', 'Chemical properties', 'Reactivity series', 'Ionic bonding', 'Occurrence and extraction', 'Corrosion']],
      ['Carbon and Its Compounds', ['Bonding in carbon', 'Versatile nature of carbon', 'Homologous series', 'Nomenclature', 'Chemical properties', 'Ethanol and ethanoic acid', 'Soaps and detergents']],
      ['Periodic Classification of Elements', ['Early attempts', 'Mendeleev\'s periodic table', 'Modern periodic table', 'Trends in properties']],
      ['Life Processes', ['Nutrition — autotrophic and heterotrophic', 'Respiration', 'Transportation', 'Excretion']],
      ['Control and Coordination', ['Nervous system', 'Reflex actions', 'Human brain', 'Coordination in plants', 'Hormones']],
      ['How Do Organisms Reproduce?', ['Modes of reproduction', 'Asexual reproduction', 'Sexual reproduction in plants', 'Reproduction in humans', 'Reproductive health']],
      ['Heredity and Evolution', ['Accumulation of variation', 'Heredity — Mendel\'s laws', 'Dominant and recessive traits', 'Sex determination', 'Evolution — natural selection', 'Speciation']],
      ['Light — Reflection and Refraction', ['Reflection', 'Spherical mirrors', 'Mirror formula', 'Refraction', 'Refractive index', 'Lens formula', 'Power of a lens']],
      ['The Human Eye and the Colourful World', ['Human eye', 'Defects of vision', 'Refraction through prism', 'Dispersion', 'Atmospheric refraction', 'Scattering of light']],
      ['Electricity', ['Electric current', 'Potential difference', 'Ohm\'s law', 'Resistance', 'Series and parallel', 'Heating effect', 'Electric power']],
      ['Magnetic Effects of Electric Current', ['Magnetic field', 'Field due to current', 'Force on conductor', 'Electric motor', 'Electromagnetic induction', 'Electric generator', 'DC vs AC']],
      ['Sources of Energy', ['Conventional sources', 'Fossil fuels', 'Thermal and hydro power', 'Biomass', 'Wind', 'Solar energy', 'Nuclear energy']],
      ['Our Environment', ['Ecosystem', 'Food chains and webs', 'Ozone depletion', 'Waste management']],
      ['Management of Natural Resources', ['Conservation strategies', 'Forests and wildlife', 'Water harvesting', 'Coal and petroleum', 'Sustainable development']],
    ]),
  },

  // ── Grade 11 ──
  '11': {
    Physics: ct([
      ['Physical World', ['Scope of physics', 'Fundamental forces', 'Nature of physical laws']],
      ['Units and Measurements', ['SI units', 'Significant figures', 'Dimensional analysis', 'Errors in measurement']],
      ['Motion in a Straight Line', ['Position, displacement', 'Speed and velocity', 'Acceleration', 'Kinematic equations', 'Relative velocity']],
      ['Motion in a Plane', ['Scalars and vectors', 'Vector addition', 'Resolution of vectors', 'Projectile motion', 'Uniform circular motion']],
      ['Laws of Motion', ['Newton\'s first, second, third laws', 'Momentum', 'Impulse', 'Friction', 'Circular motion dynamics']],
      ['Work, Energy and Power', ['Work-energy theorem', 'Kinetic and potential energy', 'Conservation of energy', 'Power', 'Collisions']],
      ['System of Particles and Rotational Motion', ['Centre of mass', 'Torque', 'Angular momentum', 'Moment of inertia', 'Rolling motion']],
      ['Gravitation', ['Kepler\'s laws', 'Universal law of gravitation', 'Gravitational field', 'Potential energy', 'Escape velocity', 'Satellites']],
      ['Mechanical Properties of Solids', ['Stress and strain', 'Hooke\'s law', 'Elastic moduli', 'Stress-strain curve']],
      ['Mechanical Properties of Fluids', ['Pressure', 'Pascal\'s law', 'Bernoulli\'s principle', 'Viscosity', 'Surface tension']],
      ['Thermal Properties of Matter', ['Temperature', 'Thermal expansion', 'Specific heat', 'Calorimetry', 'Change of state', 'Heat transfer']],
      ['Thermodynamics', ['Thermal equilibrium', 'Zeroth law', 'First law', 'Specific heat capacities', 'Second law', 'Heat engines', 'Carnot engine']],
      ['Kinetic Theory', ['Molecular nature of matter', 'Gas laws', 'Kinetic theory of an ideal gas', 'Mean free path', 'Degrees of freedom']],
      ['Oscillations', ['Periodic and oscillatory motion', 'SHM', 'Energy in SHM', 'Damped oscillations', 'Forced oscillations and resonance']],
      ['Waves', ['Transverse and longitudinal', 'Speed of wave', 'Superposition principle', 'Standing waves', 'Beats', 'Doppler effect']],
    ]),
    Chemistry: ct([
      ['Some Basic Concepts of Chemistry', ['Importance of chemistry', 'Atomic and molecular masses', 'Mole concept', 'Percentage composition', 'Empirical and molecular formulae', 'Stoichiometry']],
      ['Structure of Atom', ['Subatomic particles', 'Thomson, Rutherford, Bohr models', 'Quantum mechanical model', 'Quantum numbers', 'Aufbau principle', 'Electronic configuration']],
      ['Classification of Elements and Periodicity in Properties', ['Genesis of classification', 'Modern periodic law', 'Nomenclature', 'Electronic configuration and periodic table', 'Periodic trends']],
      ['Chemical Bonding and Molecular Structure', ['Ionic bond', 'Covalent bond', 'Lewis structures', 'VSEPR theory', 'Hybridisation', 'Molecular orbital theory']],
      ['States of Matter', ['Intermolecular interactions', 'Gas laws', 'Ideal gas equation', 'Kinetic molecular theory', 'Liquids — vapour pressure, viscosity, surface tension']],
      ['Thermodynamics', ['System and surroundings', 'Internal energy', 'Enthalpy', 'Hess\'s law', 'Entropy', 'Gibbs energy', 'Spontaneity']],
      ['Equilibrium', ['Chemical equilibrium', 'Le Chatelier\'s principle', 'Ionic equilibrium', 'Acids and bases', 'Buffer solutions', 'Solubility product']],
      ['Redox Reactions', ['Oxidation and reduction', 'Oxidation number', 'Balancing redox equations', 'Electrode processes']],
      ['Hydrogen', ['Position in periodic table', 'Isotopes', 'Preparation and properties', 'Water', 'Hydrogen peroxide']],
      ['The s-Block Elements', ['Group 1 — alkali metals', 'Group 2 — alkaline earth metals', 'General characteristics', 'Important compounds']],
      ['The p-Block Elements', ['Group 13 and 14 elements', 'General introduction', 'Important compounds', 'Allotropy']],
      ['Organic Chemistry — Some Basic Principles and Techniques', ['Purification methods', 'Qualitative and quantitative analysis', 'Classification', 'IUPAC nomenclature', 'Isomerism', 'Reaction mechanisms']],
      ['Hydrocarbons', ['Alkanes', 'Alkenes', 'Alkynes', 'Aromatic hydrocarbons', 'Carcinogenicity']],
      ['Environmental Chemistry', ['Air pollution', 'Water pollution', 'Soil pollution', 'Industrial waste', 'Green chemistry']],
    ]),
    Mathematics: ct([
      ['Sets', ['Types of sets', 'Subsets', 'Venn diagrams', 'Set operations', 'Complement']],
      ['Relations and Functions', ['Cartesian product', 'Relations', 'Functions', 'Domain, co-domain, range']],
      ['Trigonometric Functions', ['Angles', 'Trigonometric functions', 'Signs of functions', 'Graphs', 'Trigonometric identities', 'Equations']],
      ['Principle of Mathematical Induction', ['Process of the proof', 'Applications', 'Motivation']],
      ['Complex Numbers and Quadratic Equations', ['Complex numbers', 'Algebra of complex numbers', 'Modulus and conjugate', 'Argand plane', 'Quadratic equations']],
      ['Linear Inequalities', ['Inequalities', 'Algebraic solutions', 'Graphical solution', 'System of inequalities']],
      ['Permutations and Combinations', ['Fundamental principle of counting', 'Permutations', 'Combinations']],
      ['Binomial Theorem', ['Binomial theorem for positive integers', 'General and middle terms']],
      ['Sequences and Series', ['Arithmetic progression', 'Geometric progression', 'Sum to n terms', 'Arithmetic and geometric means']],
      ['Straight Lines', ['Slope of a line', 'Various forms of equations', 'Distance of a point from a line']],
      ['Conic Sections', ['Circle', 'Parabola', 'Ellipse', 'Hyperbola']],
      ['Introduction to Three Dimensional Geometry', ['Coordinate axes and planes', 'Distance between two points', 'Section formula']],
      ['Limits and Derivatives', ['Intuitive idea of limits', 'Limits', 'Derivatives', 'First principle']],
      ['Mathematical Reasoning', ['Statements', 'Connectives', 'Quantifiers', 'Implications', 'Validating statements']],
      ['Statistics', ['Measures of dispersion', 'Range', 'Mean deviation', 'Variance and standard deviation']],
      ['Probability', ['Random experiments', 'Events', 'Axiomatic approach', 'Addition rule']],
    ]),
    Biology: ct([
      ['The Living World', ['Characteristics of living organisms', 'Diversity in the living world', 'Taxonomic categories', 'Nomenclature', 'Taxonomical aids']],
      ['Biological Classification', ['Five kingdom classification', 'Monera', 'Protista', 'Fungi', 'Plantae', 'Animalia', 'Viruses and lichens']],
      ['Plant Kingdom', ['Algae', 'Bryophytes', 'Pteridophytes', 'Gymnosperms', 'Angiosperms', 'Life cycles']],
      ['Animal Kingdom', ['Basis of classification', 'Porifera to Chordata', 'Non-chordates', 'Chordates']],
      ['Morphology of Flowering Plants', ['Root', 'Stem', 'Leaf', 'Inflorescence', 'Flower', 'Fruit', 'Seed', 'Floral formula']],
      ['Anatomy of Flowering Plants', ['Tissues — meristematic and permanent', 'Tissue system', 'Anatomy of monocot and dicot', 'Secondary growth']],
      ['Structural Organisation in Animals', ['Animal tissues', 'Organ and organ systems', 'Earthworm, cockroach, frog morphology']],
      ['Cell: The Unit of Life', ['Cell theory', 'Prokaryotic cell', 'Eukaryotic cell', 'Cell organelles', 'Cell membrane']],
      ['Biomolecules', ['Carbohydrates', 'Proteins', 'Lipids', 'Nucleic acids', 'Enzymes']],
      ['Cell Cycle and Cell Division', ['Cell cycle', 'Mitosis', 'Meiosis', 'Significance']],
      ['Transport in Plants', ['Means of transport', 'Osmosis', 'Plasmolysis', 'Transpiration', 'Uptake of mineral nutrients']],
      ['Mineral Nutrition', ['Essential minerals', 'Role of macro and micronutrients', 'Deficiency symptoms', 'Nitrogen metabolism']],
      ['Photosynthesis in Higher Plants', ['Early experiments', 'Light reactions', 'Dark reactions — Calvin cycle', 'C3 and C4 pathways', 'Photorespiration']],
      ['Respiration in Plants', ['Glycolysis', 'Fermentation', 'Krebs cycle', 'Electron transport chain', 'Respiratory quotient']],
      ['Plant Growth and Development', ['Growth phases', 'Growth regulators — auxin, gibberellin, cytokinin, ethylene, ABA', 'Photoperiodism', 'Vernalisation']],
      ['Digestion and Absorption', ['Human digestive system', 'Digestion of food', 'Absorption', 'Disorders of digestive system']],
      ['Breathing and Exchange of Gases', ['Respiratory organs', 'Mechanism of breathing', 'Exchange of gases', 'Transport of gases', 'Respiratory disorders']],
      ['Body Fluids and Circulation', ['Blood', 'Lymph', 'Human circulatory system', 'Double circulation', 'Cardiac cycle', 'ECG', 'Disorders']],
      ['Excretory Products and Their Elimination', ['Human excretory system', 'Urine formation', 'Regulation of kidney function', 'Role of other organs', 'Disorders']],
      ['Locomotion and Movement', ['Types of movement', 'Skeletal system', 'Joints', 'Muscle — structure and contraction', 'Disorders of muscular and skeletal system']],
      ['Neural Control and Coordination', ['Nervous system', 'Neuron', 'Reflex arc', 'Central nervous system', 'Sensory organs — eye, ear']],
      ['Chemical Coordination and Integration', ['Endocrine glands and hormones', 'Hypothalamus', 'Pituitary', 'Thyroid', 'Adrenal', 'Pancreas', 'Gonads']],
    ]),
  },

  // ── Grade 12 ──
  '12': {
    Physics: ct([
      ['Electric Charges and Fields', ['Electric charge', 'Coulomb\'s law', 'Electric field', 'Electric dipole', 'Gauss\'s theorem']],
      ['Electrostatic Potential and Capacitance', ['Electrostatic potential', 'Potential due to point charge and dipole', 'Equipotential surfaces', 'Capacitors', 'Dielectrics']],
      ['Current Electricity', ['Electric current', 'Ohm\'s law', 'Resistivity', 'Cells — EMF, internal resistance', 'Kirchhoff\'s rules', 'Wheatstone bridge', 'Metre bridge']],
      ['Moving Charges and Magnetism', ['Magnetic force', 'Motion in magnetic field', 'Biot-Savart law', 'Ampere\'s law', 'Solenoid', 'Galvanometer']],
      ['Magnetism and Matter', ['Bar magnet as dipole', 'Magnetic field lines', 'Earth\'s magnetism', 'Diamagnetic, paramagnetic, ferromagnetic']],
      ['Electromagnetic Induction', ['Faraday\'s law', 'Lenz\'s law', 'Motional EMF', 'Eddy currents', 'Self and mutual inductance']],
      ['Alternating Current', ['AC voltage', 'LCR circuit', 'Resonance', 'Power in AC', 'Transformers']],
      ['Electromagnetic Waves', ['Displacement current', 'EM spectrum', 'Properties of EM waves']],
      ['Ray Optics and Optical Instruments', ['Reflection and refraction', 'Total internal reflection', 'Lenses', 'Prisms', 'Microscopes', 'Telescopes']],
      ['Wave Optics', ['Huygens principle', 'Interference — Young\'s experiment', 'Diffraction', 'Polarisation']],
      ['Dual Nature of Radiation and Matter', ['Photoelectric effect', 'Einstein\'s equation', 'Matter waves — de Broglie', 'Davisson-Germer experiment']],
      ['Atoms', ['Alpha particle scattering', 'Bohr model', 'Hydrogen spectrum', 'Line spectra']],
      ['Nuclei', ['Nuclear size and composition', 'Mass-energy relation', 'Nuclear binding energy', 'Radioactivity', 'Nuclear fission and fusion']],
      ['Semiconductor Electronics', ['Energy bands', 'Semiconductor diode', 'Junction diode as rectifier', 'Zener diode', 'Transistors', 'Logic gates']],
    ]),
    Chemistry: ct([
      ['The Solid State', ['Amorphous and crystalline', 'Crystal lattices', 'Unit cell', 'Packing efficiency', 'Imperfections', 'Electrical and magnetic properties']],
      ['Solutions', ['Types of solutions', 'Concentration', 'Solubility', 'Colligative properties', 'Raoult\'s law', 'Abnormal molar masses']],
      ['Electrochemistry', ['Electrochemical cells', 'Nernst equation', 'Conductance', 'Electrolysis', 'Batteries', 'Corrosion']],
      ['Chemical Kinetics', ['Rate of reaction', 'Factors affecting rate', 'Rate law', 'Molecularity', 'Order of reaction', 'Arrhenius equation', 'Collision theory']],
      ['Surface Chemistry', ['Adsorption', 'Catalysis', 'Colloids', 'Classification of colloids', 'Emulsions']],
      ['General Principles and Processes of Isolation of Elements', ['Occurrence', 'Concentration', 'Reduction', 'Thermodynamic and electrochemical principles', 'Refining']],
      ['The p-Block Elements', ['Group 15 to 18 elements', 'Nitrogen family', 'Oxygen family', 'Halogens', 'Noble gases', 'Important compounds']],
      ['The d- and f-Block Elements', ['Transition elements', 'Properties', 'Important compounds', 'Lanthanoids', 'Actinoids']],
      ['Coordination Compounds', ['Werner\'s theory', 'Nomenclature', 'Isomerism', 'Bonding — VBT and CFT', 'Applications']],
      ['Haloalkanes and Haloarenes', ['Classification', 'Nomenclature', 'Preparation', 'Properties', 'SN1 and SN2', 'Elimination reactions']],
      ['Alcohols, Phenols and Ethers', ['Nomenclature', 'Preparation', 'Physical and chemical properties', 'Uses']],
      ['Aldehydes, Ketones and Carboxylic Acids', ['Nomenclature', 'Preparation', 'Properties', 'Nucleophilic addition', 'Uses']],
      ['Amines', ['Classification', 'Nomenclature', 'Preparation', 'Properties', 'Diazonium salts']],
      ['Biomolecules', ['Carbohydrates', 'Proteins', 'Enzymes', 'Vitamins', 'Nucleic acids', 'Hormones']],
      ['Polymers', ['Classification', 'Types of polymerisation', 'Natural and synthetic polymers', 'Biodegradable polymers']],
      ['Chemistry in Everyday Life', ['Drugs and their classification', 'Drug-target interaction', 'Chemicals in food', 'Cleansing agents']],
    ]),
    Mathematics: ct([
      ['Relations and Functions', ['Types of relations', 'Types of functions', 'Composition of functions', 'Invertible functions', 'Binary operations']],
      ['Inverse Trigonometric Functions', ['Basic concepts', 'Properties', 'Graphs']],
      ['Matrices', ['Types of matrices', 'Operations', 'Transpose', 'Symmetric and skew symmetric', 'Elementary operations', 'Invertible matrices']],
      ['Determinants', ['Properties', 'Minors and cofactors', 'Adjoint and inverse', 'Applications — solving equations', 'Area of triangle']],
      ['Continuity and Differentiability', ['Continuity', 'Differentiability', 'Chain rule', 'Implicit differentiation', 'Logarithmic differentiation', 'Rolle\'s and Mean Value Theorem']],
      ['Application of Derivatives', ['Rate of change', 'Increasing and decreasing functions', 'Tangents and normals', 'Maxima and minima', 'Approximations']],
      ['Integrals', ['Integration as inverse of differentiation', 'Methods of integration', 'Definite integrals', 'Properties', 'Fundamental theorem of calculus']],
      ['Application of Integrals', ['Area under curves', 'Area between two curves']],
      ['Differential Equations', ['Order and degree', 'Formation', 'Methods of solving', 'Variable separable', 'Homogeneous', 'Linear']],
      ['Vector Algebra', ['Types of vectors', 'Addition', 'Scalar multiplication', 'Scalar (dot) product', 'Vector (cross) product']],
      ['Three Dimensional Geometry', ['Direction cosines and ratios', 'Equation of a line', 'Angle between lines', 'Shortest distance', 'Equation of a plane']],
      ['Linear Programming', ['Mathematical formulation', 'Graphical method', 'Types of problems']],
      ['Probability', ['Conditional probability', 'Multiplication theorem', 'Independent events', 'Bayes\' theorem', 'Random variables', 'Bernoulli trials', 'Binomial distribution']],
    ]),
    Biology: ct([
      ['Reproduction in Organisms', ['Asexual reproduction', 'Sexual reproduction — events', 'Pre-fertilisation', 'Fertilisation', 'Post-fertilisation']],
      ['Sexual Reproduction in Flowering Plants', ['Flower structure', 'Microsporogenesis', 'Megasporogenesis', 'Pollination', 'Double fertilisation', 'Post-fertilisation — endosperm, embryo']],
      ['Human Reproduction', ['Male reproductive system', 'Female reproductive system', 'Gametogenesis', 'Menstrual cycle', 'Fertilisation and implantation', 'Pregnancy', 'Parturition', 'Lactation']],
      ['Reproductive Health', ['Reproductive health problems', 'Population explosion', 'Birth control', 'MTP', 'STDs', 'Infertility']],
      ['Principles of Inheritance and Variation', ['Mendel\'s laws', 'Inheritance of one and two genes', 'Dominance', 'Linkage and crossing over', 'Sex determination', 'Mutations', 'Genetic disorders']],
      ['Molecular Basis of Inheritance', ['DNA structure', 'Replication', 'Transcription', 'Genetic code', 'Translation', 'Regulation of gene expression', 'Human Genome Project', 'DNA fingerprinting']],
      ['Evolution', ['Origin of life', 'Theories of evolution', 'Hardy-Weinberg principle', 'A brief account of evolution', 'Mechanism of evolution', 'Human evolution']],
      ['Human Health and Disease', ['Common diseases', 'Immunity — innate and acquired', 'AIDS', 'Cancer', 'Drugs and alcohol abuse']],
      ['Strategies for Enhancement in Food Production', ['Animal husbandry', 'Plant breeding', 'Tissue culture', 'Single cell proteins', 'Biofortification']],
      ['Microbes in Human Welfare', ['Microbes in household', 'Industrial products', 'Sewage treatment', 'Biogas', 'Biocontrol agents', 'Biofertilisers']],
      ['Biotechnology: Principles and Processes', ['Genetic engineering', 'Tools of rDNA technology', 'Processes of rDNA', 'Restriction enzymes', 'PCR', 'Gel electrophoresis']],
      ['Biotechnology and Its Applications', ['Agriculture', 'Bt crops', 'RNAi', 'Medicine — genetically engineered insulin, gene therapy', 'Transgenic animals', 'Ethical issues']],
      ['Organisms and Populations', ['Organisms and environment', 'Populations — attributes, growth models', 'Population interactions']],
      ['Ecosystem', ['Structure and function', 'Productivity', 'Decomposition', 'Energy flow', 'Nutrient cycling', 'Ecological succession']],
      ['Biodiversity and Conservation', ['Biodiversity', 'Patterns', 'Loss of biodiversity', 'Conservation — in situ, ex situ']],
      ['Environmental Issues', ['Air and water pollution', 'Solid waste management', 'Agrochemicals', 'Radioactive waste', 'Greenhouse effect', 'Ozone depletion', 'Deforestation']],
    ]),
  },
};

// ═══════════════════════════════════════════════════════════════
// ICSE (Grades 1–10) / ISC (Grades 11–12)
// ═══════════════════════════════════════════════════════════════

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
      ['Magnetism', ['Properties', 'Poles', 'Uses']],
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
      ['Pollution', ['Air pollution', 'Water pollution', 'Conservation']],
    ]),
  },
  '9': {
    Mathematics: ct([
      ['Rational and Irrational Numbers', ['Rational numbers', 'Irrational numbers', 'Real number line', 'Surds']],
      ['Compound Interest', ['Repeated compounding', 'CI formula', 'Growth and depreciation']],
      ['Expansions', ['Algebraic identities', '(a+b)², (a-b)², (a+b)(a-b)', 'Cube expansion']],
      ['Factorisation', ['Common factor', 'Regrouping', 'Using identities', 'Factor theorem']],
      ['Simultaneous Linear Equations', ['Graphical method', 'Substitution', 'Elimination', 'Cross-multiplication']],
      ['Indices (Exponents)', ['Laws of indices', 'Negative exponents', 'Fractional exponents']],
      ['Logarithms', ['Definition', 'Laws of logarithms', 'Common and natural log', 'Applications']],
      ['Triangles', ['Congruency', 'Properties of triangles', 'Isosceles triangle theorem', 'Inequalities']],
      ['Mid-Point and Intercept Theorems', ['Mid-point theorem', 'Converse', 'Intercept theorem']],
      ['Pythagoras Theorem', ['Statement and proof', 'Converse', 'Applications']],
      ['Rectilinear Figures', ['Quadrilaterals', 'Parallelogram properties', 'Area theorems']],
      ['Area and Perimeter of Plane Figures', ['Triangle', 'Quadrilaterals', 'Circle', 'Sector']],
      ['Statistics', ['Mean, median, mode', 'Frequency distribution', 'Graphical representation']],
    ]),
    Physics: ct([
      ['Measurements and Experimentation', ['SI units', 'Measuring instruments', 'Vernier caliper', 'Simple pendulum']],
      ['Motion in One Dimension', ['Distance and displacement', 'Speed, velocity, acceleration', 'Equations of motion', 'Graphs']],
      ['Laws of Motion', ['Newton\'s laws', 'Inertia', 'Momentum', 'F=ma', 'Conservation of momentum']],
      ['Fluids', ['Pressure in fluids', 'Buoyancy', 'Archimedes\' principle', 'Flotation', 'Atmospheric pressure']],
      ['Heat and Energy', ['Heat and temperature', 'Calorimetry', 'Change of state', 'Latent heat']],
      ['Light', ['Reflection at plane surfaces', 'Laws of reflection', 'Characteristics of image', 'Reflection at curved surfaces']],
      ['Sound', ['Nature of sound', 'Propagation', 'Reflection of sound', 'Echo', 'Characteristics']],
      ['Electricity and Magnetism', ['Static electricity', 'Current electricity', 'Ohm\'s law', 'Magnetism', 'Magnetic effect of current']],
    ]),
    Chemistry: ct([
      ['The Language of Chemistry', ['Chemical symbols', 'Formulae', 'Chemical equations', 'Balancing']],
      ['Chemical Changes and Reactions', ['Types of reactions', 'Energy changes', 'Catalysts']],
      ['Water', ['Water cycle', 'Hard and soft water', 'Water treatment', 'Dissolved substances']],
      ['Atomic Structure and Chemical Bonding', ['Subatomic particles', 'Bohr\'s model', 'Electronic configuration', 'Ionic and covalent bonding']],
      ['The Periodic Table', ['Periods and groups', 'Periodic properties', 'Metals, non-metals, metalloids']],
      ['Study of Gas Laws', ['Boyle\'s law', 'Charles\'s law', 'Gas equation', 'Relationship between laws']],
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
      ['Hygiene — A Key to Healthy Life', ['Personal hygiene', 'Food hygiene', 'Mental health']],
      ['Diseases', ['Communicable and non-communicable', 'Causes', 'Prevention']],
    ]),
  },
  '10': {
    Mathematics: ct([
      ['GST (Goods and Services Tax)', ['Computation', 'Tax invoice', 'Input and output tax']],
      ['Banking', ['Recurring deposits', 'Shares and dividends']],
      ['Linear Inequations', ['Inequation in one variable', 'Solution set', 'Graphing']],
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
      ['Statistics', ['Mean, median, mode (grouped)', 'Ogive', 'Quartiles']],
      ['Probability', ['Combined probability', 'Complementary events']],
    ]),
    Physics: ct([
      ['Force, Work, Power and Energy', ['Turning effect of force', 'Equilibrium', 'Work, power, energy', 'Conservation of energy']],
      ['Machines', ['Mechanical advantage', 'VR and efficiency', 'Levers', 'Pulleys', 'Inclined plane']],
      ['Refraction of Light', ['Laws of refraction', 'Refractive index', 'Total internal reflection', 'Lenses', 'Lens formula', 'Power']],
      ['Refraction through a Lens', ['Refraction through lens', 'Power of a lens', 'Real and virtual images']],
      ['Spectrum', ['Dispersion', 'Electromagnetic spectrum', 'Scattering']],
      ['Sound', ['Vibrations and waves', 'Characteristics of sound', 'Loudness, pitch, quality', 'Echo', 'Resonance']],
      ['Current Electricity', ['Ohm\'s law', 'Resistance', 'Combination of resistors', 'Electrical power', 'Household circuits']],
      ['Electrical Energy and Power', ['Power and energy', 'Heating effect', 'Safety devices']],
      ['Electro-magnetism', ['Electromagnetic induction', 'Faraday\'s law', 'AC generator', 'DC motor', 'Transformer']],
      ['Nuclear Physics', ['Radioactivity', 'Nuclear fission', 'Nuclear fusion', 'Nuclear energy']],
    ]),
    Chemistry: ct([
      ['Periodic Table and Periodicity', ['Modern periodic table', 'Trends in properties', 'Metallic and non-metallic character']],
      ['Chemical Bonding', ['Electrovalent bonding', 'Covalent bonding', 'Properties of compounds']],
      ['Acids, Bases and Salts', ['Properties', 'Strength of acids', 'pH scale', 'Important salts']],
      ['Analytical Chemistry', ['Identification of ions', 'Action of alkalis', 'Gas tests']],
      ['Mole Concept and Stoichiometry', ['Mole concept', 'Avogadro\'s number', 'Molar volume', 'Chemical calculations']],
      ['Electrolysis', ['Electrolytes', 'Selective discharge', 'Applications', 'Electroplating']],
      ['Metallurgy', ['Occurrence of metals', 'Extraction', 'Aluminium and iron', 'Alloys']],
      ['Study of Compounds — Hydrogen Chloride', ['Preparation', 'Properties', 'Uses']],
      ['Study of Compounds — Ammonia', ['Preparation', 'Properties', 'Uses']],
      ['Study of Compounds — Nitric Acid', ['Preparation', 'Properties', 'Uses']],
      ['Study of Compounds — Sulphuric Acid', ['Preparation', 'Properties', 'Uses']],
      ['Organic Chemistry', ['Introduction', 'Homologous series', 'IUPAC nomenclature', 'Properties of hydrocarbons']],
    ]),
    Biology: ct([
      ['Cell Division', ['Mitosis', 'Meiosis', 'Significance', 'Comparison']],
      ['Genetics', ['Mendel\'s laws', 'Monohybrid and dihybrid cross', 'Sex determination']],
      ['Absorption by Roots', ['Root structure', 'Osmosis', 'Active transport']],
      ['Transpiration', ['Process', 'Factors affecting', 'Significance', 'Ganong\'s potometer']],
      ['Photosynthesis', ['Process', 'Light and dark reactions', 'Factors affecting']],
      ['Chemical Coordination in Plants', ['Growth hormones', 'Auxin, gibberellin, cytokinin']],
      ['The Circulatory System', ['Heart structure and function', 'Types of circulation', 'Blood composition']],
      ['The Excretory System', ['Kidney structure and function', 'Nephron', 'Formation of urine', 'Dialysis']],
      ['The Nervous System', ['Central nervous system', 'Peripheral and autonomic', 'Reflex action', 'Sense organs']],
      ['The Endocrine System', ['Glands and hormones', 'Diabetes', 'Adrenalin', 'Growth hormone']],
      ['The Reproductive System', ['Male and female systems', 'Fertilisation', 'Development', 'Menstrual cycle']],
      ['Population', ['Population explosion', 'Birth control', 'STDs']],
      ['Human Evolution', ['Evidences of evolution', 'Natural selection', 'Human ancestry']],
      ['Pollution', ['Air, water, noise, soil pollution', 'Acid rain', 'Effects and control']],
    ]),
  },
};

// ISC (Grades 11–12) — uses CBSE data as ISC follows similar NCERT-aligned syllabus
// The ISC curriculum is largely similar to CBSE for core science subjects

const ISC: Record<string, Record<string, Chapter[]>> = {
  '11': CBSE['11'],
  '12': CBSE['12'],
};

// ═══════════════════════════════════════════════════════════════
// State Board (Kerala SCERT)
// ═══════════════════════════════════════════════════════════════

const STATE_BOARD: Record<string, Record<string, Chapter[]>> = {
  '1': {
    Mathematics: ch(['Numbers 1 to 20', 'Addition', 'Subtraction', 'Shapes', 'Patterns', 'Measurement', 'Time']),
    Science: ch(['My Body', 'Plants', 'Animals', 'Food', 'Water', 'Seasons']),
  },
  '2': {
    Mathematics: ch(['Numbers to 100', 'Addition and Subtraction', 'Multiplication', 'Shapes', 'Patterns', 'Measurement', 'Time', 'Money']),
    Science: ch(['Our Body', 'Plants and Animals', 'Food and Health', 'Water', 'Air', 'Weather']),
  },
  '3': {
    Mathematics: ch(['Numbers to 1000', 'Addition and Subtraction', 'Multiplication and Division', 'Fractions', 'Shapes', 'Measurement']),
    Science: ch(['Living Things', 'Plants — Parts and Functions', 'Animals and Their Habitats', 'Food', 'Water', 'Air', 'Soil']),
  },
  '4': {
    Mathematics: ch(['Large Numbers', 'Multiplication and Division', 'Factors', 'Fractions', 'Decimals', 'Geometry', 'Measurement']),
    Science: ch(['Organ Systems', 'Plants', 'Animals', 'Food and Nutrition', 'Soil', 'Rocks']),
  },
  '5': {
    Mathematics: ch(['Large Numbers', 'Fractions', 'Decimals', 'Geometry', 'Area and Perimeter', 'Data Handling']),
    Science: ch(['Living World', 'Food and Health', 'Matter and Materials', 'Force and Energy']),
  },
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
      ['Fibre and Fabric', ['Animal fibres', 'Silk', 'Wool']],
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
      ['Algebraic Expressions', ['Operations', 'Identities', 'Factorisation']],
      ['Linear Equations', ['Solving equations', 'Word problems']],
      ['Geometry', ['Quadrilaterals', 'Constructions']],
      ['Mensuration', ['Surface area and volume', 'Cylinder']],
      ['Data Handling', ['Pie charts', 'Histograms', 'Probability']],
      ['Exponents', ['Laws of exponents', 'Standard form']],
      ['Proportion', ['Direct and inverse', 'Compound proportion']],
    ]),
    Science: ct([
      ['Crop Production', ['Agricultural practices', 'Irrigation', 'Storage']],
      ['Microorganisms', ['Types', 'Useful and harmful', 'Food preservation']],
      ['Metals and Non-Metals', ['Properties', 'Reactivity', 'Uses']],
      ['Coal and Petroleum', ['Fossil fuels', 'Refining', 'Conservation']],
      ['Cell Structure and Functions', ['Cell organelles', 'Plant vs animal cell']],
      ['Reproduction', ['Asexual reproduction', 'Sexual reproduction in animals']],
      ['Force and Pressure', ['Types of force', 'Pressure in fluids']],
      ['Friction', ['Types', 'Factors affecting', 'Applications']],
      ['Sound', ['Production', 'Characteristics', 'Noise pollution']],
      ['Natural Phenomena', ['Lightning', 'Earthquakes']],
      ['Light', ['Reflection', 'Human eye', 'Braille']],
      ['Stars and Solar System', ['Planets', 'Constellations', 'Satellites']],
    ]),
  },
  '9': {
    Mathematics: ct([
      ['Polynomials', ['Types', 'Zeroes', 'Remainder and factor theorem', 'Factorisation']],
      ['Real Numbers', ['Irrational numbers', 'Decimal representation', 'Number line']],
      ['Coordinate Geometry', ['Cartesian plane', 'Plotting points', 'Distance formula']],
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
      ['Is Matter Around Us Pure?', ['Mixtures', 'Solutions, colloids, suspensions', 'Separation techniques']],
      ['Atoms and Molecules', ['Atomic theory', 'Molecular formula', 'Mole concept']],
      ['Structure of the Atom', ['Models of atom', 'Electronic configuration', 'Valency']],
      ['Cell — The Basic Unit of Life', ['Cell organelles', 'Prokaryotic and eukaryotic cells']],
      ['Tissues', ['Plant and animal tissues']],
      ['Diversity in Living Organisms', ['Classification — five kingdoms']],
      ['Motion', ['Equations of motion', 'Distance-time and velocity-time graphs']],
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
      ['Magnetic Effects of Current', ['Electromagnetic induction', 'Generator', 'Motor']],
      ['Sources of Energy', ['Conventional and non-conventional']],
    ]),
  },
  '11': {
    Physics: ct([
      ['Physical World and Measurement', ['Scope of physics', 'SI units', 'Dimensional analysis']],
      ['Kinematics', ['Motion in a straight line', 'Motion in a plane', 'Projectile motion']],
      ['Laws of Motion', ['Newton\'s laws', 'Friction', 'Circular motion']],
      ['Work, Energy and Power', ['Work-energy theorem', 'Conservation', 'Collisions']],
      ['Motion of System of Particles', ['Centre of mass', 'Rotational motion', 'Moment of inertia']],
      ['Gravitation', ['Kepler\'s laws', 'Gravitational potential', 'Satellites']],
      ['Properties of Solids and Liquids', ['Elastic properties', 'Fluid mechanics', 'Viscosity', 'Surface tension']],
      ['Thermodynamics', ['Laws of thermodynamics', 'Heat engines', 'Entropy']],
      ['Kinetic Theory of Gases', ['Gas laws', 'Kinetic energy', 'Degrees of freedom']],
      ['Oscillations and Waves', ['SHM', 'Damped oscillations', 'Wave motion', 'Standing waves']],
    ]),
    Chemistry: ct([
      ['Basic Concepts of Chemistry', ['Mole concept', 'Stoichiometry', 'Atomic mass']],
      ['Atomic Structure', ['Quantum model', 'Quantum numbers', 'Electronic configuration']],
      ['Periodicity', ['Periodic trends', 'Classification']],
      ['Chemical Bonding', ['Ionic, covalent bonds', 'VSEPR theory', 'Hybridisation']],
      ['States of Matter', ['Gas laws', 'Kinetic theory', 'Liquids']],
      ['Thermodynamics', ['Enthalpy', 'Entropy', 'Gibbs free energy']],
      ['Equilibrium', ['Chemical equilibrium', 'Acids and bases', 'Solubility']],
      ['Redox Reactions', ['Oxidation number', 'Balancing redox equations']],
      ['Hydrogen and s-Block Elements', ['Properties', 'Important compounds']],
      ['p-Block Elements', ['Group 13 and 14', 'Properties and compounds']],
      ['Organic Chemistry Basics', ['IUPAC nomenclature', 'Isomerism', 'Reaction mechanisms']],
      ['Hydrocarbons', ['Alkanes', 'Alkenes', 'Alkynes', 'Aromatic']],
      ['Environmental Chemistry', ['Pollution', 'Green chemistry']],
    ]),
    Mathematics: ct([
      ['Sets and Functions', ['Sets', 'Relations', 'Functions', 'Trigonometric functions']],
      ['Algebra', ['Mathematical induction', 'Complex numbers', 'Quadratic equations', 'Inequalities', 'Permutations and combinations', 'Binomial theorem', 'Sequences and series']],
      ['Coordinate Geometry', ['Straight lines', 'Conic sections', 'Circles']],
      ['Calculus', ['Limits', 'Derivatives', 'Differentiation']],
      ['Statistics and Probability', ['Measures of dispersion', 'Probability']],
      ['Mathematical Reasoning', ['Statements', 'Logical connectives']],
    ]),
    Biology: ct([
      ['Diversity of Life', ['Classification', 'Plant and animal kingdoms', 'Morphology']],
      ['Structural Organisation', ['Plant anatomy', 'Animal tissues', 'Organ systems']],
      ['Cell Biology', ['Cell structure', 'Biomolecules', 'Cell cycle']],
      ['Plant Physiology', ['Transport', 'Mineral nutrition', 'Photosynthesis', 'Respiration', 'Growth']],
      ['Human Physiology', ['Digestion', 'Breathing', 'Circulation', 'Excretion', 'Locomotion', 'Neural and chemical coordination']],
    ]),
  },
  '12': {
    Physics: ct([
      ['Electrostatics', ['Coulomb\'s law', 'Electric field', 'Potential', 'Capacitance']],
      ['Current Electricity', ['Ohm\'s law', 'Kirchhoff\'s rules', 'Wheatstone bridge']],
      ['Magnetic Effects of Current', ['Biot-Savart law', 'Ampere\'s law', 'Galvanometer']],
      ['Electromagnetic Induction', ['Faraday\'s law', 'Lenz\'s law', 'AC circuits']],
      ['Electromagnetic Waves', ['EM spectrum', 'Properties']],
      ['Optics', ['Reflection', 'Refraction', 'Wave optics', 'Interference', 'Diffraction']],
      ['Dual Nature of Matter', ['Photoelectric effect', 'de Broglie wavelength']],
      ['Atoms and Nuclei', ['Bohr model', 'Nuclear physics', 'Radioactivity']],
      ['Electronic Devices', ['Semiconductors', 'Diodes', 'Transistors', 'Logic gates']],
    ]),
    Chemistry: ct([
      ['Solid State', ['Crystal lattice', 'Unit cell', 'Defects']],
      ['Solutions', ['Colligative properties', 'Raoult\'s law']],
      ['Electrochemistry', ['Nernst equation', 'Electrolysis', 'Batteries']],
      ['Chemical Kinetics', ['Rate law', 'Order of reaction', 'Arrhenius equation']],
      ['Surface Chemistry', ['Adsorption', 'Catalysis', 'Colloids']],
      ['Metallurgy', ['Extraction of metals', 'Refining']],
      ['p-Block Elements', ['Group 15–18', 'Important compounds']],
      ['d- and f-Block Elements', ['Properties', 'Coordination compounds']],
      ['Organic Compounds', ['Haloalkanes', 'Alcohols', 'Aldehydes and ketones', 'Carboxylic acids', 'Amines']],
      ['Biomolecules and Polymers', ['Carbohydrates', 'Proteins', 'Nucleic acids', 'Polymers']],
      ['Chemistry in Everyday Life', ['Drugs', 'Food chemistry', 'Cleansing agents']],
    ]),
    Mathematics: ct([
      ['Relations and Functions', ['Types', 'Composition', 'Inverse functions']],
      ['Algebra', ['Matrices', 'Determinants', 'Inverse trigonometric functions']],
      ['Calculus', ['Continuity', 'Differentiation', 'Applications of derivatives', 'Integration', 'Application of integrals', 'Differential equations']],
      ['Vectors and 3D Geometry', ['Vectors', 'Dot and cross product', 'Lines and planes in 3D']],
      ['Linear Programming', ['Graphical method', 'Optimisation']],
      ['Probability', ['Conditional probability', 'Bayes\' theorem', 'Distributions']],
    ]),
    Biology: ct([
      ['Reproduction', ['Reproduction in organisms', 'Sexual reproduction in plants', 'Human reproduction', 'Reproductive health']],
      ['Genetics and Evolution', ['Inheritance', 'Molecular basis', 'Evolution']],
      ['Biology in Human Welfare', ['Health and disease', 'Food production', 'Microbes']],
      ['Biotechnology', ['Principles and processes', 'Applications']],
      ['Ecology', ['Organisms and environment', 'Ecosystems', 'Biodiversity', 'Environmental issues']],
    ]),
  },
};

// ═══════════════════════════════════════════════════════════════
// Combined Curriculum Database
// ═══════════════════════════════════════════════════════════════

export const CURRICULUM: CurriculumDB = {
  'CBSE': CBSE,
  'ICSE': ICSE,
  'ISC': ISC,
  'State Board': STATE_BOARD,
  // Other boards (IB, IGCSE, NIOS, SSC, HSC, etc.) will fall through
  // to manual entry via "Other" option in the UI
};

// ── Lookup helpers ───────────────────────────────────────────

export function getChapters(board: string, grade: string, subject: string): Chapter[] {
  return CURRICULUM[board]?.[grade]?.[subject] || [];
}

export function getSubjectsForGrade(board: string, grade: string): string[] {
  const gradeData = CURRICULUM[board]?.[grade];
  return gradeData ? Object.keys(gradeData).sort() : [];
}

export function getBoardsWithData(): string[] {
  return Object.keys(CURRICULUM);
}
