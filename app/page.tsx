'use client';
import Link from 'next/link';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import './landing.css';

function Reveal({ children, className = '', delay = 0, direction = 'up' }: {
  children: React.ReactNode; className?: string; delay?: number; direction?: 'up' | 'left' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [v, setV] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setV(true); obs.disconnect(); }
    }, { threshold: 0.08 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const transforms: Record<string, string> = { up: 'translateY(40px)', left: 'translateX(-40px)', right: 'translateX(40px)' };
  return (
    <div ref={ref} className={className} style={{ opacity: v ? 1 : 0, transform: v ? 'none' : transforms[direction], transition: `opacity 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms, transform 0.8s cubic-bezier(0.16,1,0.3,1) ${delay}ms` }}>
      {children}
    </div>
  );
}

const FEATURES = [
  { icon: '🛒', title: 'Smart Checkout', desc: 'Barcode scanning, split payments, instant receipts. Serve more customers in less time.', color: 'var(--primary)' },
  { icon: '📦', title: 'Inventory Control', desc: 'Real-time stock across all branches. Auto low-stock alerts. Never run out again.', color: 'var(--accent)' },
  { icon: '👥', title: 'Staff Management', desc: 'Shifts, attendance, payroll, leave requests — all your HR needs, one tab.', color: 'var(--secondary)' },
  { icon: '📊', title: 'Live Analytics', desc: 'Sales dashboards updating by the second. Spot trends, download reports instantly.', color: '#06b6d4' },
  { icon: '🏪', title: 'Multi-Branch', desc: 'One account, every location. Transfer stock and compare performance across sites.', color: '#10b981' },
  { icon: '🔔', title: 'Real-time Alerts', desc: 'Push notifications for shifts, leave decisions, low stock, and announcements.', color: 'var(--primary)' },
  { icon: '🧾', title: 'Receipt Management', desc: 'Reprint, email, or download any receipt. Full transaction history with refunds.', color: 'var(--accent)' },
  { icon: '🔐', title: 'Role-Based Access', desc: 'Super admin, manager, cashier — each role sees only what they need.', color: 'var(--secondary)' },
];

const TESTIMONIALS = [
  { name: 'Amara K.', role: 'Supermarket Owner · Nairobi', quote: 'We cut checkout time by 60% in the first week. The staff management alone saves us hours every month.', avatar: 'A' },
  { name: 'David M.', role: 'Retail Chain Manager · Mombasa', quote: 'Managing 4 branches used to be chaos. Now I see everything in real time from one screen.', avatar: 'D' },
  { name: 'Priya S.', role: 'Boutique Owner · Kisumu', quote: "The inventory alerts mean I've never run out of a bestseller since switching. Absolute game changer.", avatar: 'P' },
];

const STATS = [
  { value: '10x', label: 'Faster checkout' },
  { value: '99.9%', label: 'Uptime' },
  { value: '<5 min', label: 'Setup time' },
  { value: '500+', label: 'Businesses' },
];

const TICKER_ITEMS = ['Fast Checkout', 'Stock Tracking', 'Staff Payroll', 'M-Pesa Integration', 'Multi-Branch', 'Live Analytics', 'Receipt Reprinting', 'Role-Based Access', 'Leave Management', 'Real-time Alerts'];

