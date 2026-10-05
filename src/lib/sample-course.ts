import type { ReviewedCourse } from "./learning-types";

export const SAMPLE_STATISTICS_COURSE: ReviewedCourse = {
    id: "sample-statistics-101",
    title: "Introductory Statistics for University Students",
    goal: "Understand data types, central tendency, dispersion, charts, and practical dataset interpretation for academic research and professional work.",
    subject: "Introductory Statistics",
    attribution: "Adapted from OpenIntro Statistics (4th Edition) by David Diez, Mine Çetinkaya-Rundel, and Christopher Barr. Licensed under Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0). Localized with Nigerian university campus examples.",
    aiPreparedNotice: "Educational structure prepared with AI assistance and validated against source textbooks.",
    humanReviewedNotice: "Demonstration lessons, questions, mathematical calculations, OpenIntro citations, and the French lesson: human-reviewed and verified for the pilot demonstration (2026-10-03).",
    lessons: [
        {
            id: "lesson-1-data-types",
            title: "Data Types",
            summary: "Distinguish between numerical (discrete vs continuous) and categorical (nominal vs ordinal) variables.",
            content: `
### Understanding Variables and Data Types

In statistics, an **observational unit** (or case) is the individual object or person from whom data is collected. For example, in a campus study, each student surveyed is an observational unit. A **variable** is a characteristic or quantity that can vary across different units.

As outlined in **OpenIntro Statistics (§1.2)**, variables are broadly divided into two major families: **Numerical** and **Categorical**.

#### 1. Numerical Variables
Numerical variables take sensible numeric values where arithmetic operations (like adding or averaging) make mathematical sense.

- **Discrete Numerical**: Values that change only in distinct increments, typically countable integer steps.
  - *Campus Example*: The number of registered courses this semester (e.g., 6, 7, 8 courses) or the number of carryover credits (0, 1, 2). You cannot register for 6.438 courses.
- **Continuous Numerical**: Values that can take any fractional value along an interval on the real number line, bounded only by the precision of measurement.
  - *Campus Example*: Cumulative Grade Point Average (CGPA, e.g., 3.84 or 4.12), student weight, travel time to campus (e.g., 24.5 minutes).

#### 2. Categorical Variables
Categorical variables place observational units into distinct categories or qualitative buckets.

- **Nominal Categorical**: Categories with no intrinsic natural ranking or order among them.
  - *Campus Example*: Faculty (Science, Arts, Engineering, Law), Gender, Hall of Residence, Student Matriculation Number (even though it contains numbers, arithmetic like calculating the average matric number is meaningless).
- **Ordinal Categorical**: Categories that have a natural hierarchical order or progression, but the difference between successive categories is not necessarily uniform.
  - *Campus Example*: Academic Year/Level (100 Level, 200 Level, 300 Level, 400 Level, 500 Level), Likert scale ratings (Strongly Disagree, Neutral, Strongly Agree).

#### Summary Table
| Family | Subtype | Definition | Nigerian University Example |
| :--- | :--- | :--- | :--- |
| **Numerical** | Continuous | Any real value on a continuum | CGPA (0.00 – 5.00), Commute time |
| **Numerical** | Discrete | Countable distinct steps | Number of siblings, Courses registered |
| **Categorical** | Nominal | Categories without natural order | Faculty, Hall of residence, Bank used |
| **Categorical** | Ordinal | Categories with natural ranking | Level (100L, 200L, 300L...), Exam grade (A, B, C...) |
`,
            sources: [
                {
                    id: "source-openintro-1-2",
                    title: "OpenIntro Statistics (4th Edition) — §1.2 Data Basics",
                    author: "David Diez, Mine Çetinkaya-Rundel, Christopher Barr",
                    license: "Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)",
                    section: "Chapter 1: Introduction to Data, Section 1.2",
                    excerpt: "Data are often presented in a data matrix where each row represents a case and each column represents a variable. Numerical variables take on numerical values where sensible arithmetic operations can be performed. Discrete numerical variables have jumps between possible values (such as counts). Continuous numerical variables take any value on a continuum. Categorical variables take on qualitative values; ordinal categorical variables have an inherent order.",
                    url: "https://www.openintro.org/book/os/",
                },
            ],
            questions: [
                {
                    id: "q-1-1",
                    prompt: "A researcher records the Cumulative Grade Point Average (CGPA) of 150 graduating university students on a 5.00 scale. How should CGPA be classified?",
                    options: [
                        { id: "opt-1-1-a", text: "Continuous numerical variable" },
                        { id: "opt-1-1-b", text: "Discrete numerical variable" },
                        { id: "opt-1-1-c", text: "Ordinal categorical variable" },
                        { id: "opt-1-1-d", text: "Nominal categorical variable" },
                    ],
                    correctOptionId: "opt-1-1-a",
                    hint: "Think about whether CGPA takes decimal values on a continuum (e.g. 3.42, 4.15) where differences and averages have meaningful mathematical significance.",
                    explanation: "CGPA is a continuous numerical variable because it can take fractional values along a numerical continuum between 0.00 and 5.00, and standard arithmetic operations (such as finding the class mean) are mathematically meaningful.",
                },
                {
                    id: "q-1-2",
                    prompt: "In a campus survey, students select their academic level: '100L', '200L', '300L', '400L', or '500L'. What type of variable is this?",
                    options: [
                        { id: "opt-1-2-a", text: "Nominal categorical variable" },
                        { id: "opt-1-2-b", text: "Ordinal categorical variable" },
                        { id: "opt-1-2-c", text: "Continuous numerical variable" },
                        { id: "opt-1-2-d", text: "Discrete numerical variable" },
                    ],
                    correctOptionId: "opt-1-2-b",
                    hint: "Notice that academic levels represent qualitative stages of undergraduate study, but there is a clear natural progression from first year to final year.",
                    explanation: "Academic levels are ordinal categorical variables. They group students into distinct categories that possess an inherent, logical ordering (100L precedes 200L, which precedes 300L), but you do not treat them as continuous numbers.",
                },
                {
                    id: "q-1-3",
                    prompt: "Which of the following is the best example of a discrete numerical variable?",
                    options: [
                        { id: "opt-1-3-a", text: "The time spent waiting for a campus shuttle bus (in minutes)" },
                        { id: "opt-1-3-b", text: "The name of a student's residential hall" },
                        { id: "opt-1-3-c", text: "The number of course textbooks borrowed from the university library this semester" },
                        { id: "opt-1-3-d", text: "The distance from off-campus housing to the lecture auditorium in kilometers" },
                    ],
                    correctOptionId: "opt-1-3-c",
                    hint: "Look for a variable that represents a count of whole items that cannot be split into arbitrary fractional parts.",
                    explanation: "The number of borrowed textbooks is discrete numerical because books are counted in whole integers (0, 1, 2, 3...). You cannot borrow 2.73 books. In contrast, time and distance are continuous.",
                },
            ],
            frenchAlternative: {
                title: "Types de données",
                summary: "Distinguer les variables numériques (discrètes vs continues) et catégorielles (nominales vs ordinales).",
                content: `
### Comprendre les variables et les types de données

En statistique descriptive, une **unité d'observation** (ou individu) est l'entité observée (par exemple, un étudiant universitaire). Une **variable** représente une caractéristique mesurée ou observée chez chaque individu.

Selon le manuel de référence **OpenIntro Statistics (§1.2)**, les variables se divisent en deux grandes familles: **Numériques** et **Catégorielles**.

#### 1. Variables Numériques (Quantitatives)
Ces variables prennent des valeurs numériques pour lesquelles les opérations arithmétiques (moyenne, addition) ont un sens.
- **Numérique Discrète**: Valeurs issues d'un comptage prenant des valeurs entières distinctes (ex: nombre de cours suivis ce semestre: 5, 6, 7).
- **Numérique Continue**: Valeurs pouvant prendre n'importe quelle valeur réelle dans un intervalle continu (ex: moyenne générale / GPA, durée du trajet jusqu'au campus).

#### 2. Variables Catégorielles (Qualitatives)
Ces variables regroupent les observations dans des catégories qualitatives.
- **Nominale**: Catégories sans ordre hiérarchique naturel (ex: Faculté d'inscription, Ville d'origine, Numéro matricule).
- **Ordinale**: Catégories possédant un ordre logique naturel (ex: Niveau académique: 1ère année, 2ème année, 3ème année; Mention au diplôme: Passable, Bien, Très Bien).
`,
                questions: [
                    {
                        id: "q-fr-1-1",
                        prompt: "Un chercheur enregistre la moyenne cumulative (GPA) de 150 étudiants sur une échelle de 5,00. Comment classifier cette variable?",
                        options: [
                            { id: "opt-fr-1-1-a", text: "Variable numérique continue" },
                            { id: "opt-fr-1-1-b", text: "Variable numérique discrète" },
                            { id: "opt-fr-1-1-c", text: "Variable catégorielle ordinale" },
                            { id: "opt-fr-1-1-d", text: "Variable catégorielle nominale" },
                        ],
                        correctOptionId: "opt-fr-1-1-a",
                        hint: "La moyenne peut prendre des valeurs décimales intermédiaires comme 3,45 ou 4,12.",
                        explanation: "La moyenne cumulative est une variable numérique continue car elle prend des valeurs réelles sur un continuum entre 0,00 et 5,00 et permet des calculs arithmétiques standards.",
                    },
                    {
                        id: "q-fr-1-2",
                        prompt: "Dans un questionnaire, les étudiants indiquent leur niveau d'étude ('Licence 1', 'Licence 2', 'Licence 3', 'Master'). De quel type de variable s'agit-il?",
                        options: [
                            { id: "opt-fr-1-2-a", text: "Variable catégorielle nominale" },
                            { id: "opt-fr-1-2-b", text: "Variable catégorielle ordinale" },
                            { id: "opt-fr-1-2-c", text: "Variable numérique continue" },
                            { id: "opt-fr-1-2-d", text: "Variable numérique discrète" },
                        ],
                        correctOptionId: "opt-fr-1-2-b",
                        hint: "Les niveaux d'études correspondent à des étapes avec une hiérarchie ou progression claire.",
                        explanation: "Les niveaux d'études sont des variables catégorielles ordinales car les catégories présentent un ordre naturel et progressif évident.",
                    },
                    {
                        id: "q-fr-1-3",
                        prompt: "Quel exemple correspond le mieux à une variable numérique discrète?",
                        options: [
                            { id: "opt-fr-1-3-a", text: "Le temps d'attente pour le bus du campus en minutes" },
                            { id: "opt-fr-1-3-b", text: "Le nom de la résidence universitaire" },
                            { id: "opt-fr-1-3-c", text: "Le nombre de livres empruntés à la bibliothèque ce semestre" },
                            { id: "opt-fr-1-3-d", text: "La distance entre le logement et l'amphithéâtre" },
                        ],
                        correctOptionId: "opt-fr-1-3-c",
                        hint: "Cherchez une grandeur obtenue par un comptage de valeurs entières.",
                        explanation: "Le nombre de livres empruntés est une variable discrète car on compte des objets entiers (0, 1, 2, 3 livres).",
                    },
                ],
            },
        },
        {
            id: "lesson-2-mean-and-median",
            title: "Mean and Median",
            summary: "Learn to calculate and compare the sample mean and median, and understand how outliers and skewness influence central tendency.",
            content: `
### Central Tendency: Mean and Median

When summarizing a numerical dataset, we want a single central value that accurately represents a typical observation. The two most fundamental measures are the **Sample Mean** and the **Sample Median** (**OpenIntro Statistics §2.1**).

#### 1. The Sample Mean (Arithmetic Average)
The sample mean, denoted $\\bar{x}$ (pronounced *x-bar*), is calculated by summing all $n$ observed values and dividing by the total count $n$:

$$\\bar{x} = \\frac{x_1 + x_2 + \\dots + x_n}{n} = \\frac{\\sum_{i=1}^{n} x_i}{n}$$

**Key Property**: The mean incorporates the exact magnitude of every single data point. Consequently, it is **sensitive to extreme values (outliers)**.

#### 2. The Sample Median
The median represents the 50th percentile—the exact middle value when the data points are sorted in ascending order:
- If $n$ is **odd**, the median is the single value sitting at index $\\frac{n + 1}{2}$.
- If $n$ is **even**, the median is the mean of the two middle values at indices $\\frac{n}{2}$ and $\\frac{n}{2} + 1$.

**Key Property**: The median is a **resistant (robust)** statistic. Changing extreme values at either end does not shift the middle rank.

#### Why Outliers Matter: A Campus Example
Imagine five Nigerian university students report their daily campus lunch spending in Naira:
$$\\text{Group A: } \\{₦600, ₦700, ₦800, ₦900, ₦1,000\\}$$
- Mean: $\\frac{600 + 700 + 800 + 900 + 1000}{5} = \\frac{4000}{5} = ₦800$
- Median: Sorted middle value = $₦800$ (Both agree!)

Now suppose a guest visiting the cafeteria joins the group and spends $₦10,000$ on a large banquet lunch:
$$\\text{Group B: } \\{₦600, ₦700, ₦800, ₦900, ₦1,000, ₦10,000\\}$$
- New Mean: $\\frac{14,000}{6} = ₦2,333.33$
- New Median: Mean of the two middle values (800 and 900) = $₦850$

Notice: Five of the six students spent $₦1,000$ or less. Yet the mean ($₦2,333$) suggests a typical student spends over $₦2,300$, which is completely misleading! In contrast, the median ($₦850$) remains a faithful reflection of a typical lunch expense.

#### Rule of Thumb for Skewness
- **Symmetric Distribution**: $\\text{Mean} \\approx \\text{Median}$
- **Right-Skewed Distribution (Long right tail of high values)**: $\\text{Mean} > \\text{Median}$
- **Left-Skewed Distribution (Long left tail of low values)**: $\\text{Mean} < \\text{Median}$
`,
            sources: [
                {
                    id: "source-openintro-2-1",
                    title: "OpenIntro Statistics (4th Edition) — §2.1 Examining Numerical Data",
                    author: "David Diez, Mine Çetinkaya-Rundel, Christopher Barr",
                    license: "Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)",
                    section: "Chapter 2: Summarizing Data, Section 2.1",
                    excerpt: "The sample mean is the average of all observations. The median is the value that splits the sorted data in half. When data are strongly skewed or contain extreme outliers, the median is often a more useful summary of the center than the mean because the median is resistant to extreme observations while the mean is pulled in the direction of the skew.",
                    url: "https://www.openintro.org/book/os/",
                },
            ],
            questions: [
                {
                    id: "q-2-1",
                    prompt: "Seven students report the number of hours they studied for a statistics midterm exam: 4, 6, 8, 9, 12, 14, 25. What is the sample median of this dataset?",
                    options: [
                        { id: "opt-2-1-a", text: "8 hours" },
                        { id: "opt-2-1-b", text: "9 hours" },
                        { id: "opt-2-1-c", text: "11.1 hours" },
                        { id: "opt-2-1-d", text: "12 hours" },
                    ],
                    correctOptionId: "opt-2-1-b",
                    hint: "The data is already sorted in ascending order. Since there are 7 observations (an odd number), locate the (7 + 1) / 2 = 4th value.",
                    explanation: "With n = 7 sorted values (4, 6, 8, 9, 12, 14, 25), the middle value is the 4th item, which is 9 hours. (Note that 11.1 hours is the sample mean, which is pulled upward by the 25-hour value).",
                },
                {
                    id: "q-2-2",
                    prompt: "A campus survey of off-campus monthly rent in Yaba reveals a right-skewed distribution with a few luxury apartments costing over ₦1,500,000 per month while most rooms cost ₦150,000 to ₦250,000. Which statement is true?",
                    options: [
                        { id: "opt-2-2-a", text: "The mean rent will be substantially higher than the median rent." },
                        { id: "opt-2-2-b", text: "The median rent will be substantially higher than the mean rent." },
                        { id: "opt-2-2-c", text: "The mean and median rent will be exactly identical." },
                        { id: "opt-2-2-d", text: "The median cannot be calculated because the data is skewed." },
                    ],
                    correctOptionId: "opt-2-2-a",
                    hint: "Think about which measure of center is pulled toward the long tail of unusually expensive luxury apartments.",
                    explanation: "In a right-skewed distribution, the few extreme high values pull the arithmetic mean upward, while the median remains anchored in the middle of the sorted distribution. Therefore, the mean is higher than the median.",
                },
                {
                    id: "q-2-3",
                    prompt: "Why is the median described as a 'resistant' (or robust) statistic?",
                    options: [
                        { id: "opt-2-3-a", text: "It resists being calculated when sample sizes are even." },
                        { id: "opt-2-3-b", text: "Extreme outliers do not significantly change its value." },
                        { id: "opt-2-3-c", text: "It always equals zero in standardized distributions." },
                        { id: "opt-2-3-d", text: "It requires calculating every data point twice." },
                    ],
                    correctOptionId: "opt-2-3-b",
                    hint: "Consider what happens to the median when the highest value in a dataset is multiplied by 100.",
                    explanation: "A statistic is called resistant when extreme observations (outliers) do not dramatically influence its value. Since the median depends solely on the order and rank of values rather than their absolute magnitudes, modifying extreme values leaves the median stable.",
                },
            ],
        },
        {
            id: "lesson-3-measures-of-spread",
            title: "Measures of Spread",
            summary: "Explore range, variance, standard deviation, and the interquartile range (IQR) to quantify data variability.",
            content: `
### Quantifying Variability: Measures of Spread

Knowing the center of a dataset is only half the story. Consider two statistics tutorial groups with an identical mean quiz score of 60%:
- **Group 1**: Every student scored between 58% and 62%.
- **Group 2**: Scores ranged from 20% to 100%.

Group 2 exhibits far higher **variability** (or spread). As detailed in **OpenIntro Statistics (§2.1.4)**, we quantify spread using several key statistics.

#### 1. Range
$$\\text{Range} = \\text{Maximum} - \\text{Minimum}$$
Simple to calculate, but extremely sensitive to outliers because it relies exclusively on the two extreme extremes.

#### 2. Sample Variance ($s^2$) and Standard Deviation ($s$)
The **sample variance** measures the average squared deviation of each observation from the sample mean:

$$s^2 = \\frac{\\sum_{i=1}^n (x_i - \\bar{x})^2}{n - 1}$$

Because squaring deviations results in squared units (e.g., $\\text{Naira}^2$), we take the square root to obtain the **sample standard deviation ($s$)**, which shares the original unit of measurement:

$$s = \\sqrt{\\frac{\\sum_{i=1}^n (x_i - \\bar{x})^2}{n - 1}}$$

*Interpretation*: Standard deviation represents the typical distance an observation falls from the sample mean.

#### 3. Quartiles and the Interquartile Range (IQR)
When data is skewed or contains outliers, standard deviation can be inflated. In such cases, we divide the ordered data into four equal quarters using **quartiles**:
- **First Quartile ($Q_1$)**: The 25th percentile (median of the lower half).
- **Second Quartile ($Q_2$)**: The 50th percentile (the Median).
- **Third Quartile ($Q_3$)**: The 75th percentile (median of the upper half).

The **Interquartile Range (IQR)** is the span of the middle 50% of the observations:

$$\\text{IQR} = Q_3 - Q_1$$

Like the median, the **IQR is resistant to outliers**.

#### 4. The 1.5 × IQR Rule for Outliers
In exploratory data analysis, an observation is flagged as a potential outlier if it falls:
- Below $Q_1 - 1.5 \\times \\text{IQR}$, or
- Above $Q_3 + 1.5 \\times \\text{IQR}$.
`,
            sources: [
                {
                    id: "source-openintro-2-1-4",
                    title: "OpenIntro Statistics (4th Edition) — §2.1.4 Measures of Variability",
                    author: "David Diez, Mine Çetinkaya-Rundel, Christopher Barr",
                    license: "Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)",
                    section: "Chapter 2: Summarizing Data, Section 2.1.4",
                    excerpt: "Variability can be measured using the standard deviation and variance, which measure roughly how far observations are from the mean. The interquartile range (IQR) measures the spread of the middle 50% of the data: IQR = Q3 - Q1. The IQR is resistant to extreme observations, making it ideal for skewed distributions.",
                    url: "https://www.openintro.org/book/os/",
                },
            ],
            questions: [
                {
                    id: "q-3-1",
                    prompt: "A dataset of daily generator runtime hours during power outages at a student hostel has Q1 = 3 hours and Q3 = 8 hours. What is the Interquartile Range (IQR)?",
                    options: [
                        { id: "opt-3-1-a", text: "5 hours" },
                        { id: "opt-3-1-b", text: "11 hours" },
                        { id: "opt-3-1-c", text: "5.5 hours" },
                        { id: "opt-3-1-d", text: "2.67 hours" },
                    ],
                    correctOptionId: "opt-3-1-a",
                    hint: "Apply the formula IQR = Q3 - Q1.",
                    explanation: "The Interquartile Range is calculated as IQR = Q3 - Q1 = 8 hours - 3 hours = 5 hours. It represents the spread of the central 50% of generator runtime hours.",
                },
                {
                    id: "q-3-2",
                    prompt: "Why is the standard deviation preferred over the variance when reporting results in research reports and student presentations?",
                    options: [
                        { id: "opt-3-2-a", text: "Standard deviation is always a whole integer." },
                        { id: "opt-3-2-b", text: "Standard deviation is expressed in the same units as the original observations." },
                        { id: "opt-3-2-c", text: "Variance cannot be calculated for samples smaller than 100." },
                        { id: "opt-3-2-d", text: "Standard deviation is completely immune to outliers." },
                    ],
                    correctOptionId: "opt-3-2-b",
                    hint: "Think about the units: if measuring transport costs in Naira (₦), what are the units of variance versus standard deviation?",
                    explanation: "Variance squares the deviations, producing squared units (such as ₦² or hours²), which lack intuitive physical meaning. Taking the square root gives standard deviation, which returns to the original units (₦ or hours).",
                },
                {
                    id: "q-3-3",
                    prompt: "For a dataset with Q1 = 20 and Q3 = 35, what is the upper boundary beyond which a data point is suspected to be an outlier under the 1.5 × IQR rule?",
                    options: [
                        { id: "opt-3-3-a", text: "50" },
                        { id: "opt-3-3-b", text: "57.5" },
                        { id: "opt-3-3-c", text: "42.5" },
                        { id: "opt-3-3-d", text: "65" },
                    ],
                    correctOptionId: "opt-3-3-b",
                    hint: "First find IQR = Q3 - Q1 = 15. Then calculate Q3 + (1.5 × IQR).",
                    explanation: "IQR = 35 - 20 = 15. The 1.5 × IQR step is 1.5 × 15 = 22.5. Adding this to Q3 gives the upper threshold: 35 + 22.5 = 57.5. Any value greater than 57.5 is flagged as a potential outlier.",
                },
            ],
        },
        {
            id: "lesson-4-reading-charts",
            title: "Reading Charts",
            summary: "Interpret histograms, box plots, and scatter plots to draw valid conclusions about data distributions.",
            content: `
### Visualizing Data: Histograms, Box Plots, and Scatter Plots

Graphical displays are essential tools for spotting patterns, symmetry, skewness, and outliers that single summary statistics might conceal (**OpenIntro Statistics §2.1.2 & §2.1.3**).

#### 1. Histograms
A **histogram** groups numerical data into adjacent, non-overlapping bins along the horizontal axis, with vertical bar heights representing frequency (or count).

- **Shape & Symmetry**:
  - *Symmetric / Bell-shaped*: Bars taper evenly in both directions from a central peak.
  - *Right-Skewed (Positive Skew)*: Most data clusters at lower values on the left, with a trailing tail extending toward high values on the right (e.g., student transport wait times).
  - *Left-Skewed (Negative Skew)*: Most data clusters at high values, with a tail dragging toward lower values on the left (e.g., exam scores on an easy revision test).
- **Modality**: Number of prominent peaks—*unimodal* (one peak), *bimodal* (two peaks, suggesting two sub-populations), or *multimodal*.

\`\`\`
   Frequency (Right-Skewed Commute Times)
   16 |   █
   12 |   █  █
    8 |   █  █  █
    4 |   █  █  █  █  █  █
    0 +---------------------------
       0  10 20 30 40 50 60 Minutes
\`\`\`

#### 2. Box Plots (Box-and-Whisker Plots)
A **box plot** visually summarizes the **Five-Number Summary**:
1. Minimum (excluding outliers)
2. First Quartile ($Q_1$)
3. Median ($Q_2$)
4. Third Quartile ($Q_3$)
5. Maximum (excluding outliers)

\`\`\`
          o (Outlier)
      |---|---------|-------|   *
     Min  Q1     Median    Q3  Max
          [==== IQR ====]
\`\`\`

- The box spans from $Q_1$ to $Q_3$, enclosing the middle 50% (the IQR).
- A vertical line inside the box marks the median.
- Whiskers reach out to the nearest data points within $1.5 \\times \\text{IQR}$.
- Individual dots beyond the whiskers represent suspected outliers.

#### 3. Scatter Plots
A **scatter plot** plots two numerical variables against each other as coordinates $(x, y)$ on a Cartesian plane:
- **Direction**: Positive association (as $x$ rises, $y$ tends to rise) or Negative association (as $x$ rises, $y$ falls).
- **Form**: Linear (points follow a straight trend line) or Non-linear.
- **Strength**: How closely the points cluster along the underlying trend.
`,
            sources: [
                {
                    id: "source-openintro-2-1-2",
                    title: "OpenIntro Statistics (4th Edition) — §2.1.2 Histograms and Shape",
                    author: "David Diez, Mine Çetinkaya-Rundel, Christopher Barr",
                    license: "Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)",
                    section: "Chapter 2: Summarizing Data, Section 2.1.2 & 2.1.3",
                    excerpt: "A histogram provides a view of data density. Higher bars represent where the data are relatively more common. When data trail off to the right, the distribution is right-skewed. A box plot summarizes the five-number summary and uses whiskers to show the bulk of the data while identifying potential outliers as individual points.",
                    url: "https://www.openintro.org/book/os/",
                },
            ],
            questions: [
                {
                    id: "q-4-1",
                    prompt: "A histogram of student shuttle queue wait times shows a tall peak between 5 and 10 minutes, with the bars gradually trailing off out to 55 minutes on the far right. How is this distribution described?",
                    options: [
                        { id: "opt-4-1-a", text: "Right-skewed (positively skewed)" },
                        { id: "opt-4-1-b", text: "Left-skewed (negatively skewed)" },
                        { id: "opt-4-1-c", text: "Symmetric and uniform" },
                        { id: "opt-4-1-d", text: "Bimodal and normal" },
                    ],
                    correctOptionId: "opt-4-1-a",
                    hint: "Skewness is named after the direction in which the long tail stretches, not where the main hump sits.",
                    explanation: "When data clusters at smaller values and trails off with a long tail toward larger values on the right, the distribution is right-skewed (or positively skewed).",
                },
                {
                    id: "q-4-2",
                    prompt: "In a box plot, what do the left and right boundaries (edges) of the central rectangular box represent?",
                    options: [
                        { id: "opt-4-2-a", text: "The minimum and maximum values in the dataset" },
                        { id: "opt-4-2-b", text: "The first quartile (Q1) and third quartile (Q3)" },
                        { id: "opt-4-2-c", text: "The mean minus standard deviation and mean plus standard deviation" },
                        { id: "opt-4-2-d", text: "The 10th and 90th percentiles" },
                    ],
                    correctOptionId: "opt-4-2-b",
                    hint: "Recall that the central box represents the Interquartile Range (IQR = Q3 - Q1), which contains the middle 50% of observations.",
                    explanation: "The central box of a box plot is bounded by the first quartile (Q1) at the lower edge and the third quartile (Q3) at the upper edge, with the median drawn as a line inside.",
                },
                {
                    id: "q-4-3",
                    prompt: "A scatter plot comparing weekly tutorial attendance (x) and final statistics exam scores (y) shows points sloping upwards from lower left to upper right. What does this indicate?",
                    options: [
                        { id: "opt-4-3-a", text: "A positive association between attendance and exam score" },
                        { id: "opt-4-3-b", text: "A negative association between attendance and exam score" },
                        { id: "opt-4-3-c", text: "Zero correlation between the two variables" },
                        { id: "opt-4-3-d", text: "A categorical distribution error" },
                    ],
                    correctOptionId: "opt-4-3-a",
                    hint: "If higher values of x correspond to higher values of y, the relationship has a positive direction.",
                    explanation: "When points trend upward from bottom-left to top-right, increases in the explanatory variable (tutorial attendance) are associated with increases in the response variable (exam scores), indicating a positive association.",
                },
            ],
        },
        {
            id: "lesson-5-interpreting-a-dataset",
            title: "Interpreting a Small Dataset",
            summary: "Apply summary statistics and critical thinking to interpret tabular student data and avoid hasty generalizations.",
            content: `
### Critical Thinking: Interpreting Small Datasets

In academic research, laboratory practicals, and data projects, you will often inspect raw data tables. Being able to extract key insights, verify calculations, and recognize the limitations of small sample sizes ($n$) is a vital skill.

#### Sample Case Study: Campus Internet Data & Study Habits
Consider a sample of 6 university students surveyed during revision week in an off-campus hostel:

| Student ID | Gender | Level | Weekly Study (Hours) | Weekly Mobile Data (GB) | Midterm Score (%) |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **ST-01** | Female | 300L | 18 | 4.0 | 78 |
| **ST-02** | Male | 200L | 12 | 6.5 | 65 |
| **ST-03** | Male | 400L | 25 | 3.5 | 88 |
| **ST-04** | Female | 100L | 10 | 8.0 | 54 |
| **ST-05** | Female | 300L | 20 | 5.0 | 82 |
| **ST-06** | Male | 300L | 15 | 12.0 | 71 |

#### Extracting Key Insights

1. **Identifying Variables and Units**:
   - Observational Unit: An individual student ($n = 6$).
   - Categorical Variables: Gender (Nominal), Level (Ordinal).
   - Numerical Variables: Weekly Study Hours (Discrete/Continuous), Mobile Data (Continuous), Midterm Score (Continuous).

2. **Calculating Summary Statistics for Weekly Study Hours**:
   - Sorted hours: $10, 12, 15, 18, 20, 25$.
   - Sample Size $n = 6$ (even number).
   - **Median**: Average of 3rd and 4th values = $\\frac{15 + 18}{2} = 16.5 \\text{ hours}$.
   - **Mean**: $\\bar{x} = \\frac{10 + 12 + 15 + 18 + 20 + 25}{6} = \\frac{100}{6} \\approx 16.67 \\text{ hours}$.
   - **Range**: $25 - 10 = 15 \\text{ hours}$.

3. **Spotting Relationships**:
   - Students who studied 18, 20, and 25 hours scored 78%, 82%, and 88%.
   - Students who studied 10 and 12 hours scored 54% and 65%.
   - There appears to be a clear positive relationship between study hours and exam score.

#### Avoiding Common Pitfalls with Small Samples
- **Small Sample Limitations ($n = 6$)**: While informative for pilot studies, 6 students from one hostel cannot be generalized to the entire university body (generalizability requires larger, randomized sampling).
- **Correlation is Not Direct Causation**: Other unmeasured variables (such as prior preparation or course difficulty) might explain the differences.
- **Check for Data Entry Anomalies**: Student ST-06 reported 12.0 GB of data in one week, which is twice the sample average. Is this an outlier or a transcription error?
`,
            sources: [
                {
                    id: "source-openintro-1-overview",
                    title: "OpenIntro Statistics (4th Edition) — Chapter 1 & 2 Summary",
                    author: "David Diez, Mine Çetinkaya-Rundel, Christopher Barr",
                    license: "Creative Commons Attribution-ShareAlike 3.0 Unported (CC BY-SA 3.0)",
                    section: "Chapter 1: Introduction to Data & Chapter 2: Summarizing Data",
                    excerpt: "When working with small datasets, analysts must verify data integrity, calculate both mean and median, and avoid making sweeping generalizations to wider populations without considering sampling design and potential confounding variables.",
                    url: "https://www.openintro.org/book/os/",
                },
            ],
            questions: [
                {
                    id: "q-5-1",
                    prompt: "Using the table of 6 students above, what is the sample median for Weekly Study Hours?",
                    options: [
                        { id: "opt-5-1-a", text: "16.5 hours" },
                        { id: "opt-5-1-b", text: "15.0 hours" },
                        { id: "opt-5-1-c", text: "18.0 hours" },
                        { id: "opt-5-1-d", text: "16.67 hours" },
                    ],
                    correctOptionId: "opt-5-1-a",
                    hint: "Sort the 6 values (10, 12, 15, 18, 20, 25) and calculate the average of the two middle values at positions 3 and 4.",
                    explanation: "The sorted values are 10, 12, 15, 18, 20, 25. Since n = 6 is even, the median is the midpoint between the 3rd value (15) and the 4th value (18): (15 + 18) / 2 = 16.5 hours. (Note that 16.67 is the sample mean).",
                },
                {
                    id: "q-5-2",
                    prompt: "Based on the table, which of the following is an accurate interpretation of the observational unit?",
                    options: [
                        { id: "opt-5-2-a", text: "Each individual university student surveyed" },
                        { id: "opt-5-2-b", text: "The entire university student union" },
                        { id: "opt-5-2-c", text: "The midterm examination test paper" },
                        { id: "opt-5-2-d", text: "The weekly mobile data gigabytes" },
                    ],
                    correctOptionId: "opt-5-2-a",
                    hint: "What entity does each individual row in the data matrix represent?",
                    explanation: "In a tidy data matrix, each row represents an observational unit (case). In this study, each row corresponds to an individual surveyed student (ST-01, ST-02, etc.).",
                },
                {
                    id: "q-5-3",
                    prompt: "Why would a researcher be cautious about claiming that 'studying more than 20 hours guarantees an A grade for all Nigerian university students' based on this dataset?",
                    options: [
                        { id: "opt-5-3-a", text: "The sample size (n = 6) is too small and not broadly representative of all university students." },
                        { id: "opt-5-3-b", text: "Statistical calculations are illegal with fewer than 50 observations." },
                        { id: "opt-5-3-c", text: "Midterm scores are categorical variables and cannot be analyzed." },
                        { id: "opt-5-3-d", text: "The median was smaller than the mean." },
                    ],
                    correctOptionId: "opt-5-3-a",
                    hint: "Think about the limits of generalizing findings from a sample of 6 students in one hostel to hundreds of thousands of students across the country.",
                    explanation: "A small convenience sample of 6 students has high sampling variability and cannot represent the diverse student population across institutions. Generalization requires adequate sample sizes and representative sampling methods.",
                },
            ],
        },
    ],
    practicalActivity: {
        id: "activity-campus-transport",
        title: "Campus Transport Cost Analysis (Practical Task)",
        scenario: "University students in Nigeria spend a substantial fraction of their monthly allowance on daily commute shuttles, tricycles (keke), minibuses (danfo), and motorcycles (okada). Analyze this synthetic dataset of 10 student campus routes to calculate central tendency and detect outliers.",
        datasetTitle: "Campus Commute Routes & Daily Fares (₦)",
        dataset: [
            { id: "dp-1", route: "Campus Main Gate ⇄ Faculty of Science", mode: "Campus Shuttle Bus", costNaira: 200, distanceKm: 2.5, notes: "Official campus shuttle" },
            { id: "dp-2", route: "Off-Campus Akoka ⇄ Main Gate", mode: "Tricycle (Keke)", costNaira: 250, distanceKm: 3.0, notes: "Shared commercial keke" },
            { id: "dp-3", route: "Hostel Block ⇄ Teaching Hospital", mode: "Motorcycle (Okada)", costNaira: 500, distanceKm: 4.2, notes: "Fast single-passenger trip" },
            { id: "dp-4", route: "North Gate ⇄ Faculty of Arts", mode: "Campus Shuttle Bus", costNaira: 150, distanceKm: 1.8, notes: "Subsidized intra-campus route" },
            { id: "dp-5", route: "Bariga Junction ⇄ Main Gate", mode: "Minibus (Danfo)", costNaira: 300, distanceKm: 3.5, notes: "Shared public transit" },
            { id: "dp-6", route: "Main Library ⇄ Off-Campus Lodge", mode: "Tricycle (Keke)", costNaira: 250, distanceKm: 2.2, notes: "Evening return commute" },
            { id: "dp-7", route: "South Gate ⇄ Engineering Complex", mode: "Campus Shuttle Bus", costNaira: 200, distanceKm: 2.0, notes: "Fixed student rate" },
            { id: "dp-8", route: "Student Union Building ⇄ Sports Center", mode: "Tricycle (Keke)", costNaira: 200, distanceKm: 1.5, notes: "Short internal ride" },
            { id: "dp-9", route: "Expressway Bus Stop ⇄ Campus Gate", mode: "Minibus (Danfo)", costNaira: 350, distanceKm: 5.0, notes: "Inter-district minibus" },
            { id: "dp-10", route: "Emergency Night Charter ⇄ Off-Campus Lodge", mode: "Private Charter", costNaira: 1200, distanceKm: 4.0, notes: "Single-passenger late-night hire (Outlier!)" },
        ],
        tasks: [
            {
                id: "pt-1",
                prompt: "Sort the 10 transport costs in ascending order: 150, 200, 200, 200, 250, 250, 300, 350, 500, 1200. What is the sample median transport cost in Naira (₦)?",
                type: "choice",
                options: [
                    { id: "opt-pt-1-a", text: "₦250" },
                    { id: "opt-pt-1-b", text: "₦360" },
                    { id: "opt-pt-1-c", text: "₦200" },
                    { id: "opt-pt-1-d", text: "₦300" },
                ],
                correctAnswer: "opt-pt-1-a",
                hint: "For n = 10 values, take the average of the 5th value (₦250) and the 6th value (₦250).",
                explanation: "The sorted fares are: 150, 200, 200, 200, [250, 250], 300, 350, 500, 1200. The 5th and 6th values are both ₦250, so the median is (250 + 250) / 2 = ₦250. Note that the mean is ₦360, which is inflated by the ₦1,200 emergency charter.",
            },
            {
                id: "pt-2",
                prompt: "The lower quartile is Q1 = ₦200 (at position 3) and the upper quartile is Q3 = ₦350 (at position 8). What is the Interquartile Range (IQR)?",
                type: "choice",
                options: [
                    { id: "opt-pt-2-a", text: "₦150" },
                    { id: "opt-pt-2-b", text: "₦1,050" },
                    { id: "opt-pt-2-c", text: "₦275" },
                    { id: "opt-pt-2-d", text: "₦550" },
                ],
                correctAnswer: "opt-pt-2-a",
                hint: "Use the formula IQR = Q3 - Q1.",
                explanation: "IQR = Q3 - Q1 = ₦350 - ₦200 = ₦150. The middle 50% of regular student transport fares vary within a concise span of ₦150.",
            },
            {
                id: "pt-3",
                prompt: "Using the 1.5 × IQR outlier test: Q3 + (1.5 × 150) = 350 + 225 = ₦575. Does the ₦1,200 private charter qualify as a statistical outlier?",
                type: "choice",
                options: [
                    { id: "opt-pt-3-a", text: "Yes, because ₦1,200 is greater than the upper cutoff of ₦575." },
                    { id: "opt-pt-3-b", text: "No, because all 10 rides happened on campus." },
                    { id: "opt-pt-3-c", text: "No, because outliers can only be negative numbers." },
                    { id: "opt-pt-3-d", text: "Cannot be determined without a 1,000-case sample." },
                ],
                correctAnswer: "opt-pt-3-a",
                hint: "Compare the observed value of ₦1,200 against the upper boundary of ₦575.",
                explanation: "Because ₦1,200 exceeds the upper threshold of ₦575 (Q3 + 1.5 × IQR), it is mathematically confirmed as an outlier in this transport dataset.",
            },
        ],
    },
    nextStepCard: {
        title: "Connecting Statistics to Real-World Work",
        headline: "How University Statistics Unlocks Careers and High-Impact Research",
        description: "Foundational data literacy is one of the highest-leverage skills for Nigerian undergraduates across sciences, engineering, social sciences, and humanities.",
        opportunities: [
            {
                id: "opp-1",
                title: "Academic & Final Year Project (FYP) Excellence",
                sector: "University Research",
                description: "Design rigorous survey questionnaires, avoid sampling bias, correctly present mean vs median in your thesis, and produce publication-ready charts.",
                relevantSkills: ["Sampling Design", "Descriptive Statistics", "Chart Interpretation"],
                actionPrompt: "Apply median and IQR to your own thesis or department seminar dataset.",
            },
            {
                id: "opp-2",
                title: "Data Analyst & Business Intelligence Roles",
                sector: "Tech & Fintech Ecosystem",
                description: "Fintechs, telecoms, and logistics firms (e.g., Paystack, Flutterwave, Moniepoint, MTN) rely on analysts who can spot anomalies, calculate cohort medians, and diagnose skewed transaction patterns.",
                relevantSkills: ["Outlier Detection", "Exploratory Data Analysis", "Metrics Reporting"],
                actionPrompt: "Explore open datasets on Kaggle or download Nigerian macroeconomic data from the National Bureau of Statistics (NBS).",
            },
            {
                id: "opp-3",
                title: "Public Health & NGO Monitoring & Evaluation (M&E)",
                sector: "Development & Public Policy",
                description: "Development organizations evaluate program effectiveness using sample statistics, tracking health indicators, and assessing localized community interventions.",
                relevantSkills: ["Variable Categorization", "Interquartile Ranges", "Tabular Analysis"],
                actionPrompt: "Review open health surveillance indicators from WHO Africa or Nigeria CDC.",
            },
        ],
    },
};
