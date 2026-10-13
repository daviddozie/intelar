export const publicFeatures = [
    {
        slug: "ai-research", title: "AI research with cited sources", label: "Research",
        description: "Explore topics with cited web research and document questions. Intelar helps students and researchers compare sources and ask useful follow-up questions.",
        introduction: "Learning often starts with a question and too many places to look. Intelar brings web research and your documents into one conversation, with source links you can follow and check.",
        appHref: "/chat", action: "Start researching",
        benefits: [
            ["Follow the evidence", "Explore a topic through web search and cited answers. Open the original sources to check important claims and compare perspectives."],
            ["Ask about your documents", "Add supported PDF, Word, CSV, or text materials to Resources and ask questions grounded in their contents. Use only documents you have permission to upload."],
            ["Go deeper with follow-up questions", "Use the research conversation to clarify terminology, compare arguments, and identify questions that deserve a closer look."],
        ],
        steps: ["Start with a focused question about the subject you want to understand.", "Read the answer and follow the cited sources.", "Ask a follow-up or bring an authorized document for more context."],
        example: "A student exploring renewable energy in Nigeria can compare solar, hydro, and wind, follow sources about their constraints, and ask how those findings relate to a class project.",
        limits: "Live research and document analysis need an internet connection. AI-generated answers can be wrong; source links help you check them, but they do not guarantee accuracy. Saved conversations require an account. Use non-sensitive materials while upload privacy improvements are pending.",
    },
    {
        slug: "personal-learning", title: "Personal study paths and offline learning", label: "Learning",
        description: "Turn your study documents into an editable learning path with cited lessons, practice, explanations, and downloadable packs for offline study in Intelar.",
        introduction: "Lecture notes and textbooks are useful only when you can make sense of them. Intelar helps you turn your own materials into a study path you can work through at your own pace.",
        appHref: "/learn", action: "Open Learn",
        benefits: [
            ["Build a path from your materials", "Select up to three authorized resources, describe your learning goal, and review an editable outline before preparing lessons."],
            ["Practise and check your understanding", "Read short lessons with source references, answer practice questions, and use hints and explanations to revisit difficult ideas. An online lesson tutor provides additional guidance."],
            ["Keep studying through interruptions", "Download a ready study path to keep its lessons and practice available offline. Attempts can synchronize when you reconnect, and you can remove downloaded materials when you need space."],
        ],
        steps: ["Sign in, add authorized study resources, and choose your learning goal.", "Review the proposed outline, then prepare your lessons and practice.", "Study, save your progress, and download the path before disconnecting."],
        example: "A university student studying statistics can turn course notes into a path, practise interpreting a dataset, and download the lessons before travelling through an area with unreliable mobile internet.",
        limits: "An account is required for personal study paths and synchronized progress. Creating lessons and using live tutoring require internet access. Offline study requires downloading the path first. Lesson content is AI-prepared and should be checked against the original material. English and French are available as path language choices; full multilingual support is not available.",
    },
    {
        slug: "exam-preparation", title: "Exam preparation from your course materials", label: "Exam preparation",
        description: "Prepare with timed practice exams from your documents, review answer explanations, and turn missed questions into a source-checked revision path in Intelar.",
        introduction: "Knowing what to revise is as useful as knowing your score. Intelar connects practice exams to a learning path based on the questions you missed or left unanswered.",
        appHref: "/exam-prep", action: "Open Exam Prep",
        benefits: [
            ["Practise under a timer", "Choose an authorized course document, difficulty, 10, 20, 30, or 50 questions, and a time limit. Navigate between questions and flag items to revisit."],
            ["Understand the result", "Review your score and question-by-question explanations. Use the document excerpts to compare answers with your course materials."],
            ["Turn mistakes into revision", "Choose Help me revise after an attempt to prepare up to five lessons covering missed and unanswered questions. Each supporting excerpt must match an owned source document before the plan is saved."],
        ],
        steps: ["Sign in, select your materials, and configure a practice exam.", "Complete the timed attempt and review its explanations.", "Create a revision plan, practise without a timer, and download it from Learn."],
        example: "After a physics practice exam, a learner can revisit missed force-and-motion questions, compare the saved working with the original manual, and retry those questions in Learn at their own pace.",
        limits: "These are AI-prepared practice simulations, not official past papers or credentials. Revision reuses the exam's questions and explanations; it is not a new independent assessment. An account and connectivity are required to prepare an exam or revision. Questions without verifiable source excerpts cannot create a revision plan.",
    },
    {
        slug: "collaborative-workspaces", title: "Collaborative research and study workspaces", label: "Collaboration",
        description: "Invite peers to an Intelar workspace, share study resources, discuss ideas, and organize research projects with your group in one place.",
        introduction: "Learning is often a shared effort. Intelar workspaces bring a group's resources and discussions together so peers can build understanding with shared context.",
        appHref: "/workspaces", action: "Open Workspaces",
        benefits: [
            ["Bring your peers together", "Create a workspace and invite classmates or research partners to participate."],
            ["Keep resources and discussion together", "Share authorized materials and discuss questions in workspace conversations rather than scattering the context across separate tools."],
            ["Organize group projects", "Use workspace projects to give a research or study effort a shared place. Members can refer back to the materials and conversations as the work develops."],
        ],
        steps: ["Sign in and create a workspace for your study or research group.", "Invite peers and add materials you have permission to share.", "Discuss questions, compare sources, and organize your work in projects."],
        example: "A campus research group can collect reading materials, discuss how to approach a survey, and keep project conversations together as classmates contribute.",
        limits: "Workspace participation requires an account and internet access. Offline lesson downloads do not make workspace collaboration available offline. Share only authorized, non-sensitive resources while upload privacy improvements are pending.",
    },
] as const;

export const publicPaths = ["/", "/features", ...publicFeatures.map((feature) => `/features/${feature.slug}`)];