export default function Home() {
  const router = useRouter();
  const { isAuthenticated, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (!loading && isAuthenticated) router.push('/dashboard');
  }, [loading, isAuthenticated, router]);

  useEffect(() => { const t = setTimeout(() => setMounted(true), 80); return () => clearTimeout(t); }, []);

  if (loading) return null;
  if (isAuthenticated) return null;

  return (
    <div className="lp">
      <nav className="lp-nav">
        <a href="#" className="lp-logo">Swift<em>POS</em></a>
        <div className="lp-nav-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#reviews">Reviews</a>
          <a href="#contact">Contact</a>
          <Link href="/login" className="lp-btn-nav">Sign in</Link>
        </div>
        <Link href="/login" className="lp-nav-mobile-cta">Sign in</Link>
      </nav>

      <section className="lp-hero">
        <div style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'none' : 'translateY(28px)', transition: 'opacity 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s, transform 0.9s cubic-bezier(0.16,1,0.3,1) 0.1s' }}>
          <div className="lp-hero-pill"><span className="lp-pill-dot">✦</span> Trusted by 500+ businesses across East Africa</div>
          <h1 className="lp-hero-h1">The POS that<br /><span className="coral">runs your</span><br /><span className="amber">whole store.</span></h1>
          <p className="lp-hero-sub">SwiftPOS unifies sales, inventory, staff management, and real-time analytics — one fast, beautiful platform built for modern African retailers.</p>
          <div className="lp-hero-actions">
            <Link href="/login" className="lp-btn-primary">Get Started Free <span className="arr">→</span></Link>
            <a href="#features" className="lp-btn-ghost">See all features</a>
          </div>
          <div className="lp-trust">
            <div className="lp-avatars">
              {([['#f97316','A'],['#8b5cf6','D'],['#06b6d4','P'],['#10b981','M']] as [string,string][]).map(([bg, l], i) => (
                <div key={i} className="lp-av" style={{ background: bg }}>{l}</div>
              ))}
            </div>
            <div className="lp-trust-text"><strong>500+ businesses</strong> already running on SwiftPOS</div>
          </div>
        </div>

        <div className="lp-visual" style={{ opacity: mounted ? 1 : 0, transition: 'opacity 1.1s cubic-bezier(0.16,1,0.3,1) 0.5s' }}>
          <div className="lp-stack">
            <div className="lp-card lp-card-b2"><span>CBD · Till #1</span></div>
            <div className="lp-card lp-card-b1"><span>Westlands · Till #2</span></div>
            <div className="lp-card lp-card-main">
              <div className="rc-logo">Swift<em>POS</em></div>
              <div className="rc-branch">Kenyatta Ave · Till #3 · Jane M.</div>
              <hr className="rc-div" />
              <div className="rc-row"><span>Basmati Rice 2kg</span><span>KSh 280</span></div>
              <div className="rc-row"><span>Cooking Oil 1L</span><span>KSh 195</span></div>
              <div className="rc-row"><span>Unga Pembe 2kg</span><span>KSh 155</span></div>
              <div className="rc-row"><span>Royco Mix x 3</span><span>KSh 135</span></div>
              <div className="rc-row"><span>Fresh Milk 500ml</span><span>KSh 55</span></div>
              <hr className="rc-div" />
              <div className="rc-row" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}><span>Subtotal</span><span>KSh 820</span></div>
              <div className="rc-row" style={{ fontSize: '0.75rem', color: 'var(--muted-foreground)' }}><span>VAT (16%)</span><span>KSh 131.20</span></div>
              <div className="rc-total-box"><div className="rc-total-lbl">Total</div><div className="rc-total-val">KSh 951.20</div></div>
              <div className="rc-badge">✓ M-Pesa Confirmed</div>
            </div>
            <div className="lp-float-card lp-float-1" style={{ top: -20, right: -44 }}><div className="lp-float-val" style={{ color: '#10b981' }}>+28%</div><div className="lp-float-lbl">Revenue this week</div></div>
            <div className="lp-float-card lp-float-2" style={{ bottom: 10, right: -52 }}><div className="lp-float-val" style={{ color: 'var(--primary)' }}>142</div><div className="lp-float-lbl">Transactions today</div></div>
            <div className="lp-float-card lp-float-3" style={{ bottom: 110, left: -52 }}><div className="lp-float-val" style={{ color: 'var(--secondary)' }}>8</div><div className="lp-float-lbl">Staff clocked in</div></div>
          </div>
        </div>
      </section>

      <div className="lp-ticker-outer">
        <div className="lp-ticker">
          {[...Array(2)].map((_, r) => TICKER_ITEMS.map(item => <span key={`${r}-${item}`} className="lp-ti">{item}</span>))}
        </div>
      </div>

      <div className="lp-stats-outer">
        <Reveal>
          <div className="lp-stats">
            {STATS.map(s => (
              <div key={s.value} className="lp-stat-c">
                <div className="lp-stat-v">{s.value}</div>
                <div className="lp-stat-l">{s.label}</div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>

      <section id="features">
        <div className="lp-section">
          <Reveal>
            <div className="lp-section-header">
              <div className="lp-eyebrow">Everything you need</div>
              <h2 className="lp-h2">Built for real retail,<br /><em>not just demos.</em></h2>
              <p className="lp-lead">Every feature was shaped by real shopkeepers, supermarkets, and retail chains across East Africa.</p>
            </div>
          </Reveal>
          <div className="lp-feat-grid">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 60}>
                <div className="lp-feat">
                  <div className="lp-feat-icon" style={{ background: `${f.color}18` }}>{f.icon}</div>
                  <div className="lp-feat-name">{f.title}</div>
                  <div className="lp-feat-desc">{f.desc}</div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works">
        <div className="lp-how-bg">
          <div className="lp-how-inner">
            <Reveal><h2 className="lp-how-h2">Live in under<br /><span>5 minutes.</span></h2></Reveal>
            <div className="lp-steps">
              {[
                { n: '01', t: 'Create your account', d: 'Sign up and configure your store — name, branches, currency (KES, USD, etc.), and tax rate. Takes under 2 minutes.' },
                { n: '02', t: 'Add products & staff', d: 'Import your product catalogue via CSV or add manually. Invite your team, assign roles, and link each person to a branch.' },
                { n: '03', t: 'Start selling', d: 'Your cashiers log in from any device and start processing sales immediately. No training course required.' },
              ].map((s, i) => (
                <Reveal key={s.n} delay={i * 130}>
                  <div className="lp-step">
                    <div className="lp-step-n">{s.n}</div>
                    <div className="lp-step-t">{s.t}</div>
                    <div className="lp-step-d">{s.d}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="reviews">
        <div className="lp-test-section">
          <Reveal>
            <div className="lp-eyebrow">Real stories</div>
            <h2 className="lp-h2">Retailers love <em>SwiftPOS</em></h2>
          </Reveal>
          <div className="lp-test-grid">
            {TESTIMONIALS.map((t, i) => (
              <Reveal key={t.name} delay={i * 100}>
                <div className="lp-test-card">
                  <div className="lp-test-stars">★★★★★</div>
                  <p className="lp-test-q">"{t.quote}"</p>
                  <div className="lp-test-footer">
                    <div className="lp-test-av">{t.avatar}</div>
                    <div>
                      <div className="lp-test-name">{t.name}</div>
                      <div className="lp-test-role">{t.role}</div>
                    </div>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section id="contact">
        <div className="lp-contact-outer">
          <Reveal>
            <div className="lp-section-header">
              <div className="lp-eyebrow">Get in touch</div>
              <h2 className="lp-h2">We&apos;re here to<br /><em>help you grow.</em></h2>
              <p className="lp-lead">Have questions before signing up? Want a live demo? Reach out — we respond fast.</p>
            </div>
          </Reveal>
          <div className="lp-contact-grid">
            <Reveal delay={0}>
              <a href="tel:+254768299985" className="lp-contact-card">
                <div className="lp-contact-icon" style={{ background: 'rgba(249,115,22,0.1)' }}>📞</div>
                <div className="lp-contact-label">Call or WhatsApp</div>
                <div className="lp-contact-value">+254 768 299 985</div>
                <div className="lp-contact-hint">Mon – Sat, 8am – 8pm EAT</div>
              </a>
            </Reveal>
            <Reveal delay={80}>
              <a href="mailto:gilbertngaruiya@gmail.com" className="lp-contact-card">
                <div className="lp-contact-icon" style={{ background: 'rgba(245,158,11,0.1)' }}>✉️</div>
                <div className="lp-contact-label">Email us</div>
                <div className="lp-contact-value">gilbertngaruiya@gmail.com</div>
                <div className="lp-contact-hint">We reply within a few hours</div>
              </a>
            </Reveal>
            <Reveal delay={160}>
              <a href="https://wa.me/254768299985" target="_blank" rel="noopener noreferrer" className="lp-contact-card">
                <div className="lp-contact-icon" style={{ background: 'rgba(16,185,129,0.1)' }}>💬</div>
                <div className="lp-contact-label">WhatsApp Chat</div>
                <div className="lp-contact-value">Chat instantly</div>
                <div className="lp-contact-hint">Fastest way to reach us</div>
              </a>
            </Reveal>
            <Reveal delay={240}>
              <div className="lp-contact-card lp-contact-card-demo">
                <div className="lp-contact-icon" style={{ background: 'rgba(139,92,246,0.1)' }}>🎯</div>
                <div className="lp-contact-label">Book a Demo</div>
                <div className="lp-contact-value">See SwiftPOS live</div>
                <div className="lp-contact-hint">Free 30-min walkthrough</div>
                <a href="mailto:gilbertngaruiya@gmail.com?subject=Demo Request - SwiftPOS&body=Hi, I'd like to book a demo of SwiftPOS." className="lp-contact-demo-btn">Book Now →</a>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      <Reveal>
        <div className="lp-cta-outer">
          <div className="lp-cta-box">
            <h2 className="lp-cta-h2">Ready to transform<br />your store?</h2>
            <p className="lp-cta-sub">Join 500+ businesses. No credit card needed. Cancel any time.</p>
            <Link href="/login" className="lp-btn-cta">Get Started Free <span className="arr">→</span></Link>
          </div>
        </div>
      </Reveal>

      <footer className="lp-foot">
        <a href="#" className="lp-foot-logo">Swift<em>POS</em></a>
        <div className="lp-foot-links">
          <a href="#features">Features</a>
          <a href="#how-it-works">How it works</a>
          <a href="#reviews">Reviews</a>
          <a href="#contact">Contact</a>
          <Link href="/login">Sign in</Link>
        </div>
        <div className="lp-foot-contact">
          <a href="tel:+254768299985">+254 768 299 985</a>
          <span>·</span>
          <a href="mailto:gilbertngaruiya@gmail.com">gilbertngaruiya@gmail.com</a>
        </div>
        <p className="lp-foot-copy">© {new Date().getFullYear()} SwiftPOS · Built for modern retail</p>
      </footer>
    </div>
  );
}