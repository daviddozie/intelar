"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUpRight, ArrowRight, BookOpen, Check, FileText, Globe2, GraduationCap, Layers3, Pause, Play, Search, UsersRound, Sun, Moon, Download, ClipboardCheck, FolderOpen } from "lucide-react";
import IntelarLogo from "@/components/svg";
import { useChat } from "@/context/chat-context";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import PrincipleVisual from "./principle-visual";
import styles from "./landing-page.module.css";

const examples = [
  {
    label: "Research", icon: Search, prompt: "Help me understand renewable energy in Nigeria.",
    title: "A clearer picture, with sources.",
    description: "Explore a topic from different angles. Get a structured answer, then follow the sources and ask better questions.",
    items: ["Search across the web", "Compare perspectives", "Follow cited sources"],
    output: "Start with the big picture. Solar, hydro and wind each play a different role. Compare their potential, costs and practical constraints before drawing a conclusion.",
    sources: ["Web sources", "Related research", "Your follow-up questions"], href: "/chat", action: "Start researching",
  },
  {
    label: "Learn", icon: GraduationCap, prompt: "Turn my statistics notes into a study path.",
    title: "Go from reading to understanding.",
    description: "Bring your resources, build a personal study path, and put each lesson into practice. Continue with downloaded lessons when you’re offline.",
    items: ["Lessons from your resources", "Practice with explanations", "Save progress and learn offline"],
    output: "Your next step: mean and median. Read a worked example, try a practice question, and revisit the source whenever you need more context.",
    sources: ["Source references", "Practice questions", "Saved progress"], href: "/learn", action: "Explore learning",
  },
  {
    label: "Collaborate", icon: UsersRound, prompt: "Give our research group a shared place to think.",
    title: "Build understanding together.",
    description: "Invite people into a workspace. Keep your conversations and resources together so your group can explore ideas with shared context.",
    items: ["Invite your peers", "Share research materials", "Discuss in one workspace"],
    output: "One workspace for your group’s questions, documents and discussions. Bring your sources into the conversation and keep the research moving together.",
    sources: ["Shared resources", "Group conversations", "Workspace invitations"], href: "/workspaces", action: "Open workspaces",
  },
];

const questions = [
  ["What can I do with Intelar?", "Research topics with web sources, ask questions about documents, create study paths, practise what you learn, prepare for exams, and collaborate in shared workspaces."],
  ["Do I need an account to try it?", "You can try research chat and explore the sample learning course without signing in. An account is needed for saved conversations, private study paths, and shared workspaces."],
  ["Can I bring my own materials?", "Yes. Add supported documents to your resources and use them as context for research or a personal study path. Upload only materials you’re authorized to use."],
  ["Does it work offline?", "Downloaded lessons and practice can be used offline. Live research, AI tutoring, and workspace collaboration need an internet connection."],
  ["How should I use AI-generated answers?", "Use the linked sources to check important claims. AI can make mistakes, so review answers and learning materials alongside the original sources."],
];

