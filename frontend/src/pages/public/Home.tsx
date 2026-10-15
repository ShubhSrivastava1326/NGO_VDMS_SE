import { useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowDown, ArrowRight, ArrowUpRight, BookOpen, Check, Heart, HeartHandshake, Leaf, MapPin, Plus, ReceiptText, ShieldCheck, Soup, Stethoscope } from "lucide-react";
import { campaignApi, eventApi } from "@/api/services";
import type { CampaignOut } from "@/api/types";
import { CampaignCard } from "@/components/CampaignViews";
import { usePageTitle } from "@/lib/hooks";
import { cn, dayNum, monthShort, inr } from "@/lib/format";
import { Reveal, RiseWords } from "@/motion/Reveal";
import { ButtonLink } from "@/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/ui/States";

const ease = [0.22, 1, 0.36, 1] as const;
const causes = [
  { value: "", label: "All causes", icon: Heart },
  { value: "education", label: "Education", icon: BookOpen },
  { value: "food & nutrition", label: "Food & relief", icon: Soup },
  { value: "healthcare", label: "Healthcare", icon: Stethoscope },
  { value: "environment", label: "Environment", icon: Leaf },
];

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const artY = useTransform(scrollYProgress, [0, 1], [0, 95]);
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 40]);
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const x = useSpring(pointerX, { stiffness: 70, damping: 25 });
  const y = useSpring(pointerY, { stiffness: 70, damping: 25 });
  function move(event: PointerEvent<HTMLDivElement>) {
    if (reduce || event.pointerType !== "mouse") return;
    const bounds = event.currentTarget.getBoundingClientRect();
    pointerX.set(((event.clientX - bounds.left) / bounds.width - 0.5) * 15);
    pointerY.set(((event.clientY - bounds.top) / bounds.height - 0.5) * 12);
  }
  return (
    <section className="home-hero" ref={ref} aria-labelledby="hero-title">
      <div className="hero-wash" aria-hidden="true" />
      <div className="container-page hero-grid">
        <motion.div className="hero-copy" style={{ y: reduce ? 0 : copyY }}>
          <motion.p className="hero-eyebrow" initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
            <span className="eyebrow-heart"><Heart size={13} fill="currentColor" /></span> A little kindness goes a long way
          </motion.p>
          <h1 id="hero-title" className="hero-heading">
            <RiseWords text="Small acts." delay={0.08} />
            <RiseWords text="Extraordinary" className="hero-emphasis" delay={0.22} />
            <span className="hero-last-line"><RiseWords text="impact." delay={0.36} /><svg className="hero-drawn-heart" viewBox="0 0 90 85" fill="none" aria-hidden="true"><motion.path d="M43 73C31 61 7 43 10 24C13 5 34 5 43 29C50 8 77 6 80 25C84 43 60 64 43 73Z" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.4, delay: 0.8 }} /></svg></span>
          </h1>
          <motion.div initial={reduce ? false : { opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.55, ease }}>
            <p className="hero-description">Give to a cause. Share your time.<br />Be the reason someone believes in a better tomorrow.</p>
            <div className="hero-actions">
              <ButtonLink to="/campaigns" size="lg" className="motion-button" iconRight={<ArrowUpRight size={18} />}>Explore causes</ButtonLink>
              <ButtonLink to="/register/volunteer" variant="secondary" size="lg" className="motion-button">Become a volunteer</ButtonLink>
            </div>
            <p className="hero-footnote"><ShieldCheck size={15} /> Thoughtful giving. Every contribution accounted for.</p>
          </motion.div>
        </motion.div>
        <motion.div className="hero-art" style={{ y: reduce ? 0 : artY }} onPointerMove={move} onPointerLeave={() => { pointerX.set(0); pointerY.set(0); }}>
          <svg className="hero-orbit" viewBox="0 0 700 550" fill="none" aria-hidden="true"><motion.path d="M38 323C-33 213 148 44 353 88C533 127 484 15 604 67C745 128 647 301 566 370" stroke="#d99aaa" strokeWidth="1.4" strokeDasharray="4 8" initial={{ pathLength: reduce ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.5, delay: 0.5 }} /></svg>
          <motion.div style={{ x: reduce ? 0 : x, y: reduce ? 0 : y }} className="hero-illustration-wrap">
            <motion.img className="hero-illustration" src="/images/community-hero.webp" width="1536" height="1024" fetchPriority="high" alt="Volunteers sharing books with children and planting a tree together" initial={reduce ? false : { opacity: 0, y: 35, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 1.15, delay: 0.2, ease }} />
          </motion.div>
          <motion.div className="hero-note hero-note-top" initial={reduce ? false : { opacity: 0, y: 20, rotate: -8 }} animate={{ opacity: 1, y: 0, rotate: -5 }} transition={{ delay: 0.9, duration: 0.8, ease }}>
            <span className="note-icon"><BookOpen size={22} /></span><span>A book today.<br /><strong>A brighter tomorrow.</strong></span>
          </motion.div>
          <motion.div className="hero-note hero-note-bottom" initial={reduce ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.1, duration: 0.8, ease }}>
            <span className="note-icon note-icon-green"><Leaf size={22} /></span><span>Good grows<br /><strong>when we give.</strong></span><Heart className="note-heart" size={16} />
          </motion.div>
          <span className="hero-spark hero-spark-one" aria-hidden="true">✳</span><span className="hero-spark hero-spark-two" aria-hidden="true">+</span>
          <p className="hero-art-caption">a little of your time. a world of difference.</p>
        </motion.div>
      </div>
      <div className="container-page hero-bottom"><a href="#causes" className="scroll-cue"><span><ArrowDown size={15} /></span> A little scroll. A little inspiration.</a><span className="hero-edition">GOOD PEOPLE. SHARED PURPOSE.</span></div>
    </section>
  );
}

