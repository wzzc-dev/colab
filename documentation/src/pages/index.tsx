import clsx from "clsx";
import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import { useState, useEffect, useRef, useCallback } from "react";
const brainAnimation = "/icons/brain.gif";
const rocketAnimation = "/icons/rocket.gif";
const gearAnimation = "/icons/gear.gif";
const designAnimation = "/icons/design.gif";
const codeAnimation = "/icons/code.gif";
const starAnimation = "/icons/star.gif";
const teamAnimation = "/icons/team.gif";
import styles from "./index.module.css";

// Custom hook for scroll-triggered animations
function useScrollAnimation() {
  const [ref, setRef] = useState<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [hasAnimated, setHasAnimated] = useState(false);

  const callbackRef = useCallback((node: HTMLElement | null) => {
    setRef(node);
  }, []);

  useEffect(() => {
    if (!ref) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated) {
          setIsVisible(true);
          setHasAnimated(true);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '-50px 0px'
      }
    );

    observer.observe(ref);
    return () => observer.disconnect();
  }, [ref, hasAnimated]);

  return [callbackRef, isVisible] as const;
}

// Enhanced cursor-following effect
function useCursorFollow() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);
  
  return mousePosition;
}

// Authentic math formulas from Co(lab)'s BlackboardAnimation
const mathFormulas = [
  "∫ e^(-x²/2) dx = √(2π)",
  "∇²ψ + k²ψ = 0",
  "E = mc²",
  "∂u/∂t = α∇²u",
  "F = ma = dp/dt",
  "∮ E · dl = -dΦ/dt",
  "H(x) = -Σ p log(p)",
  "∂/∂x(g ∂φ/∂x) = 0",
  "δS = ∫ δL dt = 0",
  "⟨ψ|H|ψ⟩ = E⟨ψ|ψ⟩",
  "∇ × B = μJ + με∂E/∂t",
  "det(A - λI) = 0",
  "lim (f(x+h) - f(x))/h = f'(x)",
  "∫∫∫ (∇ · F) dV = ∮∮ F · n dS",
  "a² + b² = c²",
  "sin²θ + cos²θ = 1",
  "e^(iπ) + 1 = 0",
  "∑ 1/n² = π²/6",
  "∂²f/∂x² + ∂²f/∂y² = 0"
];