export default function LandingPage() {
  const { theme, toggleTheme } = useChat();
  const [activeExample, setActiveExample] = useState(0);
  const [paused, setPaused] = useState(false);
  const example = examples[activeExample];

  return (
    <div className={`${styles.page} ${paused ? styles.paused : ""}`}>
      <a href="#main" className={styles.skip}>Skip to content</a>
      <header className={styles.header}>
        <Link href="/" aria-label="Intelar home" className={styles.brand}><IntelarLogo size={30} /><span>intelar</span></Link>
        <nav aria-label="Main navigation" className={styles.nav}>
          <a href="#possibilities">Product</a>
          <a href="#resources">Resources & study</a>
          <a href="#how-it-works">How it works</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className={styles.headerActions}>
          <button onClick={toggleTheme} className={styles.themeToggle} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`} title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}>
            {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <Link href="/login?callbackUrl=%2Fchat" className={styles.loginLink}>Log in</Link>
          <Link href="/chat" className={styles.openApp}>Open Intelar <ArrowUpRight size={15} /></Link>
        </div>
      </header>

      <main id="main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={styles.heroGlow} aria-hidden="true" />
          <p className={styles.eyebrow}><span className={styles.statusDot} /> Research. Learning. Collaboration.</p>
          <h1 id="hero-title">The research and learning<br className={styles.desktopBreak} /> space for curious minds.</h1>
          <p className={styles.heroDescription}>Explore the web. Understand your documents. Build a study path. Intelar brings AI research, personal learning, and shared workspaces into one place.</p>
          <div className={styles.heroActions}>
            <Link href="/chat" className={styles.primary}>Start exploring <ArrowUpRight size={18} /></Link>
            <a href="#possibilities" className={styles.secondary}>See how it works <ArrowDown size={16} /></a>
          </div>
          <p className={styles.heroNote}>Try a conversation. Follow your curiosity.</p>

          <div className={styles.heroProduct} aria-label="Illustrative Intelar research preview">
            <aside className={styles.miniSidebar} aria-hidden="true">
              <div className={styles.miniBrand}><IntelarLogo size={22} /> Intelar</div>
              <span className={styles.selectedItem}><Search size={14} /> Research</span>
              <span><GraduationCap size={14} /> Learn</span>
              <span><ClipboardCheck size={14} /> Exam prep</span>
              <span><FolderOpen size={14} /> Resources</span>
              <span><UsersRound size={14} /> Workspaces</span>
              <div className={styles.miniProject}><small>YOUR EXPLORATIONS</small><span>Renewable energy</span><span>Statistics study path</span></div>
            </aside>
            <div className={styles.heroResearch}>
              <div className={styles.heroResearchBar}><span>Renewable energy in Nigeria</span><span>Product preview</span></div>
              <div className={styles.heroResearchContent}>
                <p className={styles.heroPrompt}>What should I understand about renewable energy in Nigeria?</p>
                <div className={styles.researchProgress} data-ambient><span><Search size={13} /> Search sources</span><span><FileText size={13} /> Read & compare</span><span><Check size={13} /> Build context</span></div>
                <div className={styles.heroAnswer}><IntelarLogo size={24} /><div><h3>A question worth exploring.</h3><p>Start with the energy mix, then compare solar, hydro, and wind. Look at how infrastructure, investment, and access shape what is practical.</p><p>Follow the sources. Compare the trade-offs. Ask what matters for your own research.</p><div className={styles.heroSourceRow}><span><Globe2 size={13} /> Web research</span><span><FileText size={13} /> Your documents</span><span><BookOpen size={13} /> Related ideas</span></div></div></div>
                <div className={styles.previewComposer}>Ask a follow-up question…<ArrowUpRight size={16} /></div>
              </div>
            </div>
          </div>
          <button className={styles.motionControl} onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? <Play size={12} /> : <Pause size={12} />}{paused ? "Play animation" : "Pause animation"}</button>
        </section>

        <div className={styles.audience}><span>For the way you think.</span><p>Students <span>/</span> Researchers <span>/</span> Builders <span>/</span> Curious people</p></div>


        <section className={`${styles.section} ${styles.overview}`} aria-labelledby="overview-title">
          <p className={styles.eyebrow}>Built around understanding</p>
          <h2 id="overview-title">One space to make sense of more. <span>Intelar connects the information you find, the resources you bring, and the people you learn with.</span></h2>
          <div className={styles.principles}>
            {[
              {title: "Grounded in sources", text: "Research with web search and document context. Follow citations back to the material behind an answer.", kind: "sources" as const},
              {title: "Made for learning", text: "Turn resources into lessons, try practice questions, and revisit what you need at your own pace.", kind: "learning" as const},
              {title: "Better together", text: "Bring peers into a workspace, share materials, and keep your research discussions in one place.", kind: "peers" as const},
            ].map(({title, text, kind}, index) => <article key={title}><span className={styles.figureLabel}>FIG 0.{index + 1}</span><PrincipleVisual kind={kind} /><h3>{title}</h3><p>{text}</p></article>)}
          </div>
        </section>

        <section id="possibilities" className={styles.section} aria-labelledby="possibilities-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>01 / Follow the question</p><h2 id="possibilities-title">More than an answer.<br /><span>A place to take it further.</span></h2><p>Some questions need research. Others become a lesson.<br className={styles.desktopBreak} /> The best ones bring people together.</p></div>
          <div className={styles.tabs} aria-label="Explore Intelar capabilities">
            {examples.map(({ label, icon: Icon }, index) => <button key={label} aria-pressed={activeExample === index} onClick={() => setActiveExample(index)} className={activeExample === index ? styles.activeTab : ""}><Icon size={16} />{label}</button>)}
          </div>
          <div className={styles.examplePanel}>
            <div className={styles.exampleCopy} aria-live="polite">
              <h3>{example.title}</h3><p>{example.description}</p>
              <ul>{example.items.map(item => <li key={item}><Check size={16} />{item}</li>)}</ul>
              <Link href={example.href} className={styles.textLink}>{example.action}<ArrowRight size={17} /></Link>
            </div>
            <div className={styles.productPreview}>
              <div className={styles.previewBar}><span><IntelarLogo size={18} /> Intelar</span><span>Illustrative preview</span></div>
              <div key={example.label} className={styles.previewBody}>
                <p className={styles.prompt}>{example.prompt}</p>
                <div className={styles.answer}><IntelarLogo size={20} /><div><span className={styles.answerLabel}>{example.label === "Research" ? "From question to context" : example.label === "Learn" ? "Your learning path" : "Your shared workspace"}</span><p>{example.output}</p></div></div>
                <div className={styles.sourceTags}>{example.sources.map(source => <span key={source}><Layers3 size={12} />{source}</span>)}</div>
                <div className={styles.previewComposer}>Keep the curiosity going…<ArrowUpRight size={15} /></div>
              </div>
            </div>
          </div>
        </section>


        <section id="resources" className={`${styles.section} ${styles.resourcesSection}`} aria-labelledby="resources-title">
          <div className={styles.detailHeading}><div><p className={styles.eyebrow}>Your materials. More possibilities.</p><h2 id="resources-title">Keep the context.<br />Build the understanding.</h2></div><p>Research is only the beginning. Bring your documents into Intelar and choose what comes next: a clearer explanation, a study session, or a conversation with your peers.</p></div>
          <div className={styles.featureGrid}>
            <article><FolderOpen size={24} /><h3>A library for your research.</h3><p>Keep supported PDFs, Word documents, CSV files, and text resources together. Attach a resource to a chat to ask questions about the material you’re working with.</p><Link href="/resources">Explore resources <ArrowUpRight size={15} /></Link></article>
            <article><GraduationCap size={24} /><h3>A path through your materials.</h3><p>Create a personal study path from selected resources. Review the outline, work through short lessons with source references, and practise with hints and explanations.</p><Link href="/learn">Explore learning <ArrowUpRight size={15} /></Link></article>
            <article><ClipboardCheck size={24} /><h3>Practice with a purpose.</h3><p>Prepare for exams using your study materials. Work through practice questions, review your results, and return to the topics that need more attention.</p><Link href="/exam-prep">Explore exam prep <ArrowUpRight size={15} /></Link></article>
            <article><Download size={24} /><h3>Keep learning offline.</h3><p>Download lessons and practice for later. Continue through a connection interruption, then synchronize your progress when you reconnect. Live AI research and tutoring still need the internet.</p><Link href="/learn">Start with a sample course <ArrowUpRight size={15} /></Link></article>
          </div>
          <div className={styles.workspaceStrip}><div className={styles.workspacePeople} aria-hidden="true"><span>A</span><span>B</span><span>You</span></div><div><h3>Your group’s work, in one workspace.</h3><p>Invite peers, share resources, and discuss ideas with shared context. Sign in to create or join a workspace.</p></div><Link href="/workspaces">Think together <ArrowUpRight size={16} /></Link></div>
        </section>

        <section id="how-it-works" className={`${styles.section} ${styles.workflow}`} aria-labelledby="workflow-title">
          <div className={styles.sectionHeading}><p className={styles.eyebrow}>02 / Make it your own</p><h2 id="workflow-title">Start anywhere.<br /><span>Keep moving forward.</span></h2></div>
          <div className={styles.steps}>
            <article><span className={styles.stepNumber}>01</span><h3>Bring a question.</h3><p>A topic you’re exploring. A document you’re reading. Something you don’t quite understand yet.</p><Search size={24} /></article>
            <article><span className={styles.stepNumber}>02</span><h3>Find the connections.</h3><p>Explore answers with sources, ask follow-up questions, or turn your materials into a study path.</p><Layers3 size={24} /></article>
            <article><span className={styles.stepNumber}>03</span><h3>Make it useful.</h3><p>Practise a new skill, prepare for an exam, or share resources and ideas with your workspace.</p><ArrowUpRight size={24} /></article>
          </div>
        </section>

        <section id="questions" className={`${styles.section} ${styles.faq}`} aria-labelledby="faq-title">
          <div><p className={styles.eyebrow}>03 / A little more context</p><h2 id="faq-title">Good questions.<br /><span>Clear answers.</span></h2></div>
          <Accordion type="single" collapsible className={styles.faqList}>
            {questions.map(([question, answer], index) => <AccordionItem key={question} value={`question-${index}`} className={styles.faqItem}><AccordionTrigger className={styles.faqTrigger}>{question}</AccordionTrigger><AccordionContent className={styles.faqContent}>{answer}</AccordionContent></AccordionItem>)}
          </Accordion>
        </section>

        <section className={styles.finalCta} aria-labelledby="cta-title"><div className={styles.ctaGlow} aria-hidden="true" /><IntelarLogo size={42} /><p className={styles.eyebrow}>Your next idea starts here</p><h2 id="cta-title">What are you curious about?</h2><Link href="/chat" className={styles.primary}>Let’s find out <ArrowUpRight size={18} /></Link></section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerIntro}><Link href="/" className={styles.brand}><IntelarLogo size={28} /><span>Intelar</span></Link><p>A space for research,<br />learning, and shared ideas.</p></div>
        <div><h3>Product</h3><Link href="/chat">Research chat</Link><Link href="/resources">Resources</Link><Link href="/workspaces">Workspaces</Link></div>
        <div><h3>Learning</h3><Link href="/learn">Study paths</Link><Link href="/exam-prep">Exam preparation</Link><Link href="/learn">Offline study</Link></div>
        <div><h3>Explore</h3><a href="#how-it-works">How it works</a><a href="#questions">Common questions</a><Link href="/login?callbackUrl=%2Fchat">Log in</Link></div>
        <div className={styles.footerBottom}><p>Intelar. Follow the question.</p><span>AI answers are a starting point. Always check the sources.</span></div>
      </footer>
    </div>
  );
}