function TrustStrip() {
  return <div className="trust-strip"><div className="container-page trust-grid">
    {[
      { icon: HeartHandshake, title: "A cause you connect with", copy: "Find something that matters to you." },
      { icon: ReceiptText, title: "Every donation, receipted", copy: "A record of the difference you make." },
      { icon: ShieldCheck, title: "Kindness with accountability", copy: "Campaign funds and spending recorded." },
    ].map(({ icon: Icon, title, copy }, i) => <Reveal key={title} delay={i * 0.1} className="trust-item"><span className="trust-icon"><Icon size={24} strokeWidth={1.5} /></span><div><h2>{title}</h2><p>{copy}</p></div></Reveal>)}
  </div></div>;
}

function VolunteerCard() {
  return <Link to="/register/volunteer" className="volunteer-cause-card group">
    <img src="/images/environment.jpg" alt="" loading="lazy" width={1000} height={667} />
    <div className="volunteer-cause-content"><span className="section-kicker">There’s more than one way to give</span><h3>Your time.<br />Someone’s<br /><em>turning point.</em></h3><span className="volunteer-card-link">Lend a helping hand <ArrowUpRight size={20} /></span></div>
  </Link>;
}

function CampaignSpotlight({ campaign }: { campaign?: CampaignOut }) {
  const reduce = useReducedMotion();
  const percent = Math.min(100, Math.max(0, campaign?.progress_percent ?? 0));
  return <div className="impact-art">
    <div className="impact-circle" aria-hidden="true" />
    <Reveal className="impact-dashboard" y={40}>
      <div className="impact-dashboard-top"><span className="section-kicker">A little giving, adding up</span><span className="live-label"><span />{campaign ? "Live campaign" : "Our promise"}</span></div>
      <h3>{campaign?.title ?? "Every contribution matters"}</h3>
      {campaign ? <>
        <div className="impact-funds"><div><span>Raised with kindness</span><strong>{inr(campaign.amount_raised)}</strong></div><div className="impact-ring"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="43" fill="none" stroke="#f6e9ec" strokeWidth="7" /><motion.circle cx="50" cy="50" r="43" fill="none" stroke="#861a45" strokeWidth="7" strokeLinecap="round" transform="rotate(-90 50 50)" initial={{ pathLength: reduce ? percent / 100 : 0 }} whileInView={{ pathLength: percent / 100 }} viewport={{ once: true }} transition={{ duration: 1.6, ease }} /></svg><span>{Math.round(percent)}<small>%</small></span></div></div>
        <div className="impact-goal"><span>One shared goal</span><strong>{inr(campaign.goal_amount)}</strong></div>
      </> : <p className="impact-placeholder">Choose a campaign, give what you can, and keep a receipt of your contribution.</p>}
      <div className="impact-checks"><p><Check size={15} /> Every completed donation recorded</p><p><Check size={15} /> Campaign spending tracked by the team</p></div>
      <Link to={campaign ? "/campaigns/" + campaign.campaign_id : "/campaigns"} className="text-link">{campaign ? "See this campaign" : "Explore our causes"}<ArrowRight size={17} /></Link>
    </Reveal>
    <Reveal className="receipt-float" delay={0.3} y={35}><span className="receipt-icon"><ReceiptText size={25} strokeWidth={1.6} /></span><div><strong>A receipt to keep.</strong><p>For every completed donation.</p></div><span className="receipt-check"><Check size={13} /></span></Reveal>
    <svg className="impact-scribble" viewBox="0 0 105 105" fill="none" aria-hidden="true"><path d="M11 83C8 36 64 9 83 26C102 45 56 55 48 38C41 23 63 8 88 10M72 3L90 9L81 23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
  </div>;
}

