"use client";

import { useEffect, useState } from "react";

type PortfolioItem = {
  title: string;
  subtitle: string;
  image: string;
  href: string;
};

type ServiceItem = {
  title: string;
  image: string;
};

type PriceItem = {
  title: string;
  cost: string;
  icon: string;
};

const navItems = [
  { href: "#home", label: "Home" },
  { href: "#portfolio", label: "Portfolio" },
  { href: "#skills", label: "Skills" },
  { href: "#timeline", label: "Timeline" },
  { href: "#price", label: "Price" },
  { href: "#news", label: "News" },
  { href: "#contact", label: "Contact" },
];

const services: ServiceItem[] = [
  { title: "Web Development", image: "/assets/img/service/1.jpg" },
  { title: "Digital Marketing", image: "/assets/img/service/2.jpg" },
  { title: "Graphic Design", image: "/assets/img/service/3.jpg" },
];

const portfolioItems: PortfolioItem[] = [
  {
    title: "Magic Art",
    subtitle: "Vimeo",
    image: "/assets/img/portfolio/1.jpg",
    href: "https://vimeo.com/337292310",
  },
  {
    title: "Bona Green",
    subtitle: "Youtube",
    image: "/assets/img/portfolio/2.jpg",
    href: "https://www.youtube.com/watch?v=7e90gBu4pas",
  },
  {
    title: "Leo Dandora",
    subtitle: "Soundcloud",
    image: "/assets/img/portfolio/3.jpg",
    href:
      "https://w.soundcloud.com/player/?url=https%3A//api.soundcloud.com/tracks/471954807&color=%23ff5500&auto_play=true&hide_related=false&show_comments=true&show_user=true&show_reposts=false&show_teaser=true&visual=true",
  },
  {
    title: "Folio Grasia",
    subtitle: "Detail",
    image: "/assets/img/portfolio/4.jpg",
    href: "#contact",
  },
  {
    title: "Viva Mercury",
    subtitle: "Image",
    image: "/assets/img/portfolio/5.jpg",
    href: "/assets/img/portfolio/5.jpg",
  },
  {
    title: "Santa Onera",
    subtitle: "Image",
    image: "/assets/img/portfolio/6.jpg",
    href: "/assets/img/portfolio/6.jpg",
  },
];

const priceItems: PriceItem[] = [
  {
    title: "WordPress Development",
    cost: "$500",
    icon: "/assets/img/svg/wordpress.svg",
  },
  {
    title: "HTML Development",
    cost: "$400",
    icon: "/assets/img/svg/html.svg",
  },
  {
    title: "Content Writing",
    cost: "$300",
    icon: "/assets/img/svg/edit.svg",
  },
  {
    title: "Brand Identity",
    cost: "$200",
    icon: "/assets/img/svg/design.svg",
  },
  {
    title: "PSD Design",
    cost: "$100",
    icon: "/assets/img/svg/photoshop.svg",
  },
];

const contactItems = [
  {
    label: "44 Place, Tokyo, Japan",
    icon: "/assets/img/svg/placeholder.svg",
  },
  {
    label: "+77 033 442 55 57",
    icon: "/assets/img/svg/phone.svg",
  },
  {
    label: "dodo@gmail.com",
    icon: "/assets/img/svg/mail.svg",
  },
  {
    label: "www.domain.com",
    icon: "/assets/img/svg/globe.svg",
  },
];

const socials = [
  { href: "#", icon: "/assets/img/svg/social/facebook.svg", label: "Facebook" },
  { href: "#", icon: "/assets/img/svg/social/twitter.svg", label: "Twitter" },
  {
    href: "#",
    icon: "/assets/img/svg/social/instagram.svg",
    label: "Instagram",
  },
  { href: "#", icon: "/assets/img/svg/social/dribbble.svg", label: "Dribbble" },
  { href: "#", icon: "/assets/img/svg/social/tik-tok.svg", label: "TikTok" },
];

function SectionHeading({
  eyebrow,
  title,
  inverse = false,
}: {
  eyebrow: string;
  title: string;
  inverse?: boolean;
}) {
  return (
    <div className="section-heading">
      <span className="section-heading__eyebrow">{eyebrow}</span>
      <h2 className={inverse ? "section-heading__title is-inverse" : "section-heading__title"}>
        {title}
      </h2>
    </div>
  );
}

