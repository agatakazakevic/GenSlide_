import Reveal from 'reveal.js';
import { useEffect } from 'react';
import IrSlide from './IrSlide.jsx';
import '../styles/ir-theme.css';

import 'reveal.js/dist/reveal.css';
import 'reveal.js/dist/theme/white.css';

export default function RevealPresentation({ slides, presentation }) {
  const deckSlides = presentation?.slides || slides || [];
  const metadata = presentation?.metadata || {};
  const brandColor = metadata.brandColor || '#0077c8';
  const isIrTheme = metadata.theme === 'ntt';
  const companyShort = metadata.companyShort || metadata.title || 'Company';
  const companyLegal = metadata.companyLegal || metadata.title || 'Company Inc.';
  const year = metadata.year || new Date().getFullYear();
  useEffect(() => {
    const deck = new Reveal({
      controls: true,
      progress: true,
      slideNumber: true,
      hash: true,
    });
    deck.initialize();
  }, []);

  return (
    <div className="reveal">
      <div className="slides">
        {deckSlides.map((slide, i) => (
          <section key={i}>
            {isIrTheme ? (
              <div style={{ width: '100%', height: '100%' }}>
                <IrSlide
                  slide={slide}
                  index={i}
                  chartData={slide.chartData}
                  brandColor={brandColor}
                  logoData={slide.logo?.data}
                  companyShort={companyShort}
                  companyLegal={companyLegal}
                  year={year}
                  pageNo={i + 1}
                />
              </div>
            ) : (
              <>
                <h2>{slide.title}</h2>
                {slide.content?.map((item, j) => (
                  <p key={j}>{item}</p>
                ))}
              </>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