const faqs = [
  { question: "Can I donate without creating an account?", answer: "Yes. Choose a campaign, enter your details, and complete your donation as a guest. You’ll get a numbered receipt when the donation is completed. An optional donor account helps you keep your giving history in one place." },
  { question: "How do I become a volunteer?", answer: "Fill out the volunteer registration form with your interests and availability. Once the team approves your profile, you can sign up for upcoming events with available places and view your assigned tasks." },
  { question: "How is my contribution accounted for?", answer: "Every completed donation is recorded against its campaign and receives a numbered receipt. The team logs campaign spending with invoice references, and spending cannot exceed the funds raised." },
];

function HomeFaq() {
  const [open, setOpen] = useState<number | null>(0);
  return <section className="container-page home-faq" aria-labelledby="faq-title"><Reveal><p className="section-kicker">A little clarity</p><h2 id="faq-title" className="section-heading">Good questions.<br /><span>Honest answers.</span></h2><Link to="/help" className="text-link">More about giving <ArrowUpRight size={17} /></Link></Reveal><div className="home-faq-list">{faqs.map((faq, index) => <Reveal key={faq.question} delay={index * 0.06}><div className={cn("faq-item", open === index && "is-open")}><h3><button aria-expanded={open === index} aria-controls={"home-answer-" + index} id={"home-question-" + index} onClick={() => setOpen(open === index ? null : index)}>{faq.question}<Plus size={19} aria-hidden="true" /></button></h3><div className="faq-answer" id={"home-answer-" + index} role="region" aria-labelledby={"home-question-" + index} inert={open !== index}><div><p>{faq.answer}</p></div></div></div></Reveal>)}</div></section>;
}