export default function Home() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    return () => document.body.classList.remove("menu-open");
  }, [menuOpen]);

  return (
    <main className="site-shell">
      <header className={`topbar ${scrolled ? "is-scrolled" : ""}`}>
        <div className="container topbar__inner">
          <a className="brand" href="#home" aria-label="Kura home">
            <img src="/assets/img/logo/dark.png" alt="Kura logo" className="brand__logo" />
          </a>

          <nav className="nav nav--desktop" aria-label="Primary">
            <ul className="nav__list">
              {navItems.map((item) => (
                <li key={item.href} className="nav__item">
                  <a href={item.href} className="nav__link">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <button
            type="button"
            className={`hamburger ${menuOpen ? "is-active" : ""}`}
            aria-label="Toggle menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            <span />
            <span />
            <span />
          </button>
        </div>

        <div className={`mobile-drawer ${menuOpen ? "is-open" : ""}`}>
          <nav className="nav nav--mobile" aria-label="Mobile primary">
            <ul className="nav__list nav__list--mobile">
              {navItems.map((item) => (
                <li key={item.href} className="nav__item nav__item--mobile">
                  <a href={item.href} className="nav__link nav__link--mobile" onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </header>

      <section id="home" className="hero section">
        <div className="container hero__grid">
          <div className="hero__copy">
            <span className="hero__eyebrow">Bernard Smith</span>
            <h1 className="hero__title">Creative Designer based in Japan</h1>

            <ul className="service-list">
              {services.map((service) => (
                <li key={service.title} className="service-list__item">
                  <a href="#portfolio" className="service-link">
                    <img src={service.image} alt="" className="service-link__thumb" />
                    <span className="service-link__label">{service.title}</span>
                    <img
                      src="/assets/img/svg/right-arrow.svg"
                      alt=""
                      className="service-link__arrow"
                    />
                  </a>
                </li>
              ))}
            </ul>

            <ul className="hero-stats">
              <li className="hero-stats__item">
                <strong>10+</strong>
                <span>
                  Years of
                  <br />
                  Experience
                </span>
              </li>
              <li className="hero-stats__item">
                <strong>3K+</strong>
                <span>
                  Happy
                  <br />
                  Customers
                </span>
              </li>
            </ul>
          </div>

          <div className="hero__visual">
            <div className="hero-frame">
              <img src="/assets/img/thumbs/3-4.jpg" alt="" className="hero-frame__ratio" />
              <div className="hero-frame__image" aria-hidden="true" />
              <span className="hero-frame__shape" aria-hidden="true" />
            </div>
          </div>

          <a className="hero__down" href="#portfolio" aria-label="Scroll to portfolio">
            <img src="/assets/img/svg/down-arrow.svg" alt="" />
          </a>
        </div>
      </section>

      <section id="portfolio" className="section section--portfolio">
        <div className="container">
          <SectionHeading eyebrow="Portfolio" title="Selected Works" />

          <div className="portfolio-grid">
            {portfolioItems.map((item) => (
              <a
                key={item.title}
                href={item.href}
                target={item.href.startsWith("http") ? "_blank" : undefined}
                rel={item.href.startsWith("http") ? "noreferrer" : undefined}
                className="portfolio-card"
              >
                <div className="portfolio-card__media">
                  <img src="/assets/img/portfolio/410-460.jpg" alt="" className="portfolio-card__ratio" />
                  <div
                    className="portfolio-card__image"
                    style={{ backgroundImage: `url(${item.image})` }}
                    aria-hidden="true"
                  />
                </div>

                <div className="portfolio-card__overlay" aria-hidden="true" />
                <img src="/assets/img/svg/right-arrow.svg" alt="" className="portfolio-card__arrow" />

                <div className="portfolio-card__details">
                  <h3>{item.title}</h3>
                  <span>{item.subtitle}</span>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section id="price" className="section section--price">
        <div className="container price-grid">
          <div className="price-grid__copy">
            <SectionHeading eyebrow="Pricing" title="Service Prices" />
            <p className="section-copy">
              For more than 20 years our experts have been accomplishing enough with modern Web Development,
              new generation web and app programming language.
            </p>
          </div>

          <div className="price-grid__list">
            {priceItems.map((item) => (
              <article key={item.title} className="price-item">
                <img src={item.icon} alt="" className="price-item__icon" />
                <div className="price-item__title">{item.title}</div>
                <div className="price-item__cost">{item.cost}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contact" className="section section--contact">
        <div className="container contact-grid">
          <div className="contact-grid__copy">
            <SectionHeading eyebrow="Contact" title="Get in Touch" />
            <p className="section-copy">
              Please fill out the form on this section to contact with me. Or call between 9:00 a.m. and
              8:00 p.m. ET, Monday through Friday
            </p>

            <ul className="contact-list">
              {contactItems.map((item) => (
                <li key={item.label} className="contact-list__item">
                  <img src={item.icon} alt="" className="contact-list__icon" />
                  <span>{item.label}</span>
                </li>
              ))}
            </ul>
          </div>

          <form className="contact-form">
            <div className="contact-form__fields">
              <input id="name" name="name" type="text" placeholder="Name" />
              <input id="email" name="email" type="email" placeholder="Email" />
            </div>
            <textarea id="message" name="message" placeholder="Message" />

            <button type="submit" className="button button--arrow">
              <span>Submit</span>
              <img src="/assets/img/svg/right-arrow.svg" alt="" />
            </button>
          </form>
        </div>
      </section>

      <footer className="footer">
        <div className="container footer__inner">
          <p>Copyright © 2023. All rights reserved.</p>

          <ul className="socials">
            {socials.map((item) => (
              <li key={item.label} className="socials__item">
                <a href={item.href} aria-label={item.label}>
                  <img src={item.icon} alt="" />
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </main>
  );
}