function BlackboardAnimation() {
  const [formulas, setFormulas] = useState<{text: string, x: number, y: number, opacity: number, progress: number, id: number}[]>([]);
  const animationRef = useRef<number>();
  const frameCountRef = useRef(0);
  const nextIdRef = useRef(0);

  useEffect(() => {
    const animate = () => {
      frameCountRef.current++;
      
      // Add new formula every ~2 seconds at 60fps
      if (frameCountRef.current % 120 === 0 && formulas.length < 5) {
        const newFormula = {
          text: mathFormulas[Math.floor(Math.random() * mathFormulas.length)],
          x: Math.random() * 70 + 15, // 15-85% from left
          y: Math.random() * 70 + 15, // 15-85% from top
          opacity: 0.25,
          progress: 0, // Start with no characters visible
          id: nextIdRef.current++
        };
        
        setFormulas(prev => [...prev, newFormula]);
      }

      // Update existing formulas every frame for smooth animation
      setFormulas(prev => 
        prev.map(formula => {
          if (formula.progress < 1) {
            // Writing phase - reveal characters from left to right
            return {
              ...formula,
              progress: Math.min(formula.progress + 0.015, 1) // Reveal over ~67 frames (1+ seconds)
            };
          } else {
            // Fade out phase after writing is complete
            return {
              ...formula,
              opacity: Math.max(formula.opacity - 0.001, 0) // Slowly fade out
            };
          }
        })
        .filter(formula => formula.opacity > 0.001) // Remove fully faded formulas
      );

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [formulas.length]);

  return (
    <div className={styles.mathAnimation}>
      {formulas.map(formula => {
        const visibleLength = Math.floor(formula.text.length * formula.progress);
        const visibleText = formula.text.substring(0, visibleLength);
        
        return (
          <div
            key={formula.id}
            className={styles.equation}
            style={{
              left: `${formula.x}%`,
              top: `${formula.y}%`,
              opacity: formula.opacity,
            }}
          >
            <span style={{ visibility: "visible" }}>{visibleText}</span>
            <span style={{ visibility: "hidden" }}>{formula.text.substring(visibleLength)}</span>
          </div>
        );
      })}
    </div>
  );
}

function HeroSection() {
  return (
    <section className={styles.hero}>
      <div className="container">
        <BlackboardAnimation />
        <div className={styles.heroContent}>
          <Heading as="h1" className={styles.heroTitle}>
            Co(lab)
          </Heading>
          <p className={styles.heroSubtitle}>
            Build startups faster with deep work
          </p>
          <p className={styles.heroDescription}>
            Stop switching between dozens of tools. Co(lab) is a hybrid web browser + 
            local code editor with integrated AI designed for startup builders who need to move fast.
          </p>
          <div className={styles.heroButtons}>
            <Link
              className={clsx("button button--primary button--lg", styles.downloadButton)}
              to="https://static.colab.sh/stable/co(lab).dmg"
            >
              Download for Mac
            </Link>
            <Link
              className={clsx("button button--secondary button--lg", styles.githubButton)}
              to="https://github.com/blackboardsh/colab"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function ValueProps() {
  const [sectionRef, isVisible] = useScrollAnimation();
  
  return (
    <section 
      ref={sectionRef}
      className={`${styles.valueProps} ${isVisible ? styles.scrollVisible : ''}`}
    >
      <BlackboardAnimation />
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Ship faster, think deeper
        </Heading>
        <div className={styles.valuePropsGrid}>
          <div className={styles.valueProp}>
            <div className={styles.valueIcon}>
              <img 
                src={brainAnimation}
                style={{ width: 150, height: 150 }}
                alt="Brain icon"
              />
            </div>
            <Heading as="h3">Deep Work Environment</Heading>
            <p>
              Focus on building instead of managing tools. Keep your code, browser, 
              notes, and git workflow in one unified interface.
            </p>
          </div>
          <div className={styles.valueProp}>
            <div className={styles.valueIcon}>
              <img 
                src={rocketAnimation}
                style={{ width: 150, height: 150 }}
                alt="Rocket icon"
              />
            </div>
            <Heading as="h3">Startup-First Design</Heading>
            <p>
              Built specifically for the chaotic, fast-moving world of startups. 
              Organize projects the way you actually work.
            </p>
          </div>
          <div className={styles.valueProp}>
            <div className={styles.valueIcon}>
              <img 
                src={gearAnimation}
                style={{ width: 150, height: 150 }}
                alt="Gear icon"
              />
            </div>
            <Heading as="h3">Extensible by Design</Heading>
            <p>
              Plugin architecture lets you customize workflows. Start simple, 
              grow complex as your needs evolve.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductShowcase() {
  const [sectionRef, isVisible] = useScrollAnimation();
  
  return (
    <section 
      ref={sectionRef}
      className={`${styles.showcase} ${isVisible ? styles.scrollVisible : ''}`}
    >
      <BlackboardAnimation />
      <div className="container">
        <Heading as="h2" className={styles.showcaseTitle}>
          Everything you need in one place
        </Heading>
        <div className={styles.showcaseGrid}>
          <div className={styles.showcaseFeature}>
            <Heading as="h3">Unified Code + Browser</Heading>
            <ul>
              <li>
                <strong>Monaco-powered editor</strong>
                <span className={styles.featureDescription}>with formatters and LSP integrations</span>
              </li>
              <li>
                <strong>Chromium and WebKit tabs</strong>
                <span className={styles.featureDescription}>right next to your code</span>
              </li>
              <li>
                <strong>Multi-pane workspace</strong>
                <span className={styles.featureDescription}>for complex projects</span>
              </li>
              <li>
                <strong>Smart bookmarks</strong>
                <span className={styles.featureDescription}>and custom preload scripts</span>
              </li>
            </ul>
          </div>
          <div className={styles.showcaseFeature}>
            <Heading as="h3">Built for Builders</Heading>
            <ul>
              <li>
                <strong>"A new way to folder"</strong>
                <span className={styles.featureDescription}>organize projects intuitively</span>
              </li>
              <li>
                <strong>Visual Git integration</strong>
                <span className={styles.featureDescription}>stage, commit, manage branches</span>
              </li>
              <li>
                <strong>Full PTY terminal</strong>
                <span className={styles.featureDescription}>run top, Claude Code, cursor, and more</span>
              </li>
              <li>
                <strong>Bun runtime</strong>
                <span className={styles.featureDescription}>for lightning-fast JavaScript execution</span>
              </li>
              <li>
                <strong>Plugin system</strong>
                <span className={styles.featureDescription}>for ultimate customization</span>
              </li>
            </ul>
          </div>
          <div className={styles.showcaseFeature}>
            <Heading as="h3">AI-Powered Development</Heading>
            <ul>
              <li>
                <strong>Open weight model downloader</strong>
                <span className={styles.featureDescription}>and manager</span>
              </li>
              <li>
                <strong>Conversational AI chat</strong>
                <span className={styles.featureDescription}>integrated throughout</span>
              </li>
              <li>
                <strong>AI assistance</strong>
                <span className={styles.featureDescription}>across code and web tabs</span>
              </li>
              <li>
                <strong>Local AI models</strong>
                <span className={styles.featureDescription}>for privacy and speed</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function UseCases() {
  const [sectionRef, isVisible] = useScrollAnimation();
  
  return (
    <section 
      ref={sectionRef}
      className={`${styles.useCases} ${isVisible ? styles.scrollVisible : ''}`}
    >
      <BlackboardAnimation />
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Perfect for
        </Heading>
        <div className={styles.useCasesGrid}>
          <div className={styles.useCase}>
            <div className={styles.useCaseIcon}>
              <img 
                src={designAnimation}
                style={{ width: 150, height: 150 }}
                alt="Design icon"
              />
            </div>
            <Heading as="h3">Designers who use Figma and Webflow</Heading>
            <p>
              Switch seamlessly between design tools, code, and live preview. 
              Test Webflow exports and Figma prototypes in real browsers 
              without leaving your workspace.
            </p>
          </div>
          <div className={styles.useCase}>
            <div className={styles.useCaseIcon}>
              <img 
                src={codeAnimation}
                style={{ width: 150, height: 150 }}
                alt="Code icon"
              />
            </div>
            <Heading as="h3">Full-stack builders</Heading>
            <p>
              Frontend, backend, database - manage complex projects with 
              integrated Git and multi-repo support.
            </p>
          </div>
          <div className={styles.useCase}>
            <div className={styles.useCaseIcon}>
              <img 
                src={starAnimation}
                style={{ width: 150, height: 150 }}
                alt="Star icon"
              />
            </div>
            <Heading as="h3">Solo founders</Heading>
            <p>
              One tool for coding, researching, documentation, and project management. 
              Less context switching = more building.
            </p>
          </div>
          <div className={styles.useCase}>
            <div className={styles.useCaseIcon}>
              <img 
                src={teamAnimation}
                style={{ width: 150, height: 150 }}
                alt="Team icon"
              />
            </div>
            <Heading as="h3">Small teams</Heading>
            <p>
              Shared workspaces, consistent environments, and extensible workflows 
              that grow with your startup.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function TechnicalFoundation() {
  const [sectionRef, isVisible] = useScrollAnimation();
  
  return (
    <section 
      ref={sectionRef}
      className={`${styles.technical} ${isVisible ? styles.scrollVisible : ''}`}
    >
      <BlackboardAnimation />
      <div className="container">
        <Heading as="h2" className={styles.technicalTitle}>
          Built on solid ground
        </Heading>
        <p className={styles.technicalDescription}>
          Co(lab) is powered by proven technologies, reimagined for modern workflows:
        </p>
        <div className={styles.techStack}>
          <div className={styles.techItem}>
            <Link to="https://github.com/blackboardsh/electrobun">
              <strong>Electrobun</strong>
            </Link>
            <span>Our open source alternative to Electron</span>
          </div>
          <div className={styles.techItem}>
            <strong>Monaco Editor</strong>
            <span>VS Code's editor engine</span>
          </div>
          <div className={styles.techItem}>
            <Link to="https://solidjs.com">
              <strong>SolidJS</strong>
            </Link>
            <span>Reactive, performant UI</span>
          </div>
          <div className={styles.techItem}>
            <strong>Bun</strong>
            <span>Fast JavaScript runtime and package manager</span>
          </div>
          <div className={styles.techItem}>
            <Link to="https://ziglang.org">
              <strong>Zig</strong>
            </Link>
            <span>Modern systems programming language</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function CommunitySection() {
  const [sectionRef, isVisible] = useScrollAnimation();
  
  return (
    <section 
      ref={sectionRef}
      className={`${styles.community} ${isVisible ? styles.scrollVisible : ''}`}
    >
      <BlackboardAnimation />
      <div className="container">
        <Heading as="h2" className={styles.sectionTitle}>
          Join the community
        </Heading>
        <p className={styles.communityDescription}>
          Co(lab) is <strong>MIT licensed</strong> and built in the open. 
          We believe the best developer tools come from developers.
        </p>
        <div className={styles.communityLinks}>
          <Link
            className={clsx("button button--primary button--lg")}
            to="https://github.com/blackboardsh/colab"
          >
            GitHub Repository
          </Link>
          <Link
            className={clsx("button button--secondary button--lg")}
            to="https://discord.gg/ueKE4tjaCE"
          >
            Join Discord
          </Link>
        </div>
        <div className={styles.finalCta}>
          <Heading as="h2">Ready to build?</Heading>
          <p>
            Download Co(lab) and see how much faster you can move when your tools work together.
          </p>
          <p className={styles.availability}>
            <strong>Mac ARM available now</strong> • More platforms coming soon
          </p>
          <Link
            className={clsx("button button--primary button--lg", styles.finalDownload)}
            to="https://static.colab.sh/stable/co(lab).dmg"
          >
            Download Co(lab)
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home(): JSX.Element {
  return (
    <Layout
      title="Co(lab) - Build startups faster with deep work"
      description="A hybrid web browser + local code editor designed for startup builders who need to move fast."
    >
      <HeroSection />
      <ValueProps />
      <ProductShowcase />
      <UseCases />
      <TechnicalFoundation />
      <CommunitySection />
    </Layout>
  );
}