export default function Home() {
  usePageTitle("Small acts. Extraordinary impact.");
  const [category, setCategory] = useState("");
  const reduce = useReducedMotion();
  const campaigns = useQuery({ queryKey: ["campaigns", "home", category], queryFn: () => campaignApi.list({ sort: "ending_soon", page_size: 3, category: category || undefined }) });
  const categories = useQuery({ queryKey: ["campaigns", "categories"], queryFn: campaignApi.categories });
  const spotlight = useQuery({ queryKey: ["campaigns", "spotlight"], queryFn: () => campaignApi.list({ sort: "most_funded", page_size: 1 }) });
  const events = useQuery({ queryKey: ["events", "home"], queryFn: () => eventApi.list({ page_size: 3 }) });
  const list = campaigns.data?.items ?? [];
  const extraCategories = (categories.data ?? []).filter((c) => !causes.some((known) => known.value === c));

  return <div className="home-page">
    <Hero />
    <TrustStrip />
    <section className="container-page causes-section" id="causes" aria-labelledby="causes-title">
      <Reveal className="section-topline"><div><p className="section-kicker">Find your reason to give</p><h2 className="section-heading" id="causes-title">A cause close to <span>your heart.</span></h2></div><Link to="/campaigns" className="text-link">View all causes <ArrowUpRight size={18} /></Link></Reveal>
      <div className="cause-filters" role="group" aria-label="Filter causes">
        {[...causes, ...extraCategories.map((value) => ({ value, label: value, icon: Heart }))].map(({ value, label, icon: Icon }) => <button key={value} type="button" className={cn("cause-filter", category === value && "is-selected")} aria-pressed={category === value} onClick={() => setCategory(value)}>
          {category === value && <motion.span className="filter-fill" layoutId="active-cause" transition={{ duration: reduce ? 0 : 0.35, ease }} />}<Icon size={16} strokeWidth={1.6} aria-hidden="true" /><span>{label}</span>
        </button>)}
      </div>
      <div className="campaign-results" aria-live="polite" aria-busy={campaigns.isFetching}>
        {campaigns.isLoading && <div className="home-campaign-grid" role="status" aria-label="Loading causes">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-[27rem] rounded-2xl" />)}</div>}
        {campaigns.isError && <ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} />}
        {campaigns.isSuccess && list.length === 0 && <EmptyState icon={<Heart size={22} />} title={category ? "New possibilities are on their way." : "More good things are on their way."} action={<ButtonLink to="/events" variant="secondary">Explore volunteer opportunities</ButtonLink>}>There aren’t any open {category || "fundraising"} campaigns right now. You can still give your time to a good cause.</EmptyState>}
        {list.length > 0 && <div className="home-campaign-grid">{list.map((c, i) => <Reveal key={c.campaign_id} delay={i * 0.1} y={30}><CampaignCard campaign={c} heading="h3" /></Reveal>)}{list.length < 3 && <Reveal delay={0.2} y={30}><VolunteerCard /></Reveal>}</div>}
      </div>
      <p className="campaign-photo-note">A glimpse of the causes we care about. Photos are illustrative.</p>
    </section>

    <section className="impact-section" id="impact" aria-labelledby="impact-title"><div className="container-page impact-grid"><Reveal className="impact-copy"><p className="section-kicker">Open hearts. Open records.</p><h2 className="section-heading" id="impact-title">Your kindness.<br /><span>Clearly accounted for.</span></h2><p>You give because you care. You deserve to know that your contribution is counted, recorded, and put towards the cause you chose.</p><ul><li><span><Check size={15} /></span>Campaign progress you can follow</li><li><span><Check size={15} /></span>A digital receipt for every completed donation</li><li><span><Check size={15} /></span>Spending recorded against the funds raised</li></ul><Link to="/help" className="text-link">The way we work <ArrowUpRight size={18} /></Link></Reveal><CampaignSpotlight campaign={spotlight.data?.items[0]} /></div></section>

    <section className="how-section container-page" id="about" aria-labelledby="how-title"><Reveal className="section-topline"><div><p className="section-kicker">Big-hearted. Beautifully simple.</p><h2 className="section-heading" id="how-title">A little from you.<br />A lot <span>to someone.</span></h2></div><p className="section-aside">You don’t need to change the whole world.<br />Just someone’s corner of it.</p></Reveal><div className="giving-steps">{[
      { no: "01", icon: Heart, title: "Find what moves you.", copy: "A classroom. A community. A healthier tomorrow. Start with a cause that feels close to home.", link: "/campaigns", action: "Find your cause" },
      { no: "02", icon: HeartHandshake, title: "Give in your own way.", copy: "Make a contribution or lend your time. There’s no single way to make a meaningful difference.", link: "/register/volunteer", action: "Explore volunteering" },
      { no: "03", icon: Leaf, title: "Watch kindness grow.", copy: "Follow your campaign’s funding progress and keep a record of each donation you complete.", link: "/register/donor", action: "Join as a donor" },
    ].map(({ no, icon: Icon, title, copy, link, action }, i) => <Reveal key={no} className="giving-step" delay={i * 0.12} y={28}><div className="giving-step-top"><span>{no}</span><Icon size={27} strokeWidth={1.3} /></div><h3>{title}</h3><p>{copy}</p><Link to={link} className="text-link">{action}<ArrowRight size={16} /></Link></Reveal>)}</div></section>

    <section className="volunteer-section" aria-labelledby="volunteer-title"><div className="volunteer-feature"><div className="volunteer-photo"><motion.img src="/images/volunteer.jpg" alt="Volunteers working together to distribute boxes of food" width={1400} height={933} loading="lazy" initial={{ scale: reduce ? 1 : 1.12 }} whileInView={{ scale: 1 }} viewport={{ once: true }} transition={{ duration: 1.8, ease }} /><div className="photo-caption"><span>Small moments. Shared purpose.</span><Heart size={23} /></div></div><div className="volunteer-feature-copy"><Reveal><p className="section-kicker">Bring your whole heart</p><h2 id="volunteer-title">Some of the best<br />things you can give<br /><span>aren’t things.</span></h2><p>Your time, your skills, your presence. Join a community of people who show up for something bigger than themselves.</p><ButtonLink to="/register/volunteer" variant="onDark" size="lg" className="motion-button" iconRight={<ArrowUpRight size={19} />}>Find your place</ButtonLink><Link className="volunteer-secondary" to="/events">Discover upcoming events <ArrowRight size={16} /></Link></Reveal><Heart className="volunteer-outline-heart" size={170} strokeWidth={0.5} aria-hidden="true" /></div></div>
      <div className="container-page upcoming-events"><div className="events-heading"><h3>Good things happening soon.</h3><Link to="/events" className="text-link">All events <ArrowUpRight size={17} /></Link></div>
        {events.isLoading && <Skeleton className="h-28" />}
        {events.isError && <ErrorState error={events.error} onRetry={() => events.refetch()} />}
        {events.isSuccess && events.data.items.length === 0 && <p className="text-ink-3 py-6">New opportunities are on their way. Register as a volunteer to be ready.</p>}
        <div className="home-events-grid">{events.data?.items.map((event, i) => <Reveal key={event.event_id} delay={i * 0.08}><Link className="home-event" to={"/events/" + event.event_id}><span className="event-date"><strong>{dayNum(event.event_date)}</strong><span>{monthShort(event.event_date)}</span></span><div><h4>{event.title}</h4><p><MapPin size={12} />{event.location}</p><span className="event-spots">{event.is_full ? "All places filled" : event.slots_remaining + " places to make a difference"}</span></div><ArrowUpRight size={18} className="event-arrow" /></Link></Reveal>)}</div>
      </div>
    </section>
    <HomeFaq />
    <section className="closing-section"><Reveal><p className="section-kicker">Every good thing starts somewhere</p><h2>Let it start <span>with you.</span><Heart size={43} strokeWidth={1.5} aria-hidden="true" /></h2><p>A little kindness. A shared purpose. A better tomorrow.</p><ButtonLink to="/campaigns" size="lg" className="motion-button" iconRight={<ArrowUpRight size={19} />}>Make a little difference</ButtonLink></Reveal><div className="closing-line" aria-hidden="true" /></section>
  </div>;
}